import {
  canonicalStringify,
  canonicalizeJson,
  serializedJsonCharacters,
} from "../memory-fabric/canonical-json";
import { failAdviser } from "./failures";
import {
  compareStrategyReferences,
  createStrategyApplicabilityResult,
  strategyIdentityKey,
  validateStrategyRecord,
  type StrategyApplicabilityEvaluator,
  type StrategyApplicabilityResult,
  type StrategyRecord,
  type StrategyReference,
} from "./strategy-contract";

export interface StrategyPortfolioLimits {
  readonly maximumStrategyCount: number;
  readonly maximumSerializedCharacters: number;
}

export interface StrategySelectionBudget {
  readonly maximumStrategies: number;
  readonly maximumSerializedCharacters: number;
}

export interface StrategyCandidate {
  readonly strategy: Readonly<StrategyRecord>;
  readonly applicability: Readonly<StrategyApplicabilityResult>;
}

export interface StrategySelectionReport {
  readonly candidates: readonly Readonly<StrategyCandidate>[];
  readonly evaluatedCount: number;
  readonly applicableCount: number;
  readonly omittedCount: number;
  readonly serializedCharacters: number;
  readonly truncated: boolean;
  readonly orderingPolicy: string;
}

export interface StrategyPortfolioSnapshot {
  readonly strategies: readonly Readonly<StrategyRecord>[];
  readonly strategyCount: number;
  readonly serializedCharacters: number;
  readonly limits: Readonly<StrategyPortfolioLimits>;
}

interface StoredStrategy {
  readonly record: Readonly<StrategyRecord>;
  readonly canonical: string;
  readonly characters: number;
}

export class StrategyPortfolio {
  readonly #limits: Readonly<StrategyPortfolioLimits>;
  readonly #records = new Map<string, StoredStrategy>();
  #serializedCharacters = 0;
  #disposed = false;

  constructor(limits: Readonly<StrategyPortfolioLimits>) {
    validatePortfolioLimits(limits);
    this.#limits = Object.freeze({ ...limits });
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get size(): number {
    return this.#records.size;
  }

  async registerStrategy(record: Readonly<StrategyRecord>): Promise<Readonly<StrategyRecord>> {
    this.#assertActive();
    await validateStrategyRecord(record);
    const immutable = cloneStrategy(record);
    const canonical = canonicalStringify(immutable);
    const key = strategyIdentityKey(immutable);
    const existing = this.#records.get(key);
    if (existing !== undefined) {
      if (existing.canonical !== canonical) {
        failAdviser(
          "strategy_identity_collision",
          "strategy_portfolio",
          "Strategy identity is already registered with different content.",
        );
      }
      return cloneStrategy(existing.record);
    }
    if (this.#records.size >= this.#limits.maximumStrategyCount) {
      failAdviser(
        "strategy_budget_exceeded",
        "strategy_portfolio",
        "Strategy portfolio count budget is exhausted.",
      );
    }
    if (this.#serializedCharacters + canonical.length > this.#limits.maximumSerializedCharacters) {
      failAdviser(
        "strategy_budget_exceeded",
        "strategy_portfolio",
        "Strategy portfolio character budget is exhausted.",
      );
    }
    this.#records.set(key, { record: immutable, canonical, characters: canonical.length });
    this.#serializedCharacters += canonical.length;
    return cloneStrategy(immutable);
  }

  getStrategy(reference: Readonly<StrategyReference>): Readonly<StrategyRecord> | null {
    this.#assertActive();
    const stored = this.#records.get(strategyIdentityKey(reference));
    return stored === undefined ? null : cloneStrategy(stored.record);
  }

  listStrategiesWithinBudget(
    budget: Readonly<StrategySelectionBudget>,
  ): Readonly<StrategySelectionReport> {
    this.#assertActive();
    validateSelectionBudget(budget);
    const records = [...this.#records.values()].sort((left, right) =>
      compareStrategyReferences(left.record, right.record),
    );
    const candidates: StrategyCandidate[] = [];
    let characters = 0;
    for (const stored of records) {
      if (
        candidates.length >= budget.maximumStrategies ||
        characters + stored.characters > budget.maximumSerializedCharacters
      ) {
        continue;
      }
      candidates.push({
        strategy: cloneStrategy(stored.record),
        applicability: createStrategyApplicabilityResult({
          strategyId: stored.record.strategyId,
          strategyVersion: stored.record.strategyVersion,
          applicable: true,
          applicabilityBasisPoints: 0,
          satisfiedConstraints: [],
          unsatisfiedConstraints: [],
          uncertaintyFlags: [],
          supportingObservationReferences: [],
          supportingEvidenceReferences: [],
          evaluatorId: "portfolio-list",
          evaluatorVersion: "1",
        }),
      });
      characters += stored.characters;
    }
    return freezeSelectionReport({
      candidates,
      evaluatedCount: records.length,
      applicableCount: records.length,
      omittedCount: records.length - candidates.length,
      serializedCharacters: characters,
      truncated: candidates.length < records.length,
      orderingPolicy: "strategy_id_ascending_then_version_ascending",
    });
  }

  selectApplicableStrategies(
    evaluator: StrategyApplicabilityEvaluator,
    budget: Readonly<StrategySelectionBudget>,
  ): Readonly<StrategySelectionReport> {
    this.#assertActive();
    validateSelectionBudget(budget);
    const evaluated = [...this.#records.values()].map((stored) => {
      const applicability = createStrategyApplicabilityResult(
        evaluator(cloneStrategy(stored.record)),
      );
      if (
        applicability.strategyId !== stored.record.strategyId ||
        applicability.strategyVersion !== stored.record.strategyVersion
      ) {
        failAdviser(
          "invalid_strategy",
          "strategy_portfolio",
          "Applicability result identity does not match the evaluated strategy.",
        );
      }
      return { strategy: stored.record, applicability, characters: stored.characters };
    });
    const applicable = evaluated
      .filter(({ applicability }) => applicability.applicable)
      .sort(
        (left, right) =>
          right.applicability.applicabilityBasisPoints -
            left.applicability.applicabilityBasisPoints ||
          right.strategy.portfolioPriority - left.strategy.portfolioPriority ||
          compareStrategyReferences(left.strategy, right.strategy),
      );
    const candidates: StrategyCandidate[] = [];
    let characters = 0;
    for (const candidate of applicable) {
      if (
        candidates.length >= budget.maximumStrategies ||
        characters + candidate.characters > budget.maximumSerializedCharacters
      ) {
        continue;
      }
      candidates.push({
        strategy: cloneStrategy(candidate.strategy),
        applicability: cloneApplicability(candidate.applicability),
      });
      characters += candidate.characters;
    }
    return freezeSelectionReport({
      candidates,
      evaluatedCount: evaluated.length,
      applicableCount: applicable.length,
      omittedCount: applicable.length - candidates.length,
      serializedCharacters: characters,
      truncated: candidates.length < applicable.length,
      orderingPolicy:
        "applicable_then_applicability_desc_priority_desc_strategy_id_asc_version_asc",
    });
  }

  snapshot(): Readonly<StrategyPortfolioSnapshot> {
    this.#assertActive();
    const strategies = [...this.#records.values()]
      .map(({ record }) => cloneStrategy(record))
      .sort(compareStrategyReferences);
    return Object.freeze({
      strategies: Object.freeze(strategies),
      strategyCount: strategies.length,
      serializedCharacters: this.#serializedCharacters,
      limits: Object.freeze({ ...this.#limits }),
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#records.clear();
    this.#serializedCharacters = 0;
  }

  #assertActive(): void {
    if (this.#disposed) {
      failAdviser("adviser_disposed", "lifecycle", "The strategy portfolio is disposed.");
    }
  }
}

function validatePortfolioLimits(limits: Readonly<StrategyPortfolioLimits>): void {
  if (
    !Number.isSafeInteger(limits.maximumStrategyCount) ||
    limits.maximumStrategyCount < 1 ||
    !Number.isSafeInteger(limits.maximumSerializedCharacters) ||
    limits.maximumSerializedCharacters < 1
  ) {
    failAdviser(
      "strategy_budget_exceeded",
      "strategy_portfolio",
      "Strategy portfolio limits are invalid.",
    );
  }
}

function validateSelectionBudget(budget: Readonly<StrategySelectionBudget>): void {
  if (
    !Number.isSafeInteger(budget.maximumStrategies) ||
    budget.maximumStrategies < 0 ||
    !Number.isSafeInteger(budget.maximumSerializedCharacters) ||
    budget.maximumSerializedCharacters < 0
  ) {
    failAdviser(
      "strategy_budget_exceeded",
      "strategy_portfolio",
      "Strategy selection budget is invalid.",
    );
  }
}

function cloneStrategy(record: Readonly<StrategyRecord>): Readonly<StrategyRecord> {
  return canonicalizeJson(record) as unknown as Readonly<StrategyRecord>;
}

function cloneApplicability(
  result: Readonly<StrategyApplicabilityResult>,
): Readonly<StrategyApplicabilityResult> {
  return canonicalizeJson(result) as unknown as Readonly<StrategyApplicabilityResult>;
}

function freezeSelectionReport(report: StrategySelectionReport): Readonly<StrategySelectionReport> {
  const candidates = report.candidates.map((candidate) =>
    Object.freeze({
      strategy: cloneStrategy(candidate.strategy),
      applicability: cloneApplicability(candidate.applicability),
    }),
  );
  const frozen = Object.freeze({ ...report, candidates: Object.freeze(candidates) });
  serializedJsonCharacters(frozen);
  return frozen;
}

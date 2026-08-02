import {
  canonicalStringify,
  type JsonObject,
} from "../../intelligence-harness/memory-fabric/canonical-json";
import { failAdviser } from "../../intelligence-harness/tactical-adviser/failures";
import {
  createStrategyRecord,
  type StrategyApplicabilityResult,
  type StrategyDraft,
  type StrategyFamily,
  type StrategyRecord,
} from "../../intelligence-harness/tactical-adviser/strategy-contract";
import {
  StrategyPortfolio,
  type StrategyPortfolioLimits,
} from "../../intelligence-harness/tactical-adviser/strategy-portfolio";
import type { KtsObservationPacket } from "../intelligence-adapter";

export const KTS_BASELINE_STRATEGY_VERSION = "1" as const;
export const KTS_BASELINE_STRATEGY_IDS = Object.freeze([
  "preserve-signal",
  "preserve-defence",
  "recover-resources",
  "rebalance-power",
  "reduce-projectile-threat",
  "engage-nearest-enemy",
  "advance-wave",
  "uncertainty-safe-hold",
] as const);
export type KtsBaselineStrategyId = (typeof KTS_BASELINE_STRATEGY_IDS)[number];

export interface KtsBaselineStrategyGovernance {
  readonly recordedAt: string;
  readonly actorId: string;
  readonly domainVersion: string;
}

interface BaselineDefinition {
  readonly strategyId: KtsBaselineStrategyId;
  readonly family: StrategyFamily;
  readonly objective: string;
  readonly portfolioPriority: number;
  readonly triggerConditions: readonly JsonObject[];
  readonly applicabilityConstraints: readonly JsonObject[];
  readonly actionPreferences: JsonObject;
  readonly expectedEffects: readonly string[];
  readonly knownFailureModes: readonly string[];
}

const BASELINE_DEFINITIONS = [
  {
    strategyId: "preserve-signal",
    family: "preservation",
    objective: "Prefer bounded choices that preserve Signal integrity.",
    portfolioPriority: 800,
    triggerConditions: [
      { field: "resources.signal.integrityBasisPoints", operator: "below", value: 5_000 },
    ],
    applicabilityConstraints: [{ field: "lifecycle.status", operator: "equals", value: "running" }],
    actionPreferences: { intent: "preserve_signal", avoid: "unsupported_immediate_action" },
    expectedEffects: ["reduce_signal_loss_exposure"],
    knownFailureModes: ["signal_threat_not_visible_in_bounded_observation"],
  },
  {
    strategyId: "preserve-defence",
    family: "preservation",
    objective: "Prefer bounded choices that preserve Defence integrity.",
    portfolioPriority: 750,
    triggerConditions: [
      { field: "resources.defence.integrityBasisPoints", operator: "below", value: 5_000 },
    ],
    applicabilityConstraints: [{ field: "lifecycle.status", operator: "equals", value: "running" }],
    actionPreferences: { intent: "preserve_defence", avoid: "unsupported_immediate_action" },
    expectedEffects: ["reduce_defence_loss_exposure"],
    knownFailureModes: ["incoming_threat_not_visible_in_bounded_observation"],
  },
  {
    strategyId: "recover-resources",
    family: "recovery_management",
    objective: "Use a readiness-consistent recovery opportunity when resources are damaged.",
    portfolioPriority: 700,
    triggerConditions: [
      { field: "actionSpace.readiness.recoveryPulseReady", operator: "equals", value: true },
    ],
    applicabilityConstraints: [{ field: "lifecycle.status", operator: "equals", value: "running" }],
    actionPreferences: { intent: "recover", recoveryRecommendation: "activate_now" },
    expectedEffects: ["increase_resource_integrity_when_engine_accepts_action"],
    knownFailureModes: ["readiness_changes_before_later_action_submission"],
  },
  {
    strategyId: "rebalance-power",
    family: "recovery_management",
    objective: "Prefer a readiness-consistent transfer toward the weakest power channel.",
    portfolioPriority: 650,
    triggerConditions: [
      { field: "actionSpace.readiness.powerShiftReady", operator: "equals", value: true },
    ],
    applicabilityConstraints: [{ field: "lifecycle.status", operator: "equals", value: "running" }],
    actionPreferences: { intent: "rebalance_power", target: "weakest_channel" },
    expectedEffects: ["reduce_power_allocation_imbalance"],
    knownFailureModes: ["channel_priority_differs_from_resource_threat"],
  },
  {
    strategyId: "reduce-projectile-threat",
    family: "threat_avoidance",
    objective: "Prioritize a visible hostile projectile threat without claiming engine control.",
    portfolioPriority: 900,
    triggerConditions: [{ field: "entities.enemyProjectiles", operator: "non_empty", value: true }],
    applicabilityConstraints: [{ field: "lifecycle.status", operator: "equals", value: "running" }],
    actionPreferences: { intent: "reduce_threat", targetKind: "enemy_projectile" },
    expectedEffects: ["reduce_visible_projectile_threat_exposure"],
    knownFailureModes: ["projectile_trajectory_requires_unavailable_prediction"],
  },
  {
    strategyId: "engage-nearest-enemy",
    family: "aggressive_progress",
    objective: "Prefer the nearest visible enemy when engagement is evidence-supported.",
    portfolioPriority: 500,
    triggerConditions: [{ field: "entities.enemies", operator: "non_empty", value: true }],
    applicabilityConstraints: [{ field: "lifecycle.status", operator: "equals", value: "running" }],
    actionPreferences: { intent: "engage_target", targetKind: "enemy" },
    expectedEffects: ["focus_visible_enemy_pressure"],
    knownFailureModes: ["nearest_enemy_not_highest_value_target"],
  },
  {
    strategyId: "advance-wave",
    family: "aggressive_progress",
    objective: "Prefer bounded wave progress when no visible hostile entity requires priority.",
    portfolioPriority: 400,
    triggerConditions: [{ field: "entities.enemies", operator: "empty", value: true }],
    applicabilityConstraints: [
      { field: "lifecycle.encounterComplete", operator: "equals", value: false },
    ],
    actionPreferences: { intent: "advance_wave", movement: "forward" },
    expectedEffects: ["maintain_encounter_progress"],
    knownFailureModes: ["omitted_hostile_entities_exist"],
  },
  {
    strategyId: "uncertainty-safe-hold",
    family: "uncertainty_safe",
    objective: "Hold or abstain when stronger evidence-supported strategy is unavailable.",
    portfolioPriority: 100,
    triggerConditions: [{ field: "observation", operator: "available", value: true }],
    applicabilityConstraints: [
      { field: "observation.metadata", operator: "accepted", value: true },
    ],
    actionPreferences: { intent: "hold", immediateAction: false },
    expectedEffects: ["avoid_unsupported_recommendation"],
    knownFailureModes: ["conservative_hold_misses_progress_opportunity"],
  },
] satisfies readonly BaselineDefinition[];

export async function createKtsBaselineStrategies(
  governance: Readonly<KtsBaselineStrategyGovernance>,
): Promise<readonly Readonly<StrategyRecord>[]> {
  return Object.freeze(
    await Promise.all(
      BASELINE_DEFINITIONS.map((definition) =>
        createStrategyRecord(toDraft(definition as unknown as BaselineDefinition, governance)),
      ),
    ),
  );
}

export async function createKtsBaselinePortfolio(
  governance: Readonly<KtsBaselineStrategyGovernance>,
  limits: Readonly<StrategyPortfolioLimits> = {
    maximumStrategyCount: KTS_BASELINE_STRATEGY_IDS.length,
    maximumSerializedCharacters: 100_000,
  },
): Promise<StrategyPortfolio> {
  const portfolio = new StrategyPortfolio(limits);
  for (const strategy of await createKtsBaselineStrategies(governance)) {
    await portfolio.registerStrategy(strategy);
  }
  return portfolio;
}

export function assertKtsBaselinePortfolio(portfolio: StrategyPortfolio): void {
  const snapshot = portfolio.snapshot();
  if (snapshot.strategyCount !== KTS_BASELINE_STRATEGY_IDS.length) {
    failAdviser(
      "invalid_strategy",
      "strategy_portfolio",
      "The rule-based adviser requires the exact fixed KTS baseline portfolio.",
    );
  }
  for (const record of snapshot.strategies) {
    const definition = BASELINE_DEFINITIONS.find(
      (candidate) => candidate.strategyId === record.strategyId,
    );
    if (definition === undefined) {
      failAdviser(
        "invalid_strategy",
        "strategy_portfolio",
        "The rule-based adviser portfolio contains an unsupported strategy.",
      );
    }
    const expected = toDraft(definition as unknown as BaselineDefinition, {
      recordedAt: record.recordedAt,
      actorId: record.actorId,
      domainVersion: record.domainVersion,
    });
    const { strategySchemaId, strategySchemaVersion, contentDigest, ...actual } = record;
    if (
      strategySchemaId !== "construct.strategy" ||
      strategySchemaVersion !== 1 ||
      !/^[a-f0-9]{64}$/.test(contentDigest) ||
      canonicalStringify(actual) !== canonicalStringify(expected)
    ) {
      failAdviser(
        "invalid_strategy",
        "strategy_portfolio",
        "The rule-based adviser portfolio differs from the fixed KTS baseline definitions.",
      );
    }
  }
}

export function evaluateKtsStrategyApplicability(
  observation: Readonly<KtsObservationPacket>,
  strategy: Readonly<StrategyRecord>,
): Readonly<StrategyApplicabilityResult> {
  const base = {
    strategyId: strategy.strategyId,
    strategyVersion: strategy.strategyVersion,
    evaluatorId: "kts-baseline-applicability",
    evaluatorVersion: "1",
    supportingEvidenceReferences: strategy.evidenceReferences,
  };
  if (
    observation.lifecycle.status !== "running" &&
    strategy.strategyId !== "uncertainty-safe-hold"
  ) {
    return Object.freeze({
      ...base,
      applicable: false,
      applicabilityBasisPoints: 0,
      satisfiedConstraints: Object.freeze([]),
      unsatisfiedConstraints: Object.freeze(["lifecycle.status:running"]),
      uncertaintyFlags: Object.freeze([]),
      supportingObservationReferences: Object.freeze(["lifecycle.status"]),
    });
  }
  switch (strategy.strategyId) {
    case "preserve-signal":
      return thresholdResult(
        base,
        observation.resources.signal.integrityBasisPoints,
        "resources.signal.integrityBasisPoints",
      );
    case "preserve-defence":
      return thresholdResult(
        base,
        observation.resources.defence.integrityBasisPoints,
        "resources.defence.integrityBasisPoints",
      );
    case "recover-resources": {
      const damaged =
        observation.resources.signal.integrityBasisPoints < 8_000 ||
        observation.resources.defence.integrityBasisPoints < 8_000;
      const applicable = observation.actionSpace.readiness.recoveryPulseReady && damaged;
      return result(
        base,
        applicable,
        applicable ? 8_000 : 0,
        [
          "actionSpace.readiness.recoveryPulseReady",
          "resources.signal.integrityBasisPoints",
          "resources.defence.integrityBasisPoints",
        ],
        applicable ? [] : ["recovery_ready_and_resource_damage"],
      );
    }
    case "rebalance-power": {
      const values = [
        observation.resources.power.weapons,
        observation.resources.power.defence,
        observation.resources.power.signal,
      ];
      const spread = Math.max(...values) - Math.min(...values);
      const applicable = observation.actionSpace.readiness.powerShiftReady && spread > 0;
      return result(
        base,
        applicable,
        applicable ? Math.min(7_500, 5_000 + spread * 100) : 0,
        ["actionSpace.readiness.powerShiftReady", "resources.power"],
        applicable ? [] : ["ready_imbalanced_power_channels"],
      );
    }
    case "reduce-projectile-threat": {
      const applicable = observation.entities.enemyProjectiles.length > 0;
      return result(
        base,
        applicable,
        applicable ? 9_000 : 0,
        ["entities.enemyProjectiles"],
        applicable ? [] : ["visible_enemy_projectile"],
      );
    }
    case "engage-nearest-enemy": {
      const applicable = observation.entities.enemies.length > 0;
      return result(
        base,
        applicable,
        applicable ? 6_500 : 0,
        ["entities.enemies"],
        applicable ? [] : ["visible_enemy"],
      );
    }
    case "advance-wave": {
      const applicable =
        observation.entities.enemies.length === 0 &&
        !observation.projection.entities.enemies.truncated &&
        !observation.lifecycle.encounterComplete;
      const uncertaintyFlags = observation.projection.entities.enemies.truncated
        ? ["enemy_projection_truncated"]
        : [];
      return Object.freeze({
        ...result(
          base,
          applicable,
          applicable ? 6_000 : 0,
          ["entities.enemies", "lifecycle.encounterComplete"],
          applicable ? [] : ["no_visible_enemy_and_encounter_active"],
        ),
        uncertaintyFlags: Object.freeze(uncertaintyFlags),
      });
    }
    case "uncertainty-safe-hold":
      return result(base, true, 1_000, ["metadata.observationId"], []);
    default:
      return result(base, false, 0, [], ["unsupported_kts_baseline"]);
  }
}

function toDraft(
  definition: Readonly<BaselineDefinition>,
  governance: Readonly<KtsBaselineStrategyGovernance>,
): StrategyDraft {
  return {
    strategyId: definition.strategyId,
    strategyVersion: KTS_BASELINE_STRATEGY_VERSION,
    domainId: "keep-the-signal",
    domainVersion: governance.domainVersion,
    family: definition.family,
    objective: definition.objective,
    triggerConditions: definition.triggerConditions,
    applicabilityConstraints: definition.applicabilityConstraints,
    actionPreferences: definition.actionPreferences,
    terminationConditions: [{ condition: "caller_or_new_observation" }],
    expectedEffects: definition.expectedEffects,
    knownFailureModes: definition.knownFailureModes,
    evidenceReferences: [],
    counterexampleReferences: [],
    confidenceBasisPoints: 5_000,
    calibrationState: "uncalibrated",
    evaluationSummaries: [],
    parentStrategies: [],
    portfolioPriority: definition.portfolioPriority,
    classification: "deterministic_baseline",
    recordedAt: governance.recordedAt,
    actorId: governance.actorId,
  };
}

function thresholdResult(
  base: Pick<
    StrategyApplicabilityResult,
    | "strategyId"
    | "strategyVersion"
    | "evaluatorId"
    | "evaluatorVersion"
    | "supportingEvidenceReferences"
  >,
  basisPoints: number,
  reference: string,
): Readonly<StrategyApplicabilityResult> {
  const applicable = basisPoints < 5_000;
  const score = applicable ? (basisPoints <= 2_500 ? 9_500 : 8_500) : 0;
  return result(
    base,
    applicable,
    score,
    [reference],
    applicable ? [] : [`${reference}:below:5000`],
  );
}

function result(
  base: Pick<
    StrategyApplicabilityResult,
    | "strategyId"
    | "strategyVersion"
    | "evaluatorId"
    | "evaluatorVersion"
    | "supportingEvidenceReferences"
  >,
  applicable: boolean,
  applicabilityBasisPoints: number,
  supportingObservationReferences: readonly string[],
  unsatisfiedConstraints: readonly string[],
): Readonly<StrategyApplicabilityResult> {
  return Object.freeze({
    ...base,
    applicable,
    applicabilityBasisPoints,
    satisfiedConstraints: Object.freeze(applicable ? ["explicit_kts_trigger"] : []),
    unsatisfiedConstraints: Object.freeze([...unsatisfiedConstraints]),
    uncertaintyFlags: Object.freeze([]),
    supportingObservationReferences: Object.freeze([...supportingObservationReferences]),
    supportingEvidenceReferences: Object.freeze([...base.supportingEvidenceReferences]),
  });
}

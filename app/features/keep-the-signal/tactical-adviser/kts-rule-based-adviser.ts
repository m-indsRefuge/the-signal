import {
  canonicalStringify,
  canonicalizeJson,
} from "../../intelligence-harness/memory-fabric/canonical-json";
import {
  SIGNAL_OFFICER_ADVISER_ROLE,
  requestContext,
  validateAdviserRequest,
  type AdviserRequest,
} from "../../intelligence-harness/tactical-adviser/adviser-contract";
import { failAdviser } from "../../intelligence-harness/tactical-adviser/failures";
import {
  createProposalEnvelope,
  type ProposalEnvelope,
} from "../../intelligence-harness/tactical-adviser/proposal-contract";
import {
  compareStrategyReferences,
  createStrategyApplicabilityResult,
  type StrategyRecord,
  type StrategyReference,
} from "../../intelligence-harness/tactical-adviser/strategy-contract";
import {
  StrategyPortfolio,
  type StrategyCandidate,
  type StrategySelectionReport,
} from "../../intelligence-harness/tactical-adviser/strategy-portfolio";
import type { DomainProposalValidation } from "../../intelligence-harness/tactical-adviser/adviser-coordinator";
import type { KtsObservationPacket, KtsPowerShiftReadiness } from "../intelligence-adapter";
import { canonicalizeKtsObservationForAdviser } from "./kts-model-context";
import {
  createKtsTacticalProposal,
  type KtsPowerTransferRecommendation,
  type KtsSupportingFact,
  type KtsTacticalProposal,
} from "./kts-proposal-contract";
import { validateKtsTacticalProposal } from "./kts-proposal-validator";
import {
  assertKtsBaselinePortfolio,
  evaluateKtsStrategyApplicability,
} from "./kts-strategy-portfolio";

export interface KtsRuleBasedAdviserInput {
  readonly request: Readonly<AdviserRequest>;
  readonly observation: Readonly<KtsObservationPacket>;
}

export interface KtsRuleBasedAdviserResult {
  readonly classification: "proposal" | "abstention" | "rejected";
  readonly proposal: Readonly<KtsTacticalProposal>;
  readonly envelope: Readonly<ProposalEnvelope<KtsTacticalProposal>>;
  readonly validation: Readonly<DomainProposalValidation>;
  readonly strategySelection: Readonly<StrategySelectionReport>;
}

export class KtsRuleBasedAdviser {
  readonly #strategies: readonly Readonly<StrategyRecord>[];
  #disposed = false;

  constructor(portfolio: StrategyPortfolio) {
    assertKtsBaselinePortfolio(portfolio);
    this.#strategies = portfolio.snapshot().strategies;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  advise(input: Readonly<KtsRuleBasedAdviserInput>): Readonly<KtsRuleBasedAdviserResult> {
    if (this.#disposed) {
      failAdviser(
        "adviser_disposed",
        "lifecycle",
        "The KTS rule-based adviser is disposed.",
        requestContext(input.request),
      );
    }
    validateAdviserRequest(input.request, SIGNAL_OFFICER_ADVISER_ROLE);
    const observation = canonicalizeKtsObservationForAdviser(input.request, input.observation);
    const strategySelection = selectFixedBaselineStrategies(
      this.#strategies,
      observation,
      input.request.strategyCandidateBudget,
    );
    const canonicalInput = Object.freeze({ request: input.request, observation });
    const proposal = createKtsTacticalProposal(buildProposal(canonicalInput, strategySelection));
    const validation = validateKtsTacticalProposal({
      proposal,
      request: input.request,
      observation,
      strategyCandidates: strategySelection.candidates,
      allowedEvidenceIds: [],
      allowedMemoryIds: [],
      allowedContradictionIds: [],
      maximumReasonCharacters: input.request.contextBudget.maximumReasonCharacters,
    });
    const envelope = createProposalEnvelope({
      proposalId: proposal.proposalId,
      proposalSchemaId: proposal.proposalSchemaId,
      proposalSchemaVersion: proposal.proposalSchemaVersion,
      adviserRequestId: proposal.adviserRequestId,
      invocationId: input.request.invocationId,
      domainId: input.request.domainId,
      domainVersion: input.request.domainVersion,
      observationId: proposal.observationId,
      observationSourceStateDigest: proposal.sourceStateDigest,
      adviserRoleId: input.request.roleId,
      adviserRoleVersion: input.request.roleVersion,
      proposerKind: "rule_based_baseline",
      proposerIdentity: { baselineId: "kts-rule-based-adviser", baselineVersion: "1" },
      ...(proposal.selectedStrategy === null
        ? {}
        : { selectedStrategy: proposal.selectedStrategy }),
      payload: proposal,
      confidenceBasisPoints: proposal.confidenceBasisPoints,
      uncertainty: proposal.uncertainty,
      abstention: proposal.abstention,
      publicReason: proposal.reason,
      evidenceReferences: proposal.evidenceReferences,
      strategyReferences: proposal.selectedStrategy === null ? [] : [proposal.selectedStrategy],
      provenance: {
        adviserKind: "deterministic_rule_based",
        modelUsed: false,
        memoryUsed: false,
        actionExecuted: false,
      },
      validationClassification: validation.classification,
    });
    return Object.freeze({
      classification:
        validation.classification === "advisory_rejected"
          ? "rejected"
          : validation.classification === "abstained"
            ? "abstention"
            : "proposal",
      proposal,
      envelope,
      validation,
      strategySelection,
    });
  }

  dispose(): void {
    this.#disposed = true;
  }
}

function selectFixedBaselineStrategies(
  strategies: readonly Readonly<StrategyRecord>[],
  observation: Readonly<KtsObservationPacket>,
  budget: Readonly<AdviserRequest["strategyCandidateBudget"]>,
): Readonly<StrategySelectionReport> {
  const evaluated = strategies.map((strategy) => ({
    strategy,
    applicability: createStrategyApplicabilityResult(
      evaluateKtsStrategyApplicability(observation, strategy),
    ),
    characters: canonicalStringify(strategy).length,
  }));
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
  let serializedCharacters = 0;
  for (const candidate of applicable) {
    if (
      candidates.length >= budget.maximumStrategies ||
      serializedCharacters + candidate.characters > budget.maximumSerializedCharacters
    ) {
      continue;
    }
    candidates.push({
      strategy: candidate.strategy,
      applicability: candidate.applicability,
    });
    serializedCharacters += candidate.characters;
  }
  return canonicalizeJson({
    candidates,
    evaluatedCount: evaluated.length,
    applicableCount: applicable.length,
    omittedCount: applicable.length - candidates.length,
    serializedCharacters,
    truncated: candidates.length < applicable.length,
    orderingPolicy: "applicable_then_applicability_desc_priority_desc_strategy_id_asc_version_asc",
  }) as unknown as Readonly<StrategySelectionReport>;
}

function buildProposal(
  input: Readonly<KtsRuleBasedAdviserInput>,
  selection: Readonly<StrategySelectionReport>,
): KtsTacticalProposal {
  const observation = input.observation;
  const candidate = selection.candidates[0];
  if (observation.lifecycle.status !== "running" || candidate === undefined) {
    return proposalBase(input, candidate, {
      intent: "hold",
      reason: "The baseline abstains because no active evidence-supported decision is available.",
      confidenceBasisPoints: 1_000,
      uncertainty: "unknown",
      abstention: { abstained: true, code: "unsafe_to_recommend" },
      supportingFacts: [
        {
          kind: "observation_field",
          path: "lifecycle.status",
          value: observation.lifecycle.status,
        },
      ],
    });
  }
  switch (candidate.strategy.strategyId) {
    case "preserve-signal":
      return proposalBase(input, candidate, {
        intent: "preserve_signal",
        reason: "Signal integrity is low, so the baseline prioritizes Signal preservation.",
        confidenceBasisPoints: candidate.applicability.applicabilityBasisPoints,
        uncertainty: "medium",
        powerTransferRecommendation: transferToward(observation, "signal"),
        supportingFacts: [
          observationFact(
            "resources.signal.integrityBasisPoints",
            observation.resources.signal.integrityBasisPoints,
          ),
          strategyFact(candidate),
        ],
      });
    case "preserve-defence":
      return proposalBase(input, candidate, {
        intent: "preserve_defence",
        reason: "Defence integrity is low, so the baseline prioritizes Defence preservation.",
        confidenceBasisPoints: candidate.applicability.applicabilityBasisPoints,
        uncertainty: "medium",
        powerTransferRecommendation: transferToward(observation, "defence"),
        supportingFacts: [
          observationFact(
            "resources.defence.integrityBasisPoints",
            observation.resources.defence.integrityBasisPoints,
          ),
          strategyFact(candidate),
        ],
      });
    case "recover-resources":
      return proposalBase(input, candidate, {
        intent: "recover",
        reason: "Recovery is ready while a bounded resource observation shows damage.",
        confidenceBasisPoints: 8_000,
        uncertainty: "low",
        recoveryRecommendation: "activate_now",
        supportingFacts: [
          readinessFact("actionSpace.readiness.recoveryPulseReady", true),
          strategyFact(candidate),
        ],
      });
    case "rebalance-power":
      return proposalBase(input, candidate, {
        intent: "rebalance_power",
        reason: "A readiness-consistent transfer can reduce the observed power imbalance.",
        confidenceBasisPoints: candidate.applicability.applicabilityBasisPoints,
        uncertainty: "medium",
        powerTransferRecommendation: rebalanceTransfer(observation),
        supportingFacts: [
          readinessFact("actionSpace.readiness.powerShiftReady", true),
          strategyFact(candidate),
        ],
      });
    case "reduce-projectile-threat": {
      const projectile = nearestProjectile(observation);
      return proposalBase(input, candidate, {
        intent: "reduce_threat",
        reason: "A visible hostile projectile is the highest-priority bounded threat.",
        confidenceBasisPoints: 9_000,
        uncertainty: "low",
        movement: {
          moveX: projectile.positionX >= observation.player.positionX ? -1 : 1,
          moveY: projectile.positionY >= observation.player.positionY ? -1 : 1,
          priority: "high",
        },
        target: { kind: "enemy_projectile", entityId: projectile.id, priority: "high" },
        supportingFacts: [
          { kind: "entity", entityKind: "enemy_projectile", entityId: projectile.id },
          strategyFact(candidate),
        ],
      });
    }
    case "engage-nearest-enemy": {
      const enemy = nearestEnemy(observation);
      const fireReady = observation.actionSpace.readiness.fireReady;
      return proposalBase(input, candidate, {
        intent: "engage_target",
        reason: "The nearest visible enemy is the baseline engagement target.",
        confidenceBasisPoints: 6_500,
        uncertainty: "medium",
        fireRecommendation: fireReady ? "fire_now" : "conditional",
        target: { kind: "enemy", entityId: enemy.id, priority: "high" },
        supportingFacts: [
          { kind: "entity", entityKind: "enemy", entityId: enemy.id },
          readinessFact("actionSpace.readiness.fireReady", fireReady),
          strategyFact(candidate),
        ],
      });
    }
    case "advance-wave":
      return proposalBase(input, candidate, {
        intent: "advance_wave",
        reason: "No visible enemy blocks bounded encounter progress.",
        confidenceBasisPoints: 6_000,
        uncertainty: observation.projection.entities.enemies.truncated ? "high" : "medium",
        movement: { moveX: 0, moveY: -1, priority: "medium" },
        supportingFacts: [
          observationFact("lifecycle.encounterComplete", observation.lifecycle.encounterComplete),
          strategyFact(candidate),
        ],
        warnings: observation.projection.entities.enemies.truncated
          ? ["enemy_projection_truncated"]
          : [],
      });
    default:
      return proposalBase(input, candidate, {
        intent: "hold",
        reason: "The uncertainty-safe baseline recommends holding without action execution.",
        confidenceBasisPoints: 2_000,
        uncertainty: "high",
        supportingFacts: [
          observationFact("metadata.observationId", observation.metadata.observationId),
          strategyFact(candidate),
        ],
      });
  }
}

interface ProposalOverrides {
  readonly intent: KtsTacticalProposal["intent"];
  readonly reason: string;
  readonly confidenceBasisPoints: number;
  readonly uncertainty: KtsTacticalProposal["uncertainty"];
  readonly abstention?: KtsTacticalProposal["abstention"];
  readonly movement?: KtsTacticalProposal["movement"];
  readonly fireRecommendation?: KtsTacticalProposal["fireRecommendation"];
  readonly powerTransferRecommendation?: KtsTacticalProposal["powerTransferRecommendation"];
  readonly recoveryRecommendation?: KtsTacticalProposal["recoveryRecommendation"];
  readonly target?: KtsTacticalProposal["target"];
  readonly supportingFacts: readonly Readonly<KtsSupportingFact>[];
  readonly warnings?: readonly string[];
}

function proposalBase(
  input: Readonly<KtsRuleBasedAdviserInput>,
  candidate: Readonly<StrategyCandidate> | undefined,
  overrides: Readonly<ProposalOverrides>,
): KtsTacticalProposal {
  const selectedStrategy: StrategyReference | null =
    candidate === undefined
      ? null
      : {
          strategyId: candidate.strategy.strategyId,
          strategyVersion: candidate.strategy.strategyVersion,
        };
  return {
    proposalId: input.request.proposalId,
    proposalSchemaId: "kts.tactical-proposal",
    proposalSchemaVersion: "1",
    adviserRequestId: input.request.adviserRequestId,
    observationId: input.observation.metadata.observationId,
    sourceStateDigest: input.observation.metadata.sourceStateDigest,
    intent: overrides.intent,
    movement: overrides.movement ?? { moveX: 0, moveY: 0, priority: "low" },
    fireRecommendation: overrides.fireRecommendation ?? "hold_fire",
    powerTransferRecommendation: overrides.powerTransferRecommendation ?? "none",
    recoveryRecommendation: overrides.recoveryRecommendation ?? "hold",
    target: overrides.target ?? { kind: "none", priority: "low" },
    selectedStrategy,
    confidenceBasisPoints: overrides.confidenceBasisPoints,
    uncertainty: overrides.uncertainty,
    abstention: overrides.abstention ?? { abstained: false },
    reason: overrides.reason,
    supportingFacts: overrides.supportingFacts,
    evidenceReferences: [],
    contradictionReferences: [],
    warnings: overrides.warnings ?? ["advisory_only_not_final_engine_legality"],
  };
}

function observationFact(path: string, value: string | number | boolean): KtsSupportingFact {
  return { kind: "observation_field", path, value };
}

function readinessFact(path: string, ready: boolean): KtsSupportingFact {
  return { kind: "action_readiness", path, ready };
}

function strategyFact(candidate: Readonly<StrategyCandidate>): KtsSupportingFact {
  return {
    kind: "strategy",
    strategyId: candidate.strategy.strategyId,
    strategyVersion: candidate.strategy.strategyVersion,
  };
}

function transferToward(
  observation: Readonly<KtsObservationPacket>,
  target: "defence" | "signal",
): KtsPowerTransferRecommendation {
  const options = observation.actionSpace.readiness.powerShiftOptions
    .filter((option) => option.to === target && option.ready)
    .sort(
      (left, right) =>
        observation.resources.power[right.from] - observation.resources.power[left.from] ||
        left.from.localeCompare(right.from),
    );
  return optionToRecommendation(options[0]);
}

function rebalanceTransfer(
  observation: Readonly<KtsObservationPacket>,
): KtsPowerTransferRecommendation {
  const channels = ["weapons", "defence", "signal"] as const;
  const ordered = [...channels].sort(
    (left, right) =>
      observation.resources.power[right] - observation.resources.power[left] ||
      left.localeCompare(right),
  );
  const highest = ordered[0];
  const lowest = ordered[ordered.length - 1];
  const option = observation.actionSpace.readiness.powerShiftOptions.find(
    (candidate) => candidate.from === highest && candidate.to === lowest && candidate.ready,
  );
  return optionToRecommendation(option);
}

function optionToRecommendation(
  option: Readonly<KtsPowerShiftReadiness> | undefined,
): KtsPowerTransferRecommendation {
  if (option === undefined) return "none";
  return `${option.from}_to_${option.to}` as KtsPowerTransferRecommendation;
}

function nearestEnemy(observation: Readonly<KtsObservationPacket>) {
  return [...observation.entities.enemies].sort(
    (left, right) =>
      left.squaredDistanceFromPlayer - right.squaredDistanceFromPlayer || left.id - right.id,
  )[0]!;
}

function nearestProjectile(observation: Readonly<KtsObservationPacket>) {
  return [...observation.entities.enemyProjectiles].sort(
    (left, right) =>
      left.squaredDistanceFromPlayer - right.squaredDistanceFromPlayer || left.id - right.id,
  )[0]!;
}

export function cloneKtsRuleBasedResult(
  result: Readonly<KtsRuleBasedAdviserResult>,
): Readonly<KtsRuleBasedAdviserResult> {
  return canonicalizeJson(result) as unknown as Readonly<KtsRuleBasedAdviserResult>;
}

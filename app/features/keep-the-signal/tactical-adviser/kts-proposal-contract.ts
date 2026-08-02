import {
  canonicalizeJson,
  isPlainJsonRecord,
  type JsonObject,
  type JsonValue,
} from "../../intelligence-harness/memory-fabric/canonical-json";
import { isPublicIdentity } from "../../intelligence-harness/memory-fabric/evidence-contract";
import type {
  ProviderRawOutput,
  StructuredOutputContract,
} from "../../intelligence-harness/model-bridge";
import { SIGNAL_OFFICER_MAXIMUM_REASON_CHARACTERS } from "../../intelligence-harness/tactical-adviser/adviser-contract";
import { failAdviser } from "../../intelligence-harness/tactical-adviser/failures";
import {
  ABSTENTION_CODES,
  UNCERTAINTY_CLASSIFICATIONS,
  type AbstentionCode,
  type ProposalAbstention,
  type UncertaintyClassification,
} from "../../intelligence-harness/tactical-adviser/proposal-contract";
import type { StrategyReference } from "../../intelligence-harness/tactical-adviser/strategy-contract";

export const KTS_TACTICAL_PROPOSAL_SCHEMA_ID = "kts.tactical-proposal" as const;
export const KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION = "1" as const;

export const KTS_TACTICAL_INTENTS = Object.freeze([
  "preserve_signal",
  "preserve_defence",
  "recover",
  "rebalance_power",
  "reduce_threat",
  "engage_target",
  "advance_wave",
  "reposition",
  "hold",
  "observe",
] as const);
export type KtsTacticalIntent = (typeof KTS_TACTICAL_INTENTS)[number];

export const KTS_MOVEMENT_PRIORITIES = Object.freeze(["low", "medium", "high"] as const);
export type KtsMovementPriority = (typeof KTS_MOVEMENT_PRIORITIES)[number];

export const KTS_FIRE_RECOMMENDATIONS = Object.freeze([
  "fire_now",
  "hold_fire",
  "conditional",
  "not_applicable",
] as const);
export type KtsFireRecommendation = (typeof KTS_FIRE_RECOMMENDATIONS)[number];

export const KTS_RECOVERY_RECOMMENDATIONS = Object.freeze([
  "activate_now",
  "hold",
  "conditional",
  "not_applicable",
] as const);
export type KtsRecoveryRecommendation = (typeof KTS_RECOVERY_RECOMMENDATIONS)[number];

export const KTS_POWER_TRANSFER_RECOMMENDATIONS = Object.freeze([
  "none",
  "defence_to_signal",
  "defence_to_weapons",
  "signal_to_defence",
  "signal_to_weapons",
  "weapons_to_defence",
  "weapons_to_signal",
] as const);
export type KtsPowerTransferRecommendation = (typeof KTS_POWER_TRANSFER_RECOMMENDATIONS)[number];

export const KTS_TARGET_KINDS = Object.freeze([
  "none",
  "enemy",
  "enemy_projectile",
  "area",
] as const);
export type KtsTargetKind = (typeof KTS_TARGET_KINDS)[number];

export interface KtsMovementRecommendation {
  readonly moveX: -1 | 0 | 1;
  readonly moveY: -1 | 0 | 1;
  readonly priority: KtsMovementPriority;
}

export interface KtsTargetRecommendation {
  readonly kind: KtsTargetKind;
  readonly entityId?: number;
  readonly priority: KtsMovementPriority;
}

export type KtsSupportingFact =
  | {
      readonly kind: "observation_field";
      readonly path: string;
      readonly value: JsonValue;
    }
  | {
      readonly kind: "entity";
      readonly entityKind: "enemy" | "enemy_projectile";
      readonly entityId: number;
    }
  | {
      readonly kind: "action_readiness";
      readonly path: string;
      readonly ready: boolean;
    }
  | ({ readonly kind: "strategy" } & StrategyReference)
  | { readonly kind: "evidence"; readonly evidenceId: string }
  | { readonly kind: "memory"; readonly memoryId: string }
  | { readonly kind: "contradiction"; readonly evidenceId: string };

export interface KtsTacticalProposal {
  readonly proposalId: string;
  readonly proposalSchemaId: typeof KTS_TACTICAL_PROPOSAL_SCHEMA_ID;
  readonly proposalSchemaVersion: typeof KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION;
  readonly adviserRequestId: string;
  readonly observationId: string;
  readonly sourceStateDigest: string;
  readonly intent: KtsTacticalIntent;
  readonly movement: Readonly<KtsMovementRecommendation>;
  readonly fireRecommendation: KtsFireRecommendation;
  readonly powerTransferRecommendation: KtsPowerTransferRecommendation;
  readonly recoveryRecommendation: KtsRecoveryRecommendation;
  readonly target: Readonly<KtsTargetRecommendation>;
  readonly selectedStrategy: Readonly<StrategyReference> | null;
  readonly confidenceBasisPoints: number;
  readonly uncertainty: UncertaintyClassification;
  readonly abstention: Readonly<ProposalAbstention>;
  readonly reason: string;
  readonly supportingFacts: readonly Readonly<KtsSupportingFact>[];
  readonly evidenceReferences: readonly string[];
  readonly contradictionReferences: readonly string[];
  readonly warnings: readonly string[];
}

const PROPOSAL_KEYS = Object.freeze([
  "proposalId",
  "proposalSchemaId",
  "proposalSchemaVersion",
  "adviserRequestId",
  "observationId",
  "sourceStateDigest",
  "intent",
  "movement",
  "fireRecommendation",
  "powerTransferRecommendation",
  "recoveryRecommendation",
  "target",
  "selectedStrategy",
  "confidenceBasisPoints",
  "uncertainty",
  "abstention",
  "reason",
  "supportingFacts",
  "evidenceReferences",
  "contradictionReferences",
  "warnings",
]);

export const KTS_TACTICAL_PROPOSAL_OUTPUT: StructuredOutputContract<KtsTacticalProposal> =
  Object.freeze({
    schemaId: KTS_TACTICAL_PROPOSAL_SCHEMA_ID,
    schemaVersion: KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION,
    purpose: "Return one bounded advisory Keep the Signal tactical proposal.",
    schema: canonicalizeJson({
      type: "object",
      additionalProperties: false,
      required: PROPOSAL_KEYS,
      properties: {
        proposalId: { type: "string" },
        proposalSchemaId: { const: KTS_TACTICAL_PROPOSAL_SCHEMA_ID },
        proposalSchemaVersion: { const: KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION },
        adviserRequestId: { type: "string" },
        observationId: { type: "string" },
        sourceStateDigest: { type: "string" },
        intent: { enum: KTS_TACTICAL_INTENTS },
        movement: { type: "object" },
        fireRecommendation: { enum: KTS_FIRE_RECOMMENDATIONS },
        powerTransferRecommendation: { enum: KTS_POWER_TRANSFER_RECOMMENDATIONS },
        recoveryRecommendation: { enum: KTS_RECOVERY_RECOMMENDATIONS },
        target: { type: "object" },
        selectedStrategy: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["strategyId", "strategyVersion"],
              properties: {
                strategyId: { type: "string" },
                strategyVersion: { type: "string" },
              },
            },
            { type: "null" },
          ],
        },
        confidenceBasisPoints: { type: "integer", minimum: 0, maximum: 10_000 },
        uncertainty: { enum: UNCERTAINTY_CLASSIFICATIONS },
        abstention: { type: "object" },
        reason: {
          type: "string",
          minLength: 1,
          maxLength: SIGNAL_OFFICER_MAXIMUM_REASON_CHARACTERS,
        },
        supportingFacts: { type: "array" },
        evidenceReferences: { type: "array" },
        contradictionReferences: { type: "array" },
        warnings: { type: "array" },
      },
    }) as JsonObject,
    strictness: "strict",
    decode(raw: ProviderRawOutput) {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    },
    validate: isKtsTacticalProposal,
  });

export function createKtsTacticalProposal(
  value: Readonly<KtsTacticalProposal>,
): Readonly<KtsTacticalProposal> {
  if (!isKtsTacticalProposal(value)) {
    failAdviser("invalid_proposal", "proposal_validation", "KTS tactical proposal is invalid.");
  }
  return canonicalizeJson(value) as unknown as Readonly<KtsTacticalProposal>;
}

export function isKtsTacticalProposal(value: unknown): value is KtsTacticalProposal {
  if (!isPlainJsonRecord(value) || !hasExactKeys(value, PROPOSAL_KEYS)) return false;
  if (
    !isPublicIdentity(value.proposalId) ||
    value.proposalSchemaId !== KTS_TACTICAL_PROPOSAL_SCHEMA_ID ||
    value.proposalSchemaVersion !== KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION ||
    !isPublicIdentity(value.adviserRequestId) ||
    !isPublicIdentity(value.observationId) ||
    typeof value.sourceStateDigest !== "string" ||
    value.sourceStateDigest.length === 0 ||
    !KTS_TACTICAL_INTENTS.includes(value.intent as KtsTacticalIntent) ||
    !isMovement(value.movement) ||
    !KTS_FIRE_RECOMMENDATIONS.includes(value.fireRecommendation as KtsFireRecommendation) ||
    !KTS_POWER_TRANSFER_RECOMMENDATIONS.includes(
      value.powerTransferRecommendation as KtsPowerTransferRecommendation,
    ) ||
    !KTS_RECOVERY_RECOMMENDATIONS.includes(
      value.recoveryRecommendation as KtsRecoveryRecommendation,
    ) ||
    !isTarget(value.target) ||
    !(value.selectedStrategy === null || isExactStrategyReference(value.selectedStrategy)) ||
    !isBasisPoints(value.confidenceBasisPoints) ||
    !UNCERTAINTY_CLASSIFICATIONS.includes(value.uncertainty as UncertaintyClassification) ||
    !isAbstention(value.abstention) ||
    typeof value.reason !== "string" ||
    value.reason.length === 0 ||
    value.reason.length > SIGNAL_OFFICER_MAXIMUM_REASON_CHARACTERS ||
    !Array.isArray(value.supportingFacts) ||
    !value.supportingFacts.every(isSupportingFact) ||
    !isUniqueIdentities(value.evidenceReferences) ||
    !isUniqueIdentities(value.contradictionReferences) ||
    !isUniqueStrings(value.warnings)
  ) {
    return false;
  }
  try {
    canonicalizeJson(value);
    return true;
  } catch {
    return false;
  }
}

function isMovement(value: unknown): value is KtsMovementRecommendation {
  return (
    isPlainJsonRecord(value) &&
    hasExactKeys(value, ["moveX", "moveY", "priority"]) &&
    (value.moveX === -1 || value.moveX === 0 || value.moveX === 1) &&
    (value.moveY === -1 || value.moveY === 0 || value.moveY === 1) &&
    KTS_MOVEMENT_PRIORITIES.includes(value.priority as KtsMovementPriority)
  );
}

function isTarget(value: unknown): value is KtsTargetRecommendation {
  if (!isPlainJsonRecord(value)) return false;
  const kind = value.kind as KtsTargetKind;
  if (
    !KTS_TARGET_KINDS.includes(kind) ||
    !KTS_MOVEMENT_PRIORITIES.includes(value.priority as KtsMovementPriority)
  ) {
    return false;
  }
  if (kind === "enemy" || kind === "enemy_projectile") {
    return hasExactKeys(value, ["kind", "entityId", "priority"]) && isEntityId(value.entityId);
  }
  return hasExactKeys(value, ["kind", "priority"]);
}

function isAbstention(value: unknown): value is ProposalAbstention {
  if (!isPlainJsonRecord(value) || typeof value.abstained !== "boolean") return false;
  if (value.abstained) {
    return (
      hasExactKeys(value, ["abstained", "code"]) &&
      ABSTENTION_CODES.includes(value.code as AbstentionCode)
    );
  }
  return hasExactKeys(value, ["abstained"]);
}

function isSupportingFact(value: unknown): value is KtsSupportingFact {
  if (!isPlainJsonRecord(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "observation_field":
      return (
        hasExactKeys(value, ["kind", "path", "value"]) &&
        typeof value.path === "string" &&
        value.path.length > 0 &&
        isJson(value.value)
      );
    case "entity":
      return (
        hasExactKeys(value, ["kind", "entityKind", "entityId"]) &&
        (value.entityKind === "enemy" || value.entityKind === "enemy_projectile") &&
        isEntityId(value.entityId)
      );
    case "action_readiness":
      return (
        hasExactKeys(value, ["kind", "path", "ready"]) &&
        typeof value.path === "string" &&
        value.path.length > 0 &&
        typeof value.ready === "boolean"
      );
    case "strategy":
      return (
        hasExactKeys(value, ["kind", "strategyId", "strategyVersion"]) && isStrategyReference(value)
      );
    case "evidence":
    case "contradiction":
      return hasExactKeys(value, ["kind", "evidenceId"]) && isPublicIdentity(value.evidenceId);
    case "memory":
      return hasExactKeys(value, ["kind", "memoryId"]) && isPublicIdentity(value.memoryId);
    default:
      return false;
  }
}

function isStrategyReference(value: unknown): value is StrategyReference {
  return (
    isPlainJsonRecord(value) &&
    isPublicIdentity(value.strategyId) &&
    isPublicIdentity(value.strategyVersion)
  );
}

function isExactStrategyReference(value: unknown): value is StrategyReference {
  return (
    isPlainJsonRecord(value) &&
    hasExactKeys(value, ["strategyId", "strategyVersion"]) &&
    isStrategyReference(value)
  );
}

function isUniqueIdentities(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every(isPublicIdentity) && new Set(value).size === value.length
  );
}

function isUniqueStrings(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0) &&
    new Set(value).size === value.length
  );
}

function isBasisPoints(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 10_000;
}

function isEntityId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isJson(value: unknown): value is JsonValue {
  try {
    canonicalizeJson(value);
    return true;
  } catch {
    return false;
  }
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

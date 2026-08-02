import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import { isCanonicalUtcTimestamp, isPublicIdentity } from "../memory-fabric/evidence-contract";
import { failAdviser } from "./failures";

export const STRATEGY_SCHEMA_ID = "construct.strategy" as const;
export const STRATEGY_SCHEMA_VERSION = 1 as const;

export const STRATEGY_FAMILIES = Object.freeze([
  "preservation",
  "aggressive_progress",
  "recovery_management",
  "threat_avoidance",
  "uncertainty_safe",
  "long_horizon_planning",
  "diagnostic_exploration",
  "evidence_acquisition",
] as const);
export type StrategyFamily = (typeof STRATEGY_FAMILIES)[number];

export const STRATEGY_CLASSIFICATIONS = Object.freeze([
  "deterministic_baseline",
  "experimental_candidate",
  "accepted_production",
  "rejected",
  "quarantined",
  "superseded",
] as const);
export type StrategyClassification = (typeof STRATEGY_CLASSIFICATIONS)[number];

export const STRATEGY_CALIBRATION_STATES = Object.freeze([
  "unknown",
  "uncalibrated",
  "calibrating",
  "calibrated",
  "miscalibrated",
] as const);
export type StrategyCalibrationState = (typeof STRATEGY_CALIBRATION_STATES)[number];

export interface StrategyReference {
  readonly strategyId: string;
  readonly strategyVersion: string;
}

export interface StrategyDraft extends StrategyReference {
  readonly domainId: string;
  readonly domainVersion: string;
  readonly family: StrategyFamily;
  readonly objective: string;
  readonly triggerConditions: readonly JsonObject[];
  readonly applicabilityConstraints: readonly JsonObject[];
  readonly actionPreferences: JsonObject;
  readonly terminationConditions: readonly JsonObject[];
  readonly expectedEffects: readonly string[];
  readonly knownFailureModes: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly counterexampleReferences: readonly string[];
  readonly confidenceBasisPoints: number;
  readonly calibrationState: StrategyCalibrationState;
  readonly evaluationSummaries: readonly JsonValue[];
  readonly parentStrategies: readonly StrategyReference[];
  readonly portfolioPriority: number;
  readonly classification: StrategyClassification;
  readonly recordedAt: string;
  readonly actorId: string;
}

export interface StrategyRecord extends StrategyDraft {
  readonly strategySchemaId: typeof STRATEGY_SCHEMA_ID;
  readonly strategySchemaVersion: typeof STRATEGY_SCHEMA_VERSION;
  readonly contentDigest: string;
}

export interface StrategyApplicabilityResult extends StrategyReference {
  readonly applicable: boolean;
  readonly applicabilityBasisPoints: number;
  readonly satisfiedConstraints: readonly string[];
  readonly unsatisfiedConstraints: readonly string[];
  readonly uncertaintyFlags: readonly string[];
  readonly supportingObservationReferences: readonly string[];
  readonly supportingEvidenceReferences: readonly string[];
  readonly evaluatorId: string;
  readonly evaluatorVersion: string;
}

export type StrategyApplicabilityEvaluator = (
  strategy: Readonly<StrategyRecord>,
) => Readonly<StrategyApplicabilityResult>;

export async function createStrategyRecord(
  draft: Readonly<StrategyDraft>,
): Promise<Readonly<StrategyRecord>> {
  validateStrategyDraft(draft);
  const normalized = canonicalizeJson({
    strategySchemaId: STRATEGY_SCHEMA_ID,
    strategySchemaVersion: STRATEGY_SCHEMA_VERSION,
    ...draft,
    evidenceReferences: sortedUnique(draft.evidenceReferences),
    counterexampleReferences: sortedUnique(draft.counterexampleReferences),
    parentStrategies: [...draft.parentStrategies].sort(compareStrategyReferences),
  }) as unknown as Omit<StrategyRecord, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({ ...normalized, contentDigest }) as Readonly<StrategyRecord>;
}

export async function validateStrategyRecord(record: Readonly<StrategyRecord>): Promise<void> {
  if (
    record.strategySchemaId !== STRATEGY_SCHEMA_ID ||
    record.strategySchemaVersion !== STRATEGY_SCHEMA_VERSION
  ) {
    failAdviser(
      "invalid_strategy",
      "strategy_validation",
      "Strategy schema identity is unsupported.",
    );
  }
  validateStrategyDraft(record);
  const { contentDigest, ...content } = record;
  let valid = false;
  try {
    valid = await verifySha256Hex(canonicalStringify(content), contentDigest);
  } catch {
    failAdviser(
      "invalid_strategy_digest",
      "strategy_validation",
      "Strategy content digest is invalid.",
    );
  }
  if (!valid) {
    failAdviser(
      "invalid_strategy_digest",
      "strategy_validation",
      "Strategy content digest does not match its immutable content.",
    );
  }
}

export function createStrategyApplicabilityResult(
  result: Readonly<StrategyApplicabilityResult>,
): Readonly<StrategyApplicabilityResult> {
  validateStrategyReference(result);
  if (
    typeof result.applicable !== "boolean" ||
    !isBasisPoints(result.applicabilityBasisPoints) ||
    !isPublicIdentity(result.evaluatorId) ||
    !isPublicIdentity(result.evaluatorVersion)
  ) {
    failAdviser(
      "invalid_strategy",
      "strategy_validation",
      "Strategy applicability result is invalid.",
    );
  }
  for (const values of [
    result.satisfiedConstraints,
    result.unsatisfiedConstraints,
    result.uncertaintyFlags,
    result.supportingObservationReferences,
  ]) {
    if (!isUniqueNonEmptyStrings(values)) {
      failAdviser(
        "invalid_strategy",
        "strategy_validation",
        "Strategy applicability references must be unique non-empty strings.",
      );
    }
  }
  if (!isUniqueIdentities(result.supportingEvidenceReferences)) {
    failAdviser(
      "invalid_strategy",
      "strategy_validation",
      "Strategy applicability evidence references must be unique public identities.",
    );
  }
  return canonicalizeJson(result) as unknown as Readonly<StrategyApplicabilityResult>;
}

export function strategyIdentityKey(reference: Readonly<StrategyReference>): string {
  validateStrategyReference(reference);
  return `${reference.strategyId}\u0000${reference.strategyVersion}`;
}

export function compareStrategyReferences(
  left: Readonly<StrategyReference>,
  right: Readonly<StrategyReference>,
): number {
  const strategyIdOrder = compareCodeUnits(left.strategyId, right.strategyId);
  return strategyIdOrder === 0
    ? compareCodeUnits(left.strategyVersion, right.strategyVersion)
    : strategyIdOrder;
}

function compareCodeUnits(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function validateStrategyDraft(draft: Readonly<StrategyDraft>): void {
  validateStrategyReference(draft);
  if (!isPublicIdentity(draft.domainId) || !isPublicIdentity(draft.domainVersion)) {
    failAdviser(
      "invalid_strategy_identity",
      "strategy_validation",
      "Strategy domain identity is invalid.",
    );
  }
  if (!STRATEGY_FAMILIES.includes(draft.family)) {
    failAdviser("invalid_strategy", "strategy_validation", "Strategy family is unsupported.");
  }
  if (!STRATEGY_CLASSIFICATIONS.includes(draft.classification)) {
    failAdviser(
      "invalid_strategy",
      "strategy_validation",
      "Strategy classification is unsupported.",
    );
  }
  if (!STRATEGY_CALIBRATION_STATES.includes(draft.calibrationState)) {
    failAdviser(
      "invalid_strategy",
      "strategy_validation",
      "Strategy calibration state is unsupported.",
    );
  }
  if (
    !isNonEmptyString(draft.objective) ||
    !isBasisPoints(draft.confidenceBasisPoints) ||
    !Number.isSafeInteger(draft.portfolioPriority) ||
    !isCanonicalUtcTimestamp(draft.recordedAt) ||
    !isPublicIdentity(draft.actorId)
  ) {
    failAdviser("invalid_strategy", "strategy_validation", "Strategy scalar fields are invalid.");
  }
  if (
    !Array.isArray(draft.triggerConditions) ||
    !Array.isArray(draft.applicabilityConstraints) ||
    !Array.isArray(draft.terminationConditions) ||
    !isUniqueNonEmptyStrings(draft.expectedEffects) ||
    !isUniqueNonEmptyStrings(draft.knownFailureModes) ||
    !isUniqueIdentities(draft.evidenceReferences) ||
    !isUniqueIdentities(draft.counterexampleReferences) ||
    !Array.isArray(draft.evaluationSummaries) ||
    !Array.isArray(draft.parentStrategies)
  ) {
    failAdviser(
      "invalid_strategy",
      "strategy_validation",
      "Strategy collection fields are invalid.",
    );
  }
  draft.parentStrategies.forEach(validateStrategyReference);
  const parentKeys = draft.parentStrategies.map(strategyIdentityKey);
  if (new Set(parentKeys).size !== parentKeys.length) {
    failAdviser(
      "invalid_strategy",
      "strategy_validation",
      "Parent strategy references must be unique.",
    );
  }
  try {
    canonicalizeJson(draft.triggerConditions);
    canonicalizeJson(draft.applicabilityConstraints);
    canonicalizeJson(draft.actionPreferences);
    canonicalizeJson(draft.terminationConditions);
    canonicalizeJson(draft.evaluationSummaries);
  } catch {
    failAdviser(
      "invalid_strategy",
      "strategy_validation",
      "Strategy content must be JSON-compatible.",
    );
  }
}

function validateStrategyReference(reference: Readonly<StrategyReference>): void {
  if (!isPublicIdentity(reference.strategyId) || !isPublicIdentity(reference.strategyVersion)) {
    failAdviser(
      "invalid_strategy_identity",
      "strategy_validation",
      "Strategy identity is invalid.",
    );
  }
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

function isBasisPoints(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 10_000;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUniqueNonEmptyStrings(values: readonly string[]): boolean {
  return (
    Array.isArray(values) &&
    values.every(isNonEmptyString) &&
    new Set(values).size === values.length
  );
}

function isUniqueIdentities(values: readonly string[]): boolean {
  return (
    Array.isArray(values) &&
    values.every(isPublicIdentity) &&
    new Set(values).size === values.length
  );
}

import {
  canonicalizeJson,
  isPlainJsonRecord,
  type JsonObject,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isPublicIdentity } from "../memory-fabric/evidence-contract";
import { failAdviser, TacticalAdviserError } from "./failures";
import {
  PROPOSAL_VALIDATION_CLASSIFICATIONS,
  type ProposalValidationClassification,
} from "./proposal-contract";
import type { StrategyReference } from "./strategy-contract";

export const ADVISER_EVALUATION_CLASSIFICATIONS = Object.freeze([
  "no_adviser",
  "rule_based",
  "base_model_no_retrieval",
  "base_model_with_retrieval",
  "fine_tuned_model",
  "human_only",
  "human_with_adviser",
] as const);
export type AdviserEvaluationClassification = (typeof ADVISER_EVALUATION_CLASSIFICATIONS)[number];

export const ADVISER_METRIC_NAMES = Object.freeze([
  "schema_compliance",
  "advisory_valid",
  "abstained",
  "unsupported_reference",
  "unsupported_certainty",
  "evidence_grounding",
  "strategy_reference_validity",
  "rejected_or_wasted_recommendation",
  "cancelled_or_deadline",
  "diagnostic_latency_milliseconds",
  "signal_retained",
  "defence_retained",
  "coherence",
  "score",
  "wave_completion",
  "labelled_success",
  "player_usefulness",
] as const);
export type AdviserMetricName = (typeof ADVISER_METRIC_NAMES)[number];

export type EvaluationMetricValues = Readonly<Partial<Record<AdviserMetricName, number | null>>>;

export interface EvaluationMatchIdentity {
  readonly seedOrEpisodeFamily: string;
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly observationSchemaId: string;
  readonly observationSchemaVersion: string;
  readonly observationLevel: number;
  readonly decisionPoint: string;
  readonly partitionId: string;
}

export interface AdviserEvaluationCase {
  readonly caseId: string;
  readonly match: Readonly<EvaluationMatchIdentity>;
  readonly observationId: string;
  readonly adviserClassification: AdviserEvaluationClassification;
  readonly proposerIdentity: JsonObject;
  readonly strategyReferences: readonly StrategyReference[];
  readonly retrievalEnabled: boolean;
  readonly proposal: JsonValue | null;
  readonly proposalValidation: ProposalValidationClassification | "not_applicable";
  readonly authoritativeDecisionEvidence?: JsonValue;
  readonly authoritativeOutcomeEvidence?: JsonValue;
  readonly humanUsefulnessBasisPoints?: number;
  readonly metricValues: EvaluationMetricValues;
  readonly evaluatorId: string;
  readonly evaluatorVersion: string;
}

export interface EvaluationMetricSummary {
  readonly metric: AdviserMetricName;
  readonly knownCount: number;
  readonly unknownCount: number;
  readonly mean: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
}

export interface AdviserEvaluationReport {
  readonly caseCount: number;
  readonly classificationCounts: Readonly<Record<AdviserEvaluationClassification, number>>;
  readonly metrics: readonly Readonly<EvaluationMetricSummary>[];
  readonly schemaComplianceBasisPoints: number | null;
  readonly advisoryValidBasisPoints: number | null;
  readonly abstentionBasisPoints: number | null;
  readonly confidenceCalibrationMeanAbsoluteError: number | null;
  readonly boundedCaseLimit: number;
}

export interface MatchedEvaluationDifference {
  readonly leftCaseId: string;
  readonly rightCaseId: string;
  readonly match: Readonly<EvaluationMatchIdentity>;
  readonly metricDifferences: Readonly<Partial<Record<AdviserMetricName, number | null>>>;
  readonly interpretation: "descriptive_only";
}

export function createEvaluationCase(
  draft: Readonly<AdviserEvaluationCase>,
): Readonly<AdviserEvaluationCase> {
  try {
    return createValidatedEvaluationCase(draft as unknown);
  } catch (error) {
    if (
      error instanceof TacticalAdviserError &&
      error.failure.code === "evaluation_invalid" &&
      error.failure.stage === "evaluation"
    ) {
      throw error;
    }
    failAdviser("evaluation_invalid", "evaluation", "Evaluation case runtime input is invalid.");
  }
}

function createValidatedEvaluationCase(value: unknown): Readonly<AdviserEvaluationCase> {
  if (!isPlainJsonRecord(value) || !isPlainJsonRecord(value.match)) {
    failAdviser("evaluation_invalid", "evaluation", "Evaluation case shape is invalid.");
  }
  const match = value.match;
  const identities = [
    value.caseId,
    match.seedOrEpisodeFamily,
    match.engineVersion,
    match.rulesetVersion,
    match.observationSchemaId,
    match.observationSchemaVersion,
    match.decisionPoint,
    match.partitionId,
    value.observationId,
    value.evaluatorId,
    value.evaluatorVersion,
  ];
  if (
    identities.some((value) => !isPublicIdentity(value)) ||
    !Number.isSafeInteger(match.observationLevel) ||
    (match.observationLevel as number) < 0 ||
    !ADVISER_EVALUATION_CLASSIFICATIONS.includes(
      value.adviserClassification as AdviserEvaluationClassification,
    ) ||
    typeof value.retrievalEnabled !== "boolean" ||
    ![...PROPOSAL_VALIDATION_CLASSIFICATIONS, "not_applicable"].includes(
      value.proposalValidation as ProposalValidationClassification | "not_applicable",
    )
  ) {
    failAdviser("evaluation_invalid", "evaluation", "Evaluation case identity is invalid.");
  }
  if (
    value.humanUsefulnessBasisPoints !== undefined &&
    (!Number.isSafeInteger(value.humanUsefulnessBasisPoints) ||
      (value.humanUsefulnessBasisPoints as number) < 0 ||
      (value.humanUsefulnessBasisPoints as number) > 10_000)
  ) {
    failAdviser(
      "evaluation_invalid",
      "evaluation",
      "Human usefulness rating must be basis points.",
    );
  }
  if (!isPlainJsonRecord(value.metricValues)) {
    failAdviser("evaluation_invalid", "evaluation", "Evaluation metrics must be a JSON record.");
  }
  for (const [metric, metricValue] of Object.entries(value.metricValues)) {
    if (
      !ADVISER_METRIC_NAMES.includes(metric as AdviserMetricName) ||
      (metricValue !== null && (typeof metricValue !== "number" || !Number.isFinite(metricValue)))
    ) {
      failAdviser("evaluation_invalid", "evaluation", "Evaluation metric value is invalid.");
    }
  }
  if (!Array.isArray(value.strategyReferences)) {
    failAdviser(
      "evaluation_invalid",
      "evaluation",
      "Evaluation strategy references must be an array.",
    );
  }
  const strategyKeys = value.strategyReferences.map((reference) => {
    if (
      !isPlainJsonRecord(reference) ||
      !hasExactKeys(reference, ["strategyId", "strategyVersion"]) ||
      !isPublicIdentity(reference.strategyId) ||
      !isPublicIdentity(reference.strategyVersion)
    ) {
      failAdviser("evaluation_invalid", "evaluation", "Evaluation strategy reference is invalid.");
    }
    return `${reference.strategyId}\u0000${reference.strategyVersion}`;
  });
  if (new Set(strategyKeys).size !== strategyKeys.length) {
    failAdviser(
      "evaluation_invalid",
      "evaluation",
      "Evaluation strategy references must be unique.",
    );
  }
  if (
    !isPlainJsonRecord(value.proposerIdentity) ||
    !isJsonCompatible(value.proposerIdentity) ||
    !isJsonCompatible(value.proposal) ||
    !isOptionalJsonCompatible(value.authoritativeDecisionEvidence) ||
    !isOptionalJsonCompatible(value.authoritativeOutcomeEvidence)
  ) {
    failAdviser(
      "evaluation_invalid",
      "evaluation",
      "Evaluation evidence values must be JSON-compatible.",
    );
  }
  try {
    return canonicalizeJson(value) as unknown as Readonly<AdviserEvaluationCase>;
  } catch {
    failAdviser("evaluation_invalid", "evaluation", "Evaluation case must be JSON-compatible.");
  }
}

function isJsonCompatible(value: unknown): boolean {
  try {
    canonicalizeJson(value);
    return true;
  } catch {
    return false;
  }
}

function isOptionalJsonCompatible(value: unknown): boolean {
  return value === undefined || isJsonCompatible(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

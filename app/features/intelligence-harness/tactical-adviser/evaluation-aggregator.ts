import { canonicalizeJson } from "../memory-fabric/canonical-json";
import { failAdviser } from "./failures";
import {
  ADVISER_EVALUATION_CLASSIFICATIONS,
  ADVISER_METRIC_NAMES,
  createEvaluationCase,
  type AdviserEvaluationCase,
  type AdviserEvaluationClassification,
  type AdviserEvaluationReport,
  type AdviserMetricName,
  type EvaluationMatchIdentity,
  type EvaluationMetricSummary,
  type MatchedEvaluationDifference,
} from "./evaluation-contract";

export interface EvaluationAggregationBudget {
  readonly maximumCases: number;
}

export function aggregateEvaluationCases(
  cases: readonly Readonly<AdviserEvaluationCase>[],
  budget: Readonly<EvaluationAggregationBudget>,
): Readonly<AdviserEvaluationReport> {
  if (!Number.isSafeInteger(budget.maximumCases) || budget.maximumCases < 1) {
    failAdviser("evaluation_invalid", "evaluation", "Evaluation case budget is invalid.");
  }
  if (cases.length > budget.maximumCases) {
    failAdviser(
      "evaluation_invalid",
      "evaluation",
      "Evaluation case count exceeds the explicit budget.",
    );
  }
  const normalized = cases.map(createEvaluationCase);
  const caseIds = normalized.map((entry) => entry.caseId);
  if (new Set(caseIds).size !== caseIds.length) {
    failAdviser("evaluation_invalid", "evaluation", "Evaluation case identities must be unique.");
  }
  const classificationCounts = Object.fromEntries(
    ADVISER_EVALUATION_CLASSIFICATIONS.map((classification) => [classification, 0]),
  ) as Record<AdviserEvaluationClassification, number>;
  for (const entry of normalized) classificationCounts[entry.adviserClassification] += 1;

  const metrics = ADVISER_METRIC_NAMES.map((metric) => summarizeMetric(normalized, metric));
  const report: AdviserEvaluationReport = {
    caseCount: normalized.length,
    classificationCounts,
    metrics,
    schemaComplianceBasisPoints: binaryRate(normalized, "schema_compliance"),
    advisoryValidBasisPoints: binaryRate(normalized, "advisory_valid"),
    abstentionBasisPoints: binaryRate(normalized, "abstained"),
    confidenceCalibrationMeanAbsoluteError: calibrationError(normalized),
    boundedCaseLimit: budget.maximumCases,
  };
  return canonicalizeJson(report) as unknown as Readonly<AdviserEvaluationReport>;
}

export function compareMatchedEvaluationCases(
  leftInput: Readonly<AdviserEvaluationCase>,
  rightInput: Readonly<AdviserEvaluationCase>,
): Readonly<MatchedEvaluationDifference> {
  const left = createEvaluationCase(leftInput);
  const right = createEvaluationCase(rightInput);
  if (!matches(left.match, right.match)) {
    failAdviser(
      "evaluation_pair_mismatch",
      "evaluation",
      "Evaluation cases are not compatible matched cases.",
    );
  }
  const metricDifferences: Partial<Record<AdviserMetricName, number | null>> = {};
  for (const metric of ADVISER_METRIC_NAMES) {
    const leftValue = left.metricValues[metric];
    const rightValue = right.metricValues[metric];
    metricDifferences[metric] =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? rightValue - leftValue
        : null;
  }
  return canonicalizeJson({
    leftCaseId: left.caseId,
    rightCaseId: right.caseId,
    match: left.match,
    metricDifferences,
    interpretation: "descriptive_only",
  }) as unknown as Readonly<MatchedEvaluationDifference>;
}

export function evaluationMatches(
  left: Readonly<EvaluationMatchIdentity>,
  right: Readonly<EvaluationMatchIdentity>,
): boolean {
  return matches(left, right);
}

function summarizeMetric(
  cases: readonly Readonly<AdviserEvaluationCase>[],
  metric: AdviserMetricName,
): Readonly<EvaluationMetricSummary> {
  const values = cases
    .map((entry) => suppliedMetric(entry, metric))
    .filter((value): value is number => typeof value === "number");
  return Object.freeze({
    metric,
    knownCount: values.length,
    unknownCount: cases.length - values.length,
    mean:
      values.length === 0
        ? null
        : values.reduce((total, value) => total + value, 0) / values.length,
    minimum: values.length === 0 ? null : Math.min(...values),
    maximum: values.length === 0 ? null : Math.max(...values),
  });
}

function suppliedMetric(
  entry: Readonly<AdviserEvaluationCase>,
  metric: AdviserMetricName,
): number | null | undefined {
  const explicit = entry.metricValues[metric];
  if (explicit !== undefined) return explicit;
  if (metric === "player_usefulness") return entry.humanUsefulnessBasisPoints;
  return undefined;
}

function binaryRate(
  cases: readonly Readonly<AdviserEvaluationCase>[],
  metric: AdviserMetricName,
): number | null {
  const values = cases
    .map((entry) => entry.metricValues[metric])
    .filter((value): value is number => value === 0 || value === 1);
  if (values.length === 0) return null;
  return Math.round((values.reduce((total, value) => total + value, 0) * 10_000) / values.length);
}

function calibrationError(cases: readonly Readonly<AdviserEvaluationCase>[]): number | null {
  const errors: number[] = [];
  for (const entry of cases) {
    const outcome = entry.metricValues.labelled_success;
    if (outcome !== 0 && outcome !== 1) continue;
    const confidence = proposalConfidence(entry.proposal);
    if (confidence === null) continue;
    errors.push(Math.abs(confidence - outcome * 10_000));
  }
  return errors.length === 0
    ? null
    : errors.reduce((total, value) => total + value, 0) / errors.length;
}

function proposalConfidence(proposal: AdviserEvaluationCase["proposal"]): number | null {
  if (typeof proposal !== "object" || proposal === null || Array.isArray(proposal)) return null;
  const value = (proposal as Readonly<Record<string, unknown>>).confidenceBasisPoints;
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 10_000
    ? (value as number)
    : null;
}

function matches(
  left: Readonly<EvaluationMatchIdentity>,
  right: Readonly<EvaluationMatchIdentity>,
): boolean {
  return (
    left.seedOrEpisodeFamily === right.seedOrEpisodeFamily &&
    left.engineVersion === right.engineVersion &&
    left.rulesetVersion === right.rulesetVersion &&
    left.observationSchemaId === right.observationSchemaId &&
    left.observationSchemaVersion === right.observationSchemaVersion &&
    left.observationLevel === right.observationLevel &&
    left.decisionPoint === right.decisionPoint &&
    left.partitionId === right.partitionId
  );
}

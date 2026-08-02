import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export const EVALUATION_PARTITIONS = Object.freeze([
  "validation",
  "test",
  "unseen_seed",
  "version_boundary",
  "failure_correction",
  "abstention",
] as const);
export type EvaluationPartition = (typeof EVALUATION_PARTITIONS)[number];
export const BASELINE_KINDS = Object.freeze([
  "no_adviser",
  "rule_based_adviser",
  "base_model_without_retrieval",
  "base_model_with_retrieval",
  "fine_tuned_without_retrieval",
  "fine_tuned_with_retrieval",
] as const);
export type BaselineKind = (typeof BASELINE_KINDS)[number];
export interface EvaluationCase {
  readonly caseId: string;
  readonly partition: EvaluationPartition;
  readonly seed?: number;
  readonly sourceReference: string;
}
export interface EvaluationPlanDraft {
  readonly planId: string;
  readonly planVersion: string;
  readonly baselines: readonly BaselineKind[];
  readonly cases: readonly EvaluationCase[];
  readonly requiredMetricNames: readonly string[];
  readonly maximumCases: number;
}
export interface EvaluationPlan extends EvaluationPlanDraft {
  readonly planDigest: string;
}
export async function createEvaluationPlan(
  draft: Readonly<EvaluationPlanDraft>,
): Promise<Readonly<EvaluationPlan>> {
  validateFineTuningIdentity(draft.planId, "evaluationPlanId", "evaluation_invalid");
  validateFineTuningIdentity(draft.planVersion, "evaluationPlanVersion", "evaluation_invalid");
  if (
    draft.cases.length === 0 ||
    draft.baselines.length < 2 ||
    !Number.isSafeInteger(draft.maximumCases) ||
    draft.maximumCases < 1 ||
    draft.cases.length > draft.maximumCases ||
    draft.cases.some((c) => !EVALUATION_PARTITIONS.includes(c.partition))
  )
    failFineTuning("evaluation_invalid", "evaluation", "Evaluation plan is invalid.");
  const normalized = canonicalizeJson({
    ...draft,
    baselines: [...new Set(draft.baselines)].sort(),
    cases: [...draft.cases].sort((a, b) =>
      a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0,
    ),
    requiredMetricNames: [...new Set(draft.requiredMetricNames)].sort(),
  }) as unknown as EvaluationPlanDraft;
  const planDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    planDigest,
  } as unknown as JsonValue) as unknown as Readonly<EvaluationPlan>;
}

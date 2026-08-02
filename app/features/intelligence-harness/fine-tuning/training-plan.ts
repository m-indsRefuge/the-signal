import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isSha256Hex, sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity, validateCanonicalTimestamp } from "./failures";
import {
  validateTrainingMethodConfiguration,
  type TrainingMethodConfiguration,
} from "./training-method-contract";
import {
  validateHyperparameterConfiguration,
  type HyperparameterConfiguration,
} from "./hyperparameter-contract";
import { validateResourceBudget, type ResourceBudget } from "./resource-budget";
export interface TrainingPlanDraft {
  readonly planId: string;
  readonly planVersion: string;
  readonly experimentId: string;
  readonly baseModelRecordDigest: string;
  readonly tokenizerRecordDigest: string;
  readonly datasetApprovalDigest: string;
  readonly environmentRecordDigest: string;
  readonly method: TrainingMethodConfiguration;
  readonly hyperparameters: HyperparameterConfiguration;
  readonly resourceBudget: ResourceBudget;
  readonly seedSet: readonly number[];
  readonly outputDirectory: string;
  readonly loggingPolicy: "metrics_only" | "metrics_and_safe_summaries";
  readonly evaluationSchedule: readonly number[];
  readonly stopConditions: readonly string[];
  readonly failureRollbackProcedure: string;
  readonly networkPolicy: "offline";
  readonly externalUploadPolicy: "prohibited";
  readonly costCeilingMinorUnits: 0;
  readonly createdAt: string;
}
export interface TrainingPlan extends TrainingPlanDraft {
  readonly planDigest: string;
}
export async function createTrainingPlan(
  draft: Readonly<TrainingPlanDraft>,
): Promise<Readonly<TrainingPlan>> {
  for (const [l, v] of [
    ["planId", draft.planId],
    ["planVersion", draft.planVersion],
    ["experimentId", draft.experimentId],
    ["outputDirectory", draft.outputDirectory],
  ] as const)
    validateFineTuningIdentity(v, l, "invalid_training_plan");
  validateCanonicalTimestamp(draft.createdAt, "createdAt");
  if (
    [
      draft.baseModelRecordDigest,
      draft.tokenizerRecordDigest,
      draft.datasetApprovalDigest,
      draft.environmentRecordDigest,
    ].some((d) => !isSha256Hex(d)) ||
    draft.seedSet.length === 0 ||
    draft.seedSet.some((s) => !Number.isSafeInteger(s)) ||
    draft.evaluationSchedule.some((s) => !Number.isSafeInteger(s) || s < 1) ||
    draft.stopConditions.length === 0 ||
    draft.failureRollbackProcedure.trim().length < 8 ||
    draft.networkPolicy !== "offline" ||
    draft.externalUploadPolicy !== "prohibited" ||
    draft.costCeilingMinorUnits !== 0
  )
    failFineTuning("invalid_training_plan", "plan", "Training plan is invalid.");
  const method = validateTrainingMethodConfiguration(draft.method);
  const hyperparameters = validateHyperparameterConfiguration(draft.hyperparameters);
  const resourceBudget = validateResourceBudget(draft.resourceBudget);
  const normalized = canonicalizeJson({
    ...draft,
    method,
    hyperparameters,
    resourceBudget,
    seedSet: [...new Set(draft.seedSet)].sort((a, b) => a - b),
    evaluationSchedule: [...new Set(draft.evaluationSchedule)].sort((a, b) => a - b),
    stopConditions: [...new Set(draft.stopConditions)].sort(),
  }) as unknown as TrainingPlanDraft;
  const planDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    planDigest,
  } as unknown as JsonValue) as unknown as Readonly<TrainingPlan>;
}
export async function validateTrainingPlan(plan: Readonly<TrainingPlan>): Promise<void> {
  const { planDigest, ...body } = plan;
  if (!(await verifySha256Hex(canonicalStringify(body), planDigest)))
    failFineTuning("training_plan_digest_mismatch", "plan", "Training plan digest mismatch.");
}

import { canonicalStringify, deepFreezeJson } from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failTraining, validateTrainingIdentity } from "./failures";
import {
  CURRICULUM_STAGES,
  type CurriculumPlan,
  type CurriculumStagePlan,
  type SamplingDecision,
} from "./curriculum-contract";
import type { TrainingExample } from "./training-example-contract";
export async function createCurriculumPlan(
  planId: string,
  planVersion: string,
  stages: readonly CurriculumStagePlan[],
  knownRisks: readonly string[],
): Promise<Readonly<CurriculumPlan>> {
  validateTrainingIdentity(planId, "planId", "invalid_curriculum_plan", "curriculum");
  validateTrainingIdentity(planVersion, "planVersion", "invalid_curriculum_plan", "curriculum");
  const seen = new Set<string>();
  for (const stage of stages) {
    if (
      !CURRICULUM_STAGES.includes(stage.stage) ||
      seen.has(stage.stage) ||
      !Number.isSafeInteger(stage.maximumPerLineageFamily) ||
      stage.maximumPerLineageFamily < 1 ||
      !Number.isSafeInteger(stage.samplingBasisPoints) ||
      stage.samplingBasisPoints < 0 ||
      stage.samplingBasisPoints > 10000
    )
      failTraining("invalid_curriculum_plan", "curriculum", "Curriculum stage is invalid.");
    seen.add(stage.stage);
  }
  const normalizedStages = stages.map((s) => ({
    ...s,
    exampleKinds: [...new Set(s.exampleKinds)].sort(),
  }));
  const planDigest = await sha256Hex(
    canonicalStringify({
      planId,
      planVersion,
      stages: normalizedStages,
      knownRisks: [...new Set(knownRisks)].sort(),
    }),
  );
  return deepFreezeJson({
    planId,
    planVersion,
    stages: normalizedStages,
    knownRisks: [...new Set(knownRisks)].sort(),
    planDigest,
  }) as unknown as Readonly<CurriculumPlan>;
}
export async function createSamplingDecisions(
  examples: readonly Readonly<TrainingExample>[],
  plan: Readonly<CurriculumPlan>,
): Promise<readonly Readonly<SamplingDecision>[]> {
  const counts = new Map<string, number>();
  const decisions: SamplingDecision[] = [];
  for (const example of [...examples].sort((a, b) => (a.exampleId < b.exampleId ? -1 : 1))) {
    const stage =
      plan.stages.find((s) => s.exampleKinds.includes(example.exampleKind)) ?? plan.stages.at(-1);
    if (!stage) failTraining("invalid_sampling_plan", "curriculum", "Curriculum has no stage.");
    const key = `${stage.stage}:${example.lineageFamilyId}`;
    const count = counts.get(key) ?? 0;
    const bucket =
      Number.parseInt(
        (await sha256Hex(`${plan.planDigest}:${example.exampleId}`)).slice(0, 8),
        16,
      ) % 10000;
    const protectedBlocked =
      example.protectedSourceReferences.length > 0 &&
      stage.requireProtectedReview &&
      example.reviewerStatus !== "accepted";
    const included =
      !protectedBlocked &&
      count < stage.maximumPerLineageFamily &&
      bucket < stage.samplingBasisPoints;
    if (included) counts.set(key, count + 1);
    const reason = protectedBlocked
      ? "protected_review_required"
      : count >= stage.maximumPerLineageFamily
        ? "family_limit"
        : bucket >= stage.samplingBasisPoints
          ? "sampling_threshold"
          : "included";
    const decisionDigest = await sha256Hex(
      `${example.exampleId}:${stage.stage}:${included}:${reason}`,
    );
    decisions.push(
      Object.freeze({
        exampleId: example.exampleId,
        included,
        stage: stage.stage,
        reason,
        decisionDigest,
      }),
    );
  }
  return Object.freeze(decisions);
}

import type { JsonValue } from "../../intelligence-harness/memory-fabric/canonical-json";
import {
  buildAbstention,
  buildRetrievalGrounding,
  buildStrategyRouting,
  buildSupervisedTarget,
  type ExampleBuilderBase,
} from "../../intelligence-harness/training-evidence/training-example-builder";
import type { TrainingExample } from "../../intelligence-harness/training-evidence/training-example-contract";
import type { TargetRecord } from "../../intelligence-harness/training-evidence/target-contract";
import {
  KTS_TRAINING_TASKS,
  type KtsTrainingSource,
  type KtsTrainingTask,
} from "./kts-example-contract";
import { failTraining } from "../../intelligence-harness/training-evidence/failures";
function base(
  source: Readonly<KtsTrainingSource>,
  task: KtsTrainingTask,
  exampleId: string,
  createdAt: string,
): ExampleBuilderBase {
  return {
    exampleId,
    exampleVersion: "1",
    domainId: "keep-the-signal",
    domainVersion: source.engineVersion,
    observationSchemaId: source.observationSchemaId,
    observationSchemaVersion: source.observationSchemaVersion,
    targetSchemaId: source.proposalSchemaId,
    targetSchemaVersion: source.proposalSchemaVersion,
    constructionPolicyId: `kts-${task}`,
    constructionPolicyVersion: "1",
    sourceRecordReferences: [`${source.sourceId}:${source.sourceVersion}`],
    lineageFamilyId: source.episodeFamilyId,
    partitionGroupIds: [source.seed, source.encounterId, source.episodeFamilyId],
    input: {
      observation: source.observation,
      engineVersion: source.engineVersion,
      rulesetVersion: source.rulesetVersion,
    },
    acceptanceLabels: source.accepted ? ["accepted"] : ["rejected"],
    rejectionLabels: source.accepted ? [] : [source.proposalValidation],
    uncertainty: source.abstentionCode ? "high" : "low",
    evidenceReferences: source.evidenceReferences,
    contradictionReferences: source.contradictionReferences,
    protectedSourceReferences: [],
    reviewerStatus: source.reviewerStatus,
    partition: "train",
    qualityGates: [],
    createdAt,
  };
}
function target(
  source: Readonly<KtsTrainingSource>,
  value: JsonValue,
  label: TargetRecord["label"],
): TargetRecord {
  return {
    schemaId: source.proposalSchemaId,
    schemaVersion: source.proposalSchemaVersion,
    value,
    label,
    rejectionClasses:
      label === "accepted"
        ? []
        : [source.proposalValidation === "illegal" ? "illegal_proposal" : "unsupported_claim"],
    legal: source.proposalValidation !== "illegal",
    grounded: source.evidenceReferences.length > 0,
    reviewerStatus: source.reviewerStatus,
  };
}
export async function projectKtsExample(
  source: Readonly<KtsTrainingSource>,
  task: KtsTrainingTask,
  exampleId: string,
  createdAt: string,
): Promise<Readonly<TrainingExample>> {
  if (!KTS_TRAINING_TASKS.includes(task))
    failTraining("unsupported_example_kind", "example", "KTS training task is unsupported.");
  const b = base(source, task, exampleId, createdAt);
  if (task === "uncertainty_safe_abstention")
    return buildAbstention(
      b,
      target(source, { abstentionCode: source.abstentionCode ?? "model_uncertain" }, "abstained"),
    );
  if (task === "grounded_tactical_proposal")
    return buildRetrievalGrounding(
      b,
      target(source, source.proposal ?? null, source.accepted ? "accepted" : "rejected"),
      source.evidenceReferences,
    );
  if (task === "deterministic_strategy_selection")
    return buildStrategyRouting(
      b,
      target(
        source,
        {
          strategyId: source.strategyId ?? "none",
          strategyVersion: source.strategyVersion ?? "none",
        },
        source.accepted ? "accepted" : "rejected",
      ),
    );
  return buildSupervisedTarget(
    b,
    target(source, source.proposal ?? null, source.accepted ? "accepted" : "rejected"),
  );
}

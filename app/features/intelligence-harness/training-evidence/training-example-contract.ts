import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import { failTraining, validateTrainingIdentity, validateTrainingTimestamp } from "./failures";
import { normalizeTarget, type TargetRecord } from "./target-contract";
export const EXAMPLE_KINDS = Object.freeze([
  "supervised_target",
  "preference_pair",
  "correction",
  "abstention",
  "retrieval_grounding",
  "strategy_routing",
] as const);
export type ExampleKind = (typeof EXAMPLE_KINDS)[number];
export const DATASET_PARTITIONS = Object.freeze([
  "train",
  "validation",
  "test",
  "quarantine",
] as const);
export type DatasetPartition = (typeof DATASET_PARTITIONS)[number];
export const REVIEW_STATUSES = Object.freeze([
  "accepted",
  "rejected",
  "unknown",
  "not_required",
] as const);
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const QUALITY_OUTCOMES = Object.freeze([
  "pass",
  "warning",
  "fail",
  "unknown",
  "not_applicable",
] as const);
export type QualityOutcome = (typeof QUALITY_OUTCOMES)[number];
export interface ExampleQualityGate {
  readonly gateId: string;
  readonly outcome: QualityOutcome;
  readonly blocking: boolean;
  readonly reasons: readonly string[];
}
export interface TrainingExampleDraft {
  readonly exampleId: string;
  readonly exampleVersion: string;
  readonly exampleKind: ExampleKind;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly observationSchemaId: string;
  readonly observationSchemaVersion: number;
  readonly targetSchemaId: string;
  readonly targetSchemaVersion: number;
  readonly constructionPolicyId: string;
  readonly constructionPolicyVersion: string;
  readonly sourceRecordReferences: readonly string[];
  readonly lineageFamilyId: string;
  readonly partitionGroupIds: readonly string[];
  readonly input: JsonValue;
  readonly target?: TargetRecord;
  readonly preferredTarget?: TargetRecord;
  readonly dispreferredTarget?: TargetRecord;
  readonly acceptanceLabels: readonly string[];
  readonly rejectionLabels: readonly string[];
  readonly uncertainty: "low" | "medium" | "high" | "unknown";
  readonly evidenceReferences: readonly string[];
  readonly contradictionReferences: readonly string[];
  readonly protectedSourceReferences: readonly string[];
  readonly reviewerStatus: ReviewStatus;
  readonly partition: DatasetPartition;
  readonly qualityGates: readonly ExampleQualityGate[];
  readonly createdAt: string;
}
export interface TrainingExample extends TrainingExampleDraft {
  readonly contentDigest: string;
}
export interface ExampleConstructionBudget {
  readonly maximumInputCharacters: number;
  readonly maximumTargetCharacters: number;
  readonly maximumSourceReferences: number;
}
export const DEFAULT_EXAMPLE_CONSTRUCTION_BUDGET: Readonly<ExampleConstructionBudget> =
  Object.freeze({
    maximumInputCharacters: 100_000,
    maximumTargetCharacters: 100_000,
    maximumSourceReferences: 256,
  });
function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}
export async function createTrainingExample(
  draft: Readonly<TrainingExampleDraft>,
  budget: Readonly<ExampleConstructionBudget> = DEFAULT_EXAMPLE_CONSTRUCTION_BUDGET,
): Promise<Readonly<TrainingExample>> {
  for (const [label, value] of [
    ["exampleId", draft.exampleId],
    ["exampleVersion", draft.exampleVersion],
    ["domainId", draft.domainId],
    ["domainVersion", draft.domainVersion],
    ["observationSchemaId", draft.observationSchemaId],
    ["targetSchemaId", draft.targetSchemaId],
    ["constructionPolicyId", draft.constructionPolicyId],
    ["constructionPolicyVersion", draft.constructionPolicyVersion],
    ["lineageFamilyId", draft.lineageFamilyId],
  ] as const)
    validateTrainingIdentity(value, label, "invalid_example_identity", "example");
  validateTrainingTimestamp(draft.createdAt, "invalid_training_example", "example");
  if (
    !EXAMPLE_KINDS.includes(draft.exampleKind) ||
    !DATASET_PARTITIONS.includes(draft.partition) ||
    !REVIEW_STATUSES.includes(draft.reviewerStatus) ||
    !Number.isSafeInteger(draft.observationSchemaVersion) ||
    draft.observationSchemaVersion < 1 ||
    !Number.isSafeInteger(draft.targetSchemaVersion) ||
    draft.targetSchemaVersion < 1 ||
    draft.partitionGroupIds.length === 0 ||
    draft.sourceRecordReferences.length === 0
  ) {
    failTraining("invalid_training_example", "example", "Training example metadata is invalid.");
  }
  if (draft.qualityGates.some((gate) => !QUALITY_OUTCOMES.includes(gate.outcome))) {
    failTraining("invalid_training_example", "example", "Quality gate is invalid.");
  }
  if (
    ![
      budget.maximumInputCharacters,
      budget.maximumTargetCharacters,
      budget.maximumSourceReferences,
    ].every((value) => Number.isSafeInteger(value) && value >= 1)
  )
    failTraining("invalid_training_example", "example", "Example construction budget is invalid.");
  if (
    draft.sourceRecordReferences.length > budget.maximumSourceReferences ||
    canonicalStringify(draft.input).length > budget.maximumInputCharacters
  )
    failTraining(
      "invalid_training_example",
      "example",
      "Example input or source-reference budget exceeded.",
    );
  const rawTargetText = canonicalStringify(
    draft.target?.value ??
      (draft.preferredTarget && draft.dispreferredTarget
        ? [draft.preferredTarget.value, draft.dispreferredTarget.value]
        : null),
  );
  if (rawTargetText.length > budget.maximumTargetCharacters)
    failTraining("invalid_target", "example", "Example target budget exceeded.");
  if (
    /chain[-_ ]?of[-_ ]?thought|hidden_reasoning|private_reasoning/i.test(
      canonicalStringify({ input: draft.input, target: rawTargetText }),
    )
  )
    failTraining(
      "hidden_reasoning_prohibited",
      "example",
      "Hidden reasoning fields are prohibited.",
    );
  const target = draft.target ? normalizeTarget(draft.target) : undefined;
  const preferredTarget = draft.preferredTarget
    ? normalizeTarget(draft.preferredTarget)
    : undefined;
  const dispreferredTarget = draft.dispreferredTarget
    ? normalizeTarget(draft.dispreferredTarget)
    : undefined;
  if (draft.exampleKind === "preference_pair" && (!preferredTarget || !dispreferredTarget))
    failTraining("invalid_preference_pair", "example", "Preference pairs require two targets.");
  if (draft.exampleKind !== "preference_pair" && !target)
    failTraining("invalid_target", "example", "Example kind requires a target.");
  const envelope: Record<string, unknown> = {
    ...draft,
    sourceRecordReferences: unique(draft.sourceRecordReferences),
    partitionGroupIds: unique(draft.partitionGroupIds),
    acceptanceLabels: unique(draft.acceptanceLabels),
    rejectionLabels: unique(draft.rejectionLabels),
    evidenceReferences: unique(draft.evidenceReferences),
    contradictionReferences: unique(draft.contradictionReferences),
    protectedSourceReferences: unique(draft.protectedSourceReferences),
    qualityGates: [...draft.qualityGates]
      .map((gate) => ({ ...gate, reasons: unique(gate.reasons) }))
      .sort((a, b) => (a.gateId < b.gateId ? -1 : a.gateId > b.gateId ? 1 : 0)),
  };
  delete envelope.target;
  delete envelope.preferredTarget;
  delete envelope.dispreferredTarget;
  if (target) envelope.target = target;
  if (preferredTarget) envelope.preferredTarget = preferredTarget;
  if (dispreferredTarget) envelope.dispreferredTarget = dispreferredTarget;
  const normalized = canonicalizeJson(envelope) as unknown as Omit<
    TrainingExample,
    "contentDigest"
  >;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<TrainingExample>;
}
export async function validateTrainingExample(example: Readonly<TrainingExample>): Promise<void> {
  const { contentDigest, ...envelope } = example;
  if (!(await verifySha256Hex(canonicalStringify(envelope), contentDigest)))
    failTraining("invalid_example_digest", "example", "Training example digest mismatch.", {
      exampleId: example.exampleId,
    });
}

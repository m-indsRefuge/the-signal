import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity, validateCanonicalTimestamp } from "./failures";
export const EXPERIMENT_ROLES = Object.freeze(["signal_officer_tactical_adviser"] as const);
export type ExperimentRole = (typeof EXPERIMENT_ROLES)[number];
export const EXPERIMENT_CLASSIFICATIONS = Object.freeze([
  "experimental_candidate",
  "evaluation_candidate",
  "rejected",
  "quarantined",
  "experiment_accepted",
  "superseded",
] as const);
export type ExperimentClassification = (typeof EXPERIMENT_CLASSIFICATIONS)[number];
export interface ExperimentDraft {
  readonly experimentId: string;
  readonly experimentVersion: string;
  readonly role: ExperimentRole;
  readonly researchQuestion: string;
  readonly taskScope: readonly string[];
  readonly baseModelRecordDigest: string;
  readonly datasetApprovalDigest: string;
  readonly createdAt: string;
  readonly classification: ExperimentClassification;
}
export interface ExperimentRecord extends ExperimentDraft {
  readonly contentDigest: string;
}
export async function createExperimentRecord(
  draft: Readonly<ExperimentDraft>,
): Promise<Readonly<ExperimentRecord>> {
  validateFineTuningIdentity(draft.experimentId, "experimentId");
  validateFineTuningIdentity(draft.experimentVersion, "experimentVersion");
  validateCanonicalTimestamp(draft.createdAt, "createdAt");
  if (
    !EXPERIMENT_ROLES.includes(draft.role) ||
    !EXPERIMENT_CLASSIFICATIONS.includes(draft.classification) ||
    draft.researchQuestion.trim().length < 12 ||
    draft.taskScope.length === 0
  )
    failFineTuning("invalid_experiment", "experiment", "Experiment metadata is invalid.");
  if (
    /chain[-_ ]?of[-_ ]?thought|hidden_reasoning|private_reasoning/i.test(canonicalStringify(draft))
  )
    failFineTuning("hidden_reasoning_prohibited", "experiment", "Hidden reasoning is prohibited.");
  const normalized = canonicalizeJson({
    ...draft,
    taskScope: [...new Set(draft.taskScope)].sort(),
  }) as unknown as ExperimentDraft;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<ExperimentRecord>;
}
export async function validateExperimentRecord(record: Readonly<ExperimentRecord>): Promise<void> {
  const { contentDigest, ...body } = record;
  if (!(await verifySha256Hex(canonicalStringify(body), contentDigest)))
    failFineTuning("invalid_experiment", "experiment", "Experiment digest mismatch.");
}

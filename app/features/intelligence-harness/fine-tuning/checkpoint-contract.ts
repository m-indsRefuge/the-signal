import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isSha256Hex, sha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export const CHECKPOINT_STATUSES = Object.freeze([
  "incomplete",
  "candidate",
  "validated",
  "rejected",
  "quarantined",
] as const);
export type CheckpointStatus = (typeof CHECKPOINT_STATUSES)[number];
export interface CheckpointFile {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
}
export interface CheckpointDraft {
  readonly checkpointId: string;
  readonly parentBaseModelDigest: string;
  readonly datasetManifestDigest: string;
  readonly trainingPlanDigest: string;
  readonly step: number;
  readonly epoch: number;
  readonly trainableParameterScope: string;
  readonly files: readonly CheckpointFile[];
  readonly metricSnapshotDigest: string;
  readonly environmentDigest: string;
  readonly status: CheckpointStatus;
}
export interface CheckpointRecord extends CheckpointDraft {
  readonly contentDigest: string;
}
export async function createCheckpointRecord(
  draft: Readonly<CheckpointDraft>,
): Promise<Readonly<CheckpointRecord>> {
  validateFineTuningIdentity(draft.checkpointId, "checkpointId", "checkpoint_invalid");
  const ds = [
    draft.parentBaseModelDigest,
    draft.datasetManifestDigest,
    draft.trainingPlanDigest,
    draft.metricSnapshotDigest,
    draft.environmentDigest,
    ...draft.files.map((f) => f.digest),
  ];
  if (
    ds.some((d) => !isSha256Hex(d)) ||
    !Number.isSafeInteger(draft.step) ||
    draft.step < 0 ||
    !Number.isFinite(draft.epoch) ||
    draft.epoch < 0 ||
    draft.files.length === 0 ||
    draft.files.some((f) => !Number.isSafeInteger(f.bytes) || f.bytes < 1)
  )
    failFineTuning("checkpoint_invalid", "checkpoint", "Checkpoint evidence is invalid.");
  const normalized = canonicalizeJson({
    ...draft,
    files: [...draft.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
  }) as unknown as CheckpointDraft;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<CheckpointRecord>;
}

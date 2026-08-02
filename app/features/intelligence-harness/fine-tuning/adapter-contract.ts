import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isSha256Hex, sha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export const ADAPTER_STATUSES = Object.freeze([
  "experimental_candidate",
  "evaluation_candidate",
  "rejected",
  "quarantined",
  "experiment_accepted",
  "superseded",
] as const);
export type AdapterStatus = (typeof ADAPTER_STATUSES)[number];
export interface AdapterFile {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
}
export interface AdapterDraft {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly parentBaseModelDigest: string;
  readonly datasetManifestDigest: string;
  readonly trainingPlanDigest: string;
  readonly finalCheckpointDigest: string;
  readonly trainableParameterScope: string;
  readonly files: readonly AdapterFile[];
  readonly evaluationBundleDigest?: string;
  readonly status: AdapterStatus;
  readonly knownLimitations: readonly string[];
}
export interface AdapterRecord extends AdapterDraft {
  readonly contentDigest: string;
}
export async function createAdapterRecord(
  draft: Readonly<AdapterDraft>,
): Promise<Readonly<AdapterRecord>> {
  validateFineTuningIdentity(draft.adapterId, "adapterId", "adapter_invalid");
  validateFineTuningIdentity(draft.adapterVersion, "adapterVersion", "adapter_invalid");
  const ds = [
    draft.parentBaseModelDigest,
    draft.datasetManifestDigest,
    draft.trainingPlanDigest,
    draft.finalCheckpointDigest,
    ...draft.files.map((f) => f.digest),
    ...(draft.evaluationBundleDigest ? [draft.evaluationBundleDigest] : []),
  ];
  if (
    ds.some((d) => !isSha256Hex(d)) ||
    draft.files.length === 0 ||
    draft.files.some((f) => !Number.isSafeInteger(f.bytes) || f.bytes < 1) ||
    !ADAPTER_STATUSES.includes(draft.status)
  )
    failFineTuning("adapter_invalid", "adapter", "Adapter evidence is invalid.");
  const normalized = canonicalizeJson({
    ...draft,
    files: [...draft.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    knownLimitations: [...new Set(draft.knownLimitations)].sort(),
  }) as unknown as AdapterDraft;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<AdapterRecord>;
}

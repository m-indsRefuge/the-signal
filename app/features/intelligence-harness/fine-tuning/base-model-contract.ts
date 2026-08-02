import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isSha256Hex, sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export const MODEL_LICENCE_STATUSES = Object.freeze(["approved", "rejected", "unknown"] as const);
export type ModelLicenceStatus = (typeof MODEL_LICENCE_STATUSES)[number];
export interface ModelFileRecord {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
}
export interface TokenizerRecord {
  readonly tokenizerId: string;
  readonly revision: string;
  readonly digest: string;
}
export interface BaseModelDraft {
  readonly modelId: string;
  readonly revision: string;
  readonly architectureFamily: string;
  readonly parameterCount: number;
  readonly contextLimit: number;
  readonly weightFormat: string;
  readonly quantizationStatus: string;
  readonly sourceLocation: string;
  readonly files: readonly ModelFileRecord[];
  readonly tokenizer: TokenizerRecord;
  readonly licenceId: string;
  readonly licenceStatus: ModelLicenceStatus;
  readonly licenceTextReference: string;
  readonly redistributionConstraints: readonly string[];
  readonly intendedUseConstraints: readonly string[];
  readonly knownLimitations: readonly string[];
  readonly remoteCodeRequired: boolean;
}
export interface BaseModelRecord extends BaseModelDraft {
  readonly contentDigest: string;
}
function pinned(value: string): boolean {
  return value !== "main" && value !== "latest" && !value.endsWith(":latest") && value.length >= 7;
}
export async function createBaseModelRecord(
  draft: Readonly<BaseModelDraft>,
): Promise<Readonly<BaseModelRecord>> {
  for (const [label, value] of [
    ["modelId", draft.modelId],
    ["revision", draft.revision],
    ["architectureFamily", draft.architectureFamily],
    ["weightFormat", draft.weightFormat],
    ["sourceLocation", draft.sourceLocation],
    ["tokenizerId", draft.tokenizer.tokenizerId],
    ["tokenizerRevision", draft.tokenizer.revision],
    ["licenceId", draft.licenceId],
  ] as const)
    validateFineTuningIdentity(value, label, "invalid_base_model");
  if (!pinned(draft.revision) || !pinned(draft.tokenizer.revision))
    failFineTuning(
      "base_model_revision_unpinned",
      "base-model",
      "Model and tokenizer revisions must be pinned.",
    );
  if (
    !Number.isSafeInteger(draft.parameterCount) ||
    draft.parameterCount < 1 ||
    !Number.isSafeInteger(draft.contextLimit) ||
    draft.contextLimit < 1 ||
    draft.files.length === 0
  )
    failFineTuning(
      "invalid_base_model",
      "base-model",
      "Model dimensions or file manifest are invalid.",
    );
  if (draft.licenceStatus !== "approved")
    failFineTuning(
      "base_model_licence_unapproved",
      "base-model",
      "Base-model licence is not approved.",
    );
  if (draft.remoteCodeRequired)
    failFineTuning("invalid_base_model", "base-model", "Unbounded remote code is prohibited.");
  if (
    !isSha256Hex(draft.tokenizer.digest) ||
    draft.files.some((f) => !isSha256Hex(f.digest) || !Number.isSafeInteger(f.bytes) || f.bytes < 1)
  )
    failFineTuning(
      "base_model_digest_mismatch",
      "base-model",
      "Model file digest evidence is invalid.",
    );
  const normalized = canonicalizeJson({
    ...draft,
    files: [...draft.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    redistributionConstraints: [...new Set(draft.redistributionConstraints)].sort(),
    intendedUseConstraints: [...new Set(draft.intendedUseConstraints)].sort(),
    knownLimitations: [...new Set(draft.knownLimitations)].sort(),
  }) as unknown as BaseModelDraft;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<BaseModelRecord>;
}
export async function validateBaseModelRecord(record: Readonly<BaseModelRecord>): Promise<void> {
  const { contentDigest, ...body } = record;
  if (!(await verifySha256Hex(canonicalStringify(body), contentDigest)))
    failFineTuning(
      "base_model_digest_mismatch",
      "base-model",
      "Base-model record digest mismatch.",
    );
}

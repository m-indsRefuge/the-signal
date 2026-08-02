import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
} from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import {
  failConsolidation,
  validateConsolidationIdentity,
  validateConsolidationTimestamp,
} from "./failures";

export const TOMBSTONE_DRAFT_STATUSES = Object.freeze([
  "draft",
  "governance_review_required",
  "rejected",
] as const);
export type TombstoneDraftStatus = (typeof TOMBSTONE_DRAFT_STATUSES)[number];

export interface TombstoneDraftInput {
  readonly tombstoneId: string;
  readonly sourceMemoryId: string;
  readonly sourceMemoryKind: "episodic";
  readonly sourceDigest: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly lineageReferences: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly preservationTargetReferences: readonly string[];
  readonly forgettingReason: string;
  readonly retentionPolicyId: string;
  readonly retentionPolicyVersion: string;
  readonly evaluationId: string;
  readonly evaluationEvidenceReferences: readonly string[];
  readonly authorizingActorId: string;
  readonly proposedDeletionTime: string;
  readonly recordedAt: string;
  readonly status: TombstoneDraftStatus;
}

export interface TombstoneDraft extends TombstoneDraftInput {
  readonly tombstoneSchemaVersion: 1;
  readonly contentDigest: string;
}

export async function createTombstoneDraft(
  input: Readonly<TombstoneDraftInput>,
): Promise<Readonly<TombstoneDraft>> {
  for (const [label, value] of [
    ["tombstoneId", input.tombstoneId],
    ["sourceMemoryId", input.sourceMemoryId],
    ["domainId", input.domainId],
    ["domainVersion", input.domainVersion],
    ["retentionPolicyId", input.retentionPolicyId],
    ["retentionPolicyVersion", input.retentionPolicyVersion],
    ["evaluationId", input.evaluationId],
    ["authorizingActorId", input.authorizingActorId],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_tombstone_draft", "tombstone", {
      memoryId: input.sourceMemoryId,
      evaluationId: input.evaluationId,
    });
  }
  validateConsolidationTimestamp(
    input.proposedDeletionTime,
    "invalid_tombstone_draft",
    "tombstone",
    { memoryId: input.sourceMemoryId, evaluationId: input.evaluationId },
  );
  validateConsolidationTimestamp(input.recordedAt, "invalid_tombstone_draft", "tombstone", {
    memoryId: input.sourceMemoryId,
    evaluationId: input.evaluationId,
  });
  if (
    !/^[a-f0-9]{64}$/.test(input.sourceDigest) ||
    !TOMBSTONE_DRAFT_STATUSES.includes(input.status) ||
    input.forgettingReason.trim().length === 0
  ) {
    failConsolidation("invalid_tombstone_draft", "tombstone", "Tombstone draft is invalid.", {
      memoryId: input.sourceMemoryId,
      evaluationId: input.evaluationId,
    });
  }
  const normalized = canonicalizeJson({
    tombstoneSchemaVersion: 1,
    ...input,
    lineageReferences: [...new Set(input.lineageReferences)].sort(),
    evidenceReferences: [...new Set(input.evidenceReferences)].sort(),
    preservationTargetReferences: [...new Set(input.preservationTargetReferences)].sort(),
    evaluationEvidenceReferences: [...new Set(input.evaluationEvidenceReferences)].sort(),
  }) as unknown as Omit<TombstoneDraft, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonObject) as unknown as Readonly<TombstoneDraft>;
}

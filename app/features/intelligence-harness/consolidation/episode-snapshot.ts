import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
} from "../memory-fabric/canonical-json";
import { sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import type { DataClassification, RetentionClass } from "../memory-fabric/evidence-contract";
import type { EvidenceRecord, EvidenceRelationRecord } from "../memory-fabric/evidence-contract";
import type {
  EpisodicMemoryRecord,
  MemoryEvidenceAttachment,
  MemoryRelationRecord,
} from "../memory-fabric/memory-contract";
import type { RetrievalMetadata } from "../memory-fabric/retrieval-contract";
import {
  failConsolidation,
  validateConsolidationIdentity,
  validateConsolidationTimestamp,
} from "./failures";
import type { EpisodeSelectionResult } from "./selection-contract";

export const CONSOLIDATION_SNAPSHOT_SCHEMA_ID = "construct.consolidation.snapshot" as const;
export const CONSOLIDATION_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface SnapshotAccessPolicy {
  readonly allowedDomains: readonly string[];
  readonly allowedClassifications: readonly DataClassification[];
  readonly acceptedRetentionClasses: readonly RetentionClass[];
}

export interface ConsolidationSnapshotDraft {
  readonly snapshotId: string;
  readonly requestId: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly memories: readonly Readonly<EpisodicMemoryRecord>[];
  readonly attachments: readonly Readonly<MemoryEvidenceAttachment>[];
  readonly evidence: readonly Readonly<EvidenceRecord>[];
  readonly memoryRelations: readonly Readonly<MemoryRelationRecord>[];
  readonly evidenceRelations: readonly Readonly<EvidenceRelationRecord>[];
  readonly retrievalReports: readonly Readonly<RetrievalMetadata>[];
  readonly accessPolicy: SnapshotAccessPolicy;
  readonly omittedReferences: readonly string[];
  readonly truncatedReferences: readonly string[];
  readonly recordedAt: string;
  readonly actorId: string;
}

export interface ConsolidationSnapshot extends ConsolidationSnapshotDraft {
  readonly snapshotSchemaId: typeof CONSOLIDATION_SNAPSHOT_SCHEMA_ID;
  readonly snapshotSchemaVersion: typeof CONSOLIDATION_SNAPSHOT_SCHEMA_VERSION;
  readonly serializedCharacters: number;
  readonly contentDigest: string;
}

export async function createConsolidationSnapshot(
  draft: Readonly<ConsolidationSnapshotDraft>,
): Promise<Readonly<ConsolidationSnapshot>> {
  validateConsolidationIdentity(draft.snapshotId, "snapshotId", "invalid_snapshot", "snapshot", {
    snapshotId: draft.snapshotId,
  });
  validateConsolidationIdentity(draft.requestId, "requestId", "invalid_snapshot", "snapshot", {
    snapshotId: draft.snapshotId,
  });
  validateConsolidationIdentity(draft.domainId, "domainId", "invalid_snapshot", "snapshot", {
    snapshotId: draft.snapshotId,
  });
  validateConsolidationIdentity(
    draft.domainVersion,
    "domainVersion",
    "invalid_snapshot",
    "snapshot",
    { snapshotId: draft.snapshotId },
  );
  validateConsolidationIdentity(draft.actorId, "actorId", "invalid_snapshot", "snapshot", {
    snapshotId: draft.snapshotId,
  });
  validateConsolidationTimestamp(draft.recordedAt, "invalid_snapshot", "snapshot", {
    snapshotId: draft.snapshotId,
  });
  if (
    draft.accessPolicy.allowedDomains.length === 0 ||
    draft.accessPolicy.allowedClassifications.length === 0 ||
    draft.accessPolicy.acceptedRetentionClasses.length === 0
  ) {
    failConsolidation("invalid_snapshot", "snapshot", "Snapshot access policy is incomplete.", {
      snapshotId: draft.snapshotId,
    });
  }
  const memoryIds = draft.memories.map((record) => record.memoryId);
  if (new Set(memoryIds).size !== memoryIds.length) {
    failConsolidation(
      "invalid_snapshot",
      "snapshot",
      "Snapshot memory identities must be unique.",
      {
        snapshotId: draft.snapshotId,
      },
    );
  }
  const normalized = canonicalizeJson({
    snapshotSchemaId: CONSOLIDATION_SNAPSHOT_SCHEMA_ID,
    snapshotSchemaVersion: CONSOLIDATION_SNAPSHOT_SCHEMA_VERSION,
    ...draft,
    memories: [...draft.memories].sort((a, b) =>
      a.memoryId < b.memoryId ? -1 : a.memoryId > b.memoryId ? 1 : 0,
    ),
    attachments: [...draft.attachments].sort((a, b) =>
      a.attachmentId < b.attachmentId ? -1 : a.attachmentId > b.attachmentId ? 1 : 0,
    ),
    evidence: [...draft.evidence].sort((a, b) =>
      a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0,
    ),
    memoryRelations: [...draft.memoryRelations].sort((a, b) =>
      a.relationId < b.relationId ? -1 : a.relationId > b.relationId ? 1 : 0,
    ),
    evidenceRelations: [...draft.evidenceRelations].sort((a, b) =>
      a.relationId < b.relationId ? -1 : a.relationId > b.relationId ? 1 : 0,
    ),
    omittedReferences: [...new Set(draft.omittedReferences)].sort(),
    truncatedReferences: [...new Set(draft.truncatedReferences)].sort(),
  }) as unknown as Omit<ConsolidationSnapshot, "serializedCharacters" | "contentDigest">;
  const serializedCharacters = canonicalStringify(normalized).length;
  const digestEnvelope = { ...normalized, serializedCharacters };
  const contentDigest = await sha256Hex(canonicalStringify(digestEnvelope));
  return deepFreezeJson({
    ...digestEnvelope,
    contentDigest,
  } as unknown as JsonObject) as unknown as Readonly<ConsolidationSnapshot>;
}

export async function validateConsolidationSnapshot(
  snapshot: Readonly<ConsolidationSnapshot>,
): Promise<void> {
  if (
    snapshot.snapshotSchemaId !== CONSOLIDATION_SNAPSHOT_SCHEMA_ID ||
    snapshot.snapshotSchemaVersion !== CONSOLIDATION_SNAPSHOT_SCHEMA_VERSION
  ) {
    failConsolidation("invalid_snapshot", "snapshot", "Snapshot schema identity is unsupported.");
  }
  const { contentDigest, ...envelope } = snapshot;
  if (!(await verifySha256Hex(canonicalStringify(envelope), contentDigest))) {
    failConsolidation("snapshot_digest_mismatch", "snapshot", "Snapshot digest does not match.", {
      snapshotId: snapshot.snapshotId,
    });
  }
}

export async function snapshotFromSelection(
  selection: Readonly<EpisodeSelectionResult>,
  input: Readonly<{
    snapshotId: string;
    domainId: string;
    domainVersion: string;
    accessPolicy: SnapshotAccessPolicy;
    recordedAt: string;
    actorId: string;
  }>,
): Promise<Readonly<ConsolidationSnapshot>> {
  return createConsolidationSnapshot({
    snapshotId: input.snapshotId,
    requestId: selection.requestId,
    domainId: input.domainId,
    domainVersion: input.domainVersion,
    memories: selection.memories,
    attachments: selection.attachments,
    evidence: selection.evidence,
    memoryRelations: selection.memoryRelations,
    evidenceRelations: selection.evidenceRelations,
    retrievalReports: [selection.metadata],
    accessPolicy: input.accessPolicy,
    omittedReferences: selection.omittedMemoryIds,
    truncatedReferences: selection.truncatedEvidenceIds,
    recordedAt: input.recordedAt,
    actorId: input.actorId,
  });
}

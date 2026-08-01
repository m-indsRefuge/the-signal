import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
  type JsonValue,
} from "./canonical-json";
import { sha256Hex, verifySha256Hex } from "./digest";
import {
  ACCEPTANCE_STATES,
  DATA_CLASSIFICATIONS,
  RETENTION_CLASSES,
  type AcceptanceState,
  type DataClassification,
  type RetentionClass,
  validatePublicIdentity,
  validateTimestamp,
} from "./evidence-contract";
import { failMemory } from "./failures";

export const MEMORY_SCHEMA_ID = "construct.memory" as const;
export const MEMORY_SCHEMA_VERSION = 1 as const;
export const MEMORY_RELATION_SCHEMA_VERSION = 1 as const;
export const MEMORY_ATTACHMENT_SCHEMA_VERSION = 1 as const;

export const ACTIVE_MEMORY_KINDS = Object.freeze(["episodic"] as const);
export const DEFERRED_MEMORY_KINDS = Object.freeze([
  "semantic_claim",
  "procedural_skill",
  "parametric_lineage",
] as const);
export type MemoryKind = (typeof ACTIVE_MEMORY_KINDS)[number];

export const EPISODE_SIGNIFICANCE_CLASSES = Object.freeze([
  "routine",
  "notable",
  "surprising",
  "failure",
  "correction",
  "benchmark",
] as const);
export type EpisodeSignificance = (typeof EPISODE_SIGNIFICANCE_CLASSES)[number];

export const MEMORY_EVIDENCE_ROLES = Object.freeze([
  "initial_condition",
  "observation",
  "proposal",
  "decision",
  "action",
  "outcome",
  "correction",
  "contradiction",
  "support",
  "counterexample",
] as const);
export type MemoryEvidenceRole = (typeof MEMORY_EVIDENCE_ROLES)[number];

export const MEMORY_RELATION_TYPES = Object.freeze([
  "related_to",
  "continues",
  "contradicts",
  "corrects",
  "supersedes",
  "derived_from",
] as const);
export type MemoryRelationType = (typeof MEMORY_RELATION_TYPES)[number];

export interface EpisodicMemoryDraft {
  readonly memoryId: string;
  readonly memoryKind: "episodic";
  readonly domainId: string;
  readonly domainVersion: string;
  readonly significance: EpisodeSignificance;
  readonly summary: JsonValue;
  readonly acceptanceState: AcceptanceState;
  readonly classification: DataClassification;
  readonly retentionClass: RetentionClass;
  readonly tags: readonly string[];
  readonly recordedAt: string;
  readonly sessionId?: string;
  readonly actorId?: string;
  readonly operationId?: string;
}

export interface EpisodicMemoryRecord extends EpisodicMemoryDraft {
  readonly memorySchemaId: typeof MEMORY_SCHEMA_ID;
  readonly memorySchemaVersion: typeof MEMORY_SCHEMA_VERSION;
  readonly contentDigest: string;
}

export interface MemoryEvidenceAttachmentDraft {
  readonly attachmentId: string;
  readonly memoryId: string;
  readonly evidenceId: string;
  readonly role: MemoryEvidenceRole;
  readonly sequence: number;
  readonly metadata?: JsonObject;
}
export interface MemoryEvidenceAttachment extends MemoryEvidenceAttachmentDraft {
  readonly attachmentSchemaVersion: typeof MEMORY_ATTACHMENT_SCHEMA_VERSION;
  readonly canonicalContent: string;
}

export interface MemoryRelationDraft {
  readonly relationId: string;
  readonly relationType: MemoryRelationType;
  readonly sourceMemoryId: string;
  readonly targetMemoryId: string;
  readonly metadata?: JsonObject;
  readonly recordedAt: string;
  readonly actorId?: string;
  readonly operationId?: string;
}
export interface MemoryRelationRecord extends MemoryRelationDraft {
  readonly relationSchemaVersion: typeof MEMORY_RELATION_SCHEMA_VERSION;
  readonly canonicalContent: string;
}

export async function createEpisodicMemoryRecord(
  draft: Readonly<EpisodicMemoryDraft>,
): Promise<Readonly<EpisodicMemoryRecord>> {
  validateEpisodicDraft(draft);
  const normalized = canonicalizeJson({
    memorySchemaId: MEMORY_SCHEMA_ID,
    memorySchemaVersion: MEMORY_SCHEMA_VERSION,
    ...draft,
    tags: [...draft.tags].sort(),
  }) as unknown as Omit<EpisodicMemoryRecord, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({ ...normalized, contentDigest }) as Readonly<EpisodicMemoryRecord>;
}

export async function validateEpisodicMemoryRecord(
  record: Readonly<EpisodicMemoryRecord>,
): Promise<void> {
  if (
    record.memorySchemaId !== MEMORY_SCHEMA_ID ||
    record.memorySchemaVersion !== MEMORY_SCHEMA_VERSION
  ) {
    failMemory("invalid_memory", "validation", "Memory schema identity is unsupported.");
  }
  validateEpisodicDraft(record);
  const { contentDigest, ...envelope } = record;
  if (!(await verifySha256Hex(canonicalStringify(envelope), contentDigest))) {
    failMemory("digest_mismatch", "validation", "Memory content digest does not match.");
  }
}

export function createMemoryEvidenceAttachment(
  draft: Readonly<MemoryEvidenceAttachmentDraft>,
): Readonly<MemoryEvidenceAttachment> {
  validatePublicIdentity(draft.attachmentId, "attachmentId");
  validatePublicIdentity(draft.memoryId, "memoryId");
  validatePublicIdentity(draft.evidenceId, "evidenceId");
  if (!MEMORY_EVIDENCE_ROLES.includes(draft.role)) {
    failMemory("invalid_memory_relation", "validation", "Memory evidence role is unsupported.");
  }
  if (!Number.isSafeInteger(draft.sequence) || draft.sequence < 0) {
    failMemory("invalid_memory_relation", "validation", "Attachment sequence is invalid.");
  }
  const normalized = canonicalizeJson({
    attachmentSchemaVersion: MEMORY_ATTACHMENT_SCHEMA_VERSION,
    ...draft,
    metadata: draft.metadata ?? {},
  }) as unknown as Omit<MemoryEvidenceAttachment, "canonicalContent">;
  return deepFreezeJson({
    ...normalized,
    canonicalContent: canonicalStringify(normalized),
  }) as Readonly<MemoryEvidenceAttachment>;
}

export function createMemoryRelation(
  draft: Readonly<MemoryRelationDraft>,
): Readonly<MemoryRelationRecord> {
  validatePublicIdentity(draft.relationId, "relationId");
  validatePublicIdentity(draft.sourceMemoryId, "sourceMemoryId");
  validatePublicIdentity(draft.targetMemoryId, "targetMemoryId");
  if (draft.sourceMemoryId === draft.targetMemoryId) {
    failMemory("invalid_memory_relation", "validation", "Memory self-relations are not allowed.");
  }
  if (!MEMORY_RELATION_TYPES.includes(draft.relationType)) {
    failMemory("invalid_memory_relation", "validation", "Memory relation type is unsupported.");
  }
  validateTimestamp(draft.recordedAt);
  if (draft.actorId !== undefined) validatePublicIdentity(draft.actorId, "actorId");
  if (draft.operationId !== undefined) validatePublicIdentity(draft.operationId, "operationId");
  const normalized = canonicalizeJson({
    relationSchemaVersion: MEMORY_RELATION_SCHEMA_VERSION,
    ...draft,
    metadata: draft.metadata ?? {},
  }) as unknown as Omit<MemoryRelationRecord, "canonicalContent">;
  return deepFreezeJson({
    ...normalized,
    canonicalContent: canonicalStringify(normalized),
  }) as Readonly<MemoryRelationRecord>;
}

function validateEpisodicDraft(draft: Readonly<EpisodicMemoryDraft>): void {
  validatePublicIdentity(draft.memoryId, "memoryId");
  if (draft.memoryKind !== "episodic") {
    failMemory("unsupported_memory_kind", "validation", "Only episodic durable memory is active.");
  }
  validatePublicIdentity(draft.domainId, "domainId");
  validatePublicIdentity(draft.domainVersion, "domainVersion");
  if (!EPISODE_SIGNIFICANCE_CLASSES.includes(draft.significance)) {
    failMemory("invalid_memory", "validation", "Episode significance is unsupported.");
  }
  canonicalizeJson(draft.summary);
  if (!ACCEPTANCE_STATES.includes(draft.acceptanceState))
    failMemory("invalid_memory", "validation", "Acceptance state is unsupported.");
  if (!DATA_CLASSIFICATIONS.includes(draft.classification))
    failMemory("invalid_memory", "validation", "Classification is unsupported.");
  if (!RETENTION_CLASSES.includes(draft.retentionClass))
    failMemory("invalid_memory", "validation", "Retention class is unsupported.");
  if (!Array.isArray(draft.tags) || draft.tags.some((tag) => typeof tag !== "string")) {
    failMemory("invalid_memory", "validation", "Memory tags are invalid.");
  }
  const normalizedTags = draft.tags as readonly string[];
  for (const tag of normalizedTags) validatePublicIdentity(tag, "tag");
  if (new Set(normalizedTags).size !== normalizedTags.length)
    failMemory("invalid_memory", "validation", "Memory tags must be unique.");
  validateTimestamp(draft.recordedAt);
  if (draft.sessionId !== undefined) validatePublicIdentity(draft.sessionId, "sessionId");
  if (draft.actorId !== undefined) validatePublicIdentity(draft.actorId, "actorId");
  if (draft.operationId !== undefined) validatePublicIdentity(draft.operationId, "operationId");
}

import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
  type JsonValue,
} from "./canonical-json";
import { sha256Hex, verifySha256Hex } from "./digest";
import { failMemory } from "./failures";

export const EVIDENCE_SCHEMA_ID = "construct.evidence" as const;
export const EVIDENCE_SCHEMA_VERSION = 1 as const;
export const EVIDENCE_RELATION_SCHEMA_VERSION = 1 as const;

export const EVIDENCE_SOURCE_TYPES = Object.freeze([
  "observation",
  "event",
  "proposal",
  "decision",
  "action",
  "outcome",
  "human_correction",
  "evaluation",
  "governance",
  "external",
] as const);
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const ACCEPTANCE_STATES = Object.freeze([
  "candidate",
  "accepted",
  "rejected",
  "quarantined",
  "superseded",
] as const);
export type AcceptanceState = (typeof ACCEPTANCE_STATES)[number];

export const DATA_CLASSIFICATIONS = Object.freeze([
  "public",
  "internal",
  "sensitive",
  "restricted",
] as const);
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export const RETENTION_CLASSES = Object.freeze([
  "ephemeral",
  "standard",
  "protected",
  "benchmark",
  "training_lineage",
] as const);
export type RetentionClass = (typeof RETENTION_CLASSES)[number];

export const EVIDENCE_RELATION_TYPES = Object.freeze([
  "derived_from",
  "supports",
  "contradicts",
  "corrects",
  "supersedes",
  "part_of",
  "evaluates",
] as const);
export type EvidenceRelationType = (typeof EVIDENCE_RELATION_TYPES)[number];

export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
export const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface EvidenceDraft {
  readonly evidenceId: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly sourceType: EvidenceSourceType;
  readonly sourceSchemaId: string;
  readonly sourceSchemaVersion: number;
  readonly sourceIdentity: string;
  readonly authoritativePosition: JsonObject;
  readonly payload: JsonValue;
  readonly acceptanceState: AcceptanceState;
  readonly classification: DataClassification;
  readonly retentionClass: RetentionClass;
  readonly tags: readonly string[];
  readonly recordedAt: string;
  readonly actorId?: string;
  readonly operationId?: string;
}

export interface EvidenceRecord extends EvidenceDraft {
  readonly evidenceSchemaId: typeof EVIDENCE_SCHEMA_ID;
  readonly evidenceSchemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  readonly contentDigest: string;
}

export interface EvidenceRelationDraft {
  readonly relationId: string;
  readonly relationType: EvidenceRelationType;
  readonly sourceEvidenceId: string;
  readonly targetEvidenceId: string;
  readonly metadata?: JsonObject;
  readonly recordedAt: string;
  readonly actorId?: string;
  readonly operationId?: string;
}

export interface EvidenceRelationRecord extends EvidenceRelationDraft {
  readonly relationSchemaVersion: typeof EVIDENCE_RELATION_SCHEMA_VERSION;
  readonly canonicalContent: string;
}

export function isPublicIdentity(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_ID_PATTERN.test(value);
}

export function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !UTC_TIMESTAMP_PATTERN.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

export function validatePublicIdentity(
  value: unknown,
  label = "identity",
): asserts value is string {
  if (!isPublicIdentity(value)) {
    failMemory("invalid_identity", "validation", `${label} is invalid.`);
  }
}

export function validateTimestamp(value: unknown): asserts value is string {
  if (!isCanonicalUtcTimestamp(value)) {
    failMemory("invalid_timestamp", "validation", "recordedAt must be canonical UTC milliseconds.");
  }
}

export async function createEvidenceRecord(
  draft: Readonly<EvidenceDraft>,
): Promise<Readonly<EvidenceRecord>> {
  validateEvidenceDraft(draft);
  const normalizedDraft = canonicalizeJson({
    evidenceSchemaId: EVIDENCE_SCHEMA_ID,
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    ...draft,
    tags: [...draft.tags].sort(),
  }) as unknown as Omit<EvidenceRecord, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalizedDraft));
  return deepFreezeJson({ ...normalizedDraft, contentDigest }) as Readonly<EvidenceRecord>;
}

export async function validateEvidenceRecord(record: Readonly<EvidenceRecord>): Promise<void> {
  if (
    record.evidenceSchemaId !== EVIDENCE_SCHEMA_ID ||
    record.evidenceSchemaVersion !== EVIDENCE_SCHEMA_VERSION
  ) {
    failMemory("invalid_evidence", "validation", "Evidence schema identity is unsupported.");
  }
  validateEvidenceDraft(record);
  const { contentDigest, ...digestEnvelope } = record;
  const valid = await verifySha256Hex(canonicalStringify(digestEnvelope), contentDigest);
  if (!valid)
    failMemory("digest_mismatch", "validation", "Evidence content digest does not match.");
}

export function createEvidenceRelation(
  draft: Readonly<EvidenceRelationDraft>,
): Readonly<EvidenceRelationRecord> {
  validatePublicIdentity(draft.relationId, "relationId");
  validatePublicIdentity(draft.sourceEvidenceId, "sourceEvidenceId");
  validatePublicIdentity(draft.targetEvidenceId, "targetEvidenceId");
  if (draft.sourceEvidenceId === draft.targetEvidenceId) {
    failMemory(
      "invalid_evidence_relation",
      "validation",
      "Evidence self-relations are not allowed.",
    );
  }
  if (!EVIDENCE_RELATION_TYPES.includes(draft.relationType)) {
    failMemory("invalid_evidence_relation", "validation", "Evidence relation type is unsupported.");
  }
  validateTimestamp(draft.recordedAt);
  if (draft.actorId !== undefined) validatePublicIdentity(draft.actorId, "actorId");
  if (draft.operationId !== undefined) validatePublicIdentity(draft.operationId, "operationId");
  const normalized = canonicalizeJson({
    relationSchemaVersion: EVIDENCE_RELATION_SCHEMA_VERSION,
    ...draft,
    metadata: draft.metadata ?? {},
  }) as unknown as Omit<EvidenceRelationRecord, "canonicalContent">;
  const canonicalContent = canonicalStringify(normalized);
  return deepFreezeJson({ ...normalized, canonicalContent }) as Readonly<EvidenceRelationRecord>;
}

export function canonicalEvidenceRecord(record: Readonly<EvidenceRecord>): string {
  return canonicalStringify(record);
}

function validateEvidenceDraft(draft: Readonly<EvidenceDraft>): void {
  validatePublicIdentity(draft.evidenceId, "evidenceId");
  validatePublicIdentity(draft.domainId, "domainId");
  validatePublicIdentity(draft.domainVersion, "domainVersion");
  validatePublicIdentity(draft.sourceSchemaId, "sourceSchemaId");
  validatePublicIdentity(draft.sourceIdentity, "sourceIdentity");
  if (!EVIDENCE_SOURCE_TYPES.includes(draft.sourceType)) {
    failMemory("invalid_evidence", "validation", "Evidence source type is unsupported.");
  }
  if (!Number.isSafeInteger(draft.sourceSchemaVersion) || draft.sourceSchemaVersion < 1) {
    failMemory("invalid_evidence", "validation", "Source schema version is invalid.");
  }
  if (!ACCEPTANCE_STATES.includes(draft.acceptanceState)) {
    failMemory("invalid_evidence", "validation", "Acceptance state is unsupported.");
  }
  if (!DATA_CLASSIFICATIONS.includes(draft.classification)) {
    failMemory("invalid_evidence", "validation", "Data classification is unsupported.");
  }
  if (!RETENTION_CLASSES.includes(draft.retentionClass)) {
    failMemory("invalid_evidence", "validation", "Retention class is unsupported.");
  }
  validateTimestamp(draft.recordedAt);
  canonicalizeJson(draft.authoritativePosition);
  canonicalizeJson(draft.payload);
  if (!Array.isArray(draft.tags) || draft.tags.some((tag) => !isPublicIdentity(tag))) {
    failMemory("invalid_evidence", "validation", "Evidence tags are invalid.");
  }
  if (new Set(draft.tags).size !== draft.tags.length) {
    failMemory("invalid_evidence", "validation", "Evidence tags must be unique.");
  }
  if (draft.actorId !== undefined) validatePublicIdentity(draft.actorId, "actorId");
  if (draft.operationId !== undefined) validatePublicIdentity(draft.operationId, "operationId");
}

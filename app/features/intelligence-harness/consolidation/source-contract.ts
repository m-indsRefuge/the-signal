import type { EvidenceRecord, EvidenceRelationRecord } from "../memory-fabric/evidence-contract";
import type {
  EpisodicMemoryRecord,
  MemoryEvidenceAttachment,
  MemoryRelationRecord,
} from "../memory-fabric/memory-contract";
import type {
  EvidenceQuery,
  MemoryQuery,
  RecordAccessPolicy,
  RetrievalBudget,
  RetrievalResult,
} from "../memory-fabric/retrieval-contract";

export interface AttachmentRetrievalRequest {
  readonly requestId: string;
  readonly memoryId: string;
  readonly access: Readonly<RecordAccessPolicy>;
  readonly budget: Readonly<RetrievalBudget>;
}

export interface ReadOnlyConsolidationSource {
  getEvidence(
    evidenceId: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<Readonly<EvidenceRecord> | null>;
  getEvidenceRelations(
    evidenceId: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<readonly Readonly<EvidenceRelationRecord>[]>;
  queryEvidence(query: Readonly<EvidenceQuery>): Promise<Readonly<RetrievalResult<EvidenceRecord>>>;

  getMemory(
    memoryId: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<Readonly<EpisodicMemoryRecord> | null>;
  getMemoryRelations(
    memoryId: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<readonly Readonly<MemoryRelationRecord>[]>;
  queryMemory(
    query: Readonly<MemoryQuery>,
  ): Promise<Readonly<RetrievalResult<EpisodicMemoryRecord>>>;
  getMemoryAttachments(
    request: Readonly<AttachmentRetrievalRequest>,
  ): Promise<Readonly<RetrievalResult<MemoryEvidenceAttachment>>>;
}

export function isReadOnlyConsolidationSource(
  value: unknown,
): value is ReadOnlyConsolidationSource {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;
  const required = [
    "getEvidence",
    "getEvidenceRelations",
    "queryEvidence",
    "getMemory",
    "getMemoryRelations",
    "queryMemory",
    "getMemoryAttachments",
  ];
  const forbidden = [
    "putEvidence",
    "putEvidenceRelation",
    "putMemory",
    "putMemoryRelation",
    "attachEvidence",
    "putEpisodeBundle",
    "update",
    "archive",
    "purge",
    "truncate",
  ];
  return (
    required.every((name) => typeof source[name] === "function") &&
    forbidden.every((name) => !(name in source))
  );
}

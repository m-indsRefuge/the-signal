import type { EvidenceRecord, EvidenceRelationRecord } from "./evidence-contract";
import type {
  EpisodicMemoryRecord,
  MemoryEvidenceAttachment,
  MemoryRelationRecord,
} from "./memory-contract";
import type {
  EvidenceQuery,
  MemoryQuery,
  RecordAccessPolicy,
  RetrievalResult,
} from "./retrieval-contract";

export interface EpisodeBundle {
  readonly memory: Readonly<EpisodicMemoryRecord>;
  readonly attachments: readonly Readonly<MemoryEvidenceAttachment>[];
}

export interface MemoryRepository {
  putEvidence(record: Readonly<EvidenceRecord>): Promise<Readonly<EvidenceRecord>>;
  getEvidence(
    evidenceId: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<Readonly<EvidenceRecord> | null>;
  putEvidenceRelation(
    record: Readonly<EvidenceRelationRecord>,
  ): Promise<Readonly<EvidenceRelationRecord>>;
  getEvidenceRelations(
    evidenceId: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<readonly Readonly<EvidenceRelationRecord>[]>;
  queryEvidence(query: Readonly<EvidenceQuery>): Promise<Readonly<RetrievalResult<EvidenceRecord>>>;

  putMemory(record: Readonly<EpisodicMemoryRecord>): Promise<Readonly<EpisodicMemoryRecord>>;
  getMemory(
    memoryId: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<Readonly<EpisodicMemoryRecord> | null>;
  attachEvidence(
    record: Readonly<MemoryEvidenceAttachment>,
  ): Promise<Readonly<MemoryEvidenceAttachment>>;
  putMemoryRelation(
    record: Readonly<MemoryRelationRecord>,
  ): Promise<Readonly<MemoryRelationRecord>>;
  getMemoryRelations(
    memoryId: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<readonly Readonly<MemoryRelationRecord>[]>;
  queryMemory(
    query: Readonly<MemoryQuery>,
  ): Promise<Readonly<RetrievalResult<EpisodicMemoryRecord>>>;
  putEpisodeBundle(bundle: Readonly<EpisodeBundle>): Promise<Readonly<EpisodeBundle>>;
}

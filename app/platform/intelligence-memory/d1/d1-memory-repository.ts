import {
  canonicalStringify,
  deepFreezeJson,
} from "../../../features/intelligence-harness/memory-fabric/canonical-json";
import {
  type EvidenceRecord,
  type EvidenceRelationRecord,
  validateEvidenceRecord,
} from "../../../features/intelligence-harness/memory-fabric/evidence-contract";
import {
  failMemory,
  sanitizeRepositoryError,
} from "../../../features/intelligence-harness/memory-fabric/failures";
import {
  type EpisodicMemoryRecord,
  type MemoryEvidenceAttachment,
  type MemoryRelationRecord,
  validateEpisodicMemoryRecord,
} from "../../../features/intelligence-harness/memory-fabric/memory-contract";
import type {
  EpisodeBundle,
  MemoryRepository,
} from "../../../features/intelligence-harness/memory-fabric/repository-contract";
import {
  authoritativeTickOf,
  validateAccessPolicy,
  validateRetrievalBudget,
  type EvidenceQuery,
  type MemoryQuery,
  type RecordAccessPolicy,
  type RetrievalResult,
} from "../../../features/intelligence-harness/memory-fabric/retrieval-contract";

export type D1Bindable = string | number | null | ArrayBuffer | ArrayBufferView;
export interface D1ResultLike<T = Record<string, unknown>> {
  readonly success: boolean;
  readonly results?: readonly T[];
  readonly meta?: Readonly<Record<string, unknown>>;
}
export interface D1PreparedStatementLike {
  bind(...values: readonly D1Bindable[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
  all?<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
}
export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = Record<string, unknown>>(
    statements: readonly D1PreparedStatementLike[],
  ): Promise<readonly D1ResultLike<T>[]>;
}

interface CanonicalRow {
  readonly id: string;
  readonly canonical_json: string;
}
interface EvidenceQueryRow extends CanonicalRow {
  readonly authoritative_tick: number | null;
  readonly recorded_at: string;
}
interface MemoryQueryRow extends CanonicalRow {
  readonly recorded_at: string;
}

export class D1MemoryRepository implements MemoryRepository {
  readonly #db: D1DatabaseLike;
  constructor(database: D1DatabaseLike) {
    if (
      !database ||
      typeof database.prepare !== "function" ||
      typeof database.batch !== "function"
    ) {
      failMemory("d1_contract_failure", "d1", "A D1-compatible binding must be injected.");
    }
    this.#db = database;
  }

  async putEvidence(record: Readonly<EvidenceRecord>): Promise<Readonly<EvidenceRecord>> {
    try {
      await validateEvidenceRecord(record);
      return await this.#putCanonical(
        "ih_evidence_records",
        "evidence_id",
        record.evidenceId,
        canonicalStringify(record),
        this.#db
          .prepare(
            `INSERT INTO ih_evidence_records (
          evidence_id, canonical_json, content_digest, domain_id, domain_version, source_type,
          source_schema_id, source_schema_version, source_identity, authoritative_position_json,
          authoritative_tick, acceptance_state, classification, retention_class, tags_json, recorded_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
          )
          .bind(
            record.evidenceId,
            canonicalStringify(record),
            record.contentDigest,
            record.domainId,
            record.domainVersion,
            record.sourceType,
            record.sourceSchemaId,
            record.sourceSchemaVersion,
            record.sourceIdentity,
            canonicalStringify(record.authoritativePosition),
            authoritativeTickOf(record.authoritativePosition),
            record.acceptanceState,
            record.classification,
            record.retentionClass,
            canonicalStringify(record.tags),
            record.recordedAt,
          ),
        record,
      );
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1", record.operationId);
    }
  }

  async getEvidence(
    id: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<Readonly<EvidenceRecord> | null> {
    try {
      validateAccessPolicy(access);
      const row = await this.#db
        .prepare(
          `SELECT canonical_json FROM ih_evidence_records
        WHERE evidence_id = ?1 AND domain_id IN (${placeholders(access.allowedDomains.length, 2)})
        AND classification IN (${placeholders(access.allowedClassifications.length, 2 + access.allowedDomains.length)})
        AND retention_class IN (${placeholders(access.acceptedRetentionClasses.length, 2 + access.allowedDomains.length + access.allowedClassifications.length)})
        LIMIT 1`,
        )
        .bind(
          id,
          ...access.allowedDomains,
          ...access.allowedClassifications,
          ...access.acceptedRetentionClasses,
        )
        .first<CanonicalRow>();
      return row === null ? null : parseRecord<EvidenceRecord>(row.canonical_json, "evidence");
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1");
    }
  }

  async putEvidenceRelation(
    record: Readonly<EvidenceRelationRecord>,
  ): Promise<Readonly<EvidenceRelationRecord>> {
    try {
      await this.#assertExists(
        "ih_evidence_records",
        "evidence_id",
        record.sourceEvidenceId,
        "missing_evidence",
      );
      await this.#assertExists(
        "ih_evidence_records",
        "evidence_id",
        record.targetEvidenceId,
        "missing_evidence",
      );
      if (
        record.relationType === "derived_from" ||
        record.relationType === "corrects" ||
        record.relationType === "supersedes"
      ) {
        const cycle = await this.#db
          .prepare(
            `WITH RECURSIVE lineage(id) AS (
          SELECT target_evidence_id FROM ih_evidence_relations WHERE source_evidence_id = ?1 AND relation_type IN ('derived_from','corrects','supersedes')
          UNION SELECT r.target_evidence_id FROM ih_evidence_relations r JOIN lineage l ON r.source_evidence_id = l.id
          WHERE r.relation_type IN ('derived_from','corrects','supersedes')
        ) SELECT id FROM lineage WHERE id = ?2 LIMIT 1`,
          )
          .bind(record.targetEvidenceId, record.sourceEvidenceId)
          .first<{ id: string }>();
        if (cycle !== null)
          failMemory("lineage_cycle", "d1", "Evidence lineage cycle rejected.", {
            operationId: record.operationId,
          });
      }
      return await this.#putCanonical(
        "ih_evidence_relations",
        "relation_id",
        record.relationId,
        record.canonicalContent,
        this.#db
          .prepare(
            `INSERT INTO ih_evidence_relations (relation_id, canonical_json, relation_type, source_evidence_id, target_evidence_id, recorded_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(
            record.relationId,
            record.canonicalContent,
            record.relationType,
            record.sourceEvidenceId,
            record.targetEvidenceId,
            record.recordedAt,
          ),
        record,
      );
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1", record.operationId);
    }
  }

  async getEvidenceRelations(
    id: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<readonly Readonly<EvidenceRelationRecord>[]> {
    try {
      validateAccessPolicy(access);
      const rows = await allRows<CanonicalRow>(
        this.#db
          .prepare(
            `SELECT r.relation_id AS id, r.canonical_json
        FROM ih_evidence_relations r
        JOIN ih_evidence_records s ON s.evidence_id=r.source_evidence_id
        JOIN ih_evidence_records t ON t.evidence_id=r.target_evidence_id
        WHERE (r.source_evidence_id=?1 OR r.target_evidence_id=?1)
        AND s.domain_id IN (${placeholders(access.allowedDomains.length, 2)}) AND t.domain_id IN (${placeholders(access.allowedDomains.length, 2)})
        AND s.classification IN (${placeholders(access.allowedClassifications.length, 2 + access.allowedDomains.length)})
        AND t.classification IN (${placeholders(access.allowedClassifications.length, 2 + access.allowedDomains.length)})
        AND s.retention_class IN (${placeholders(access.acceptedRetentionClasses.length, 2 + access.allowedDomains.length + access.allowedClassifications.length)})
        AND t.retention_class IN (${placeholders(access.acceptedRetentionClasses.length, 2 + access.allowedDomains.length + access.allowedClassifications.length)})
        ORDER BY r.recorded_at ASC, r.relation_id ASC LIMIT 512`,
          )
          .bind(
            id,
            ...access.allowedDomains,
            ...access.allowedClassifications,
            ...access.acceptedRetentionClasses,
          ),
      );
      return deepFreezeJson(
        rows.map((row) =>
          parseRecord<EvidenceRelationRecord>(row.canonical_json, "evidence relation"),
        ),
      );
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1");
    }
  }

  async queryEvidence(
    query: Readonly<EvidenceQuery>,
  ): Promise<Readonly<RetrievalResult<EvidenceRecord>>> {
    try {
      validateAccessPolicy(query);
      validateRetrievalBudget(query.budget);
      const clauses = [
        `domain_id IN (${placeholders(query.allowedDomains.length, 1)})`,
        `classification IN (${placeholders(query.allowedClassifications.length, 1 + query.allowedDomains.length)})`,
        `retention_class IN (${placeholders(query.acceptedRetentionClasses.length, 1 + query.allowedDomains.length + query.allowedClassifications.length)})`,
      ];
      const values: D1Bindable[] = [
        ...query.allowedDomains,
        ...query.allowedClassifications,
        ...query.acceptedRetentionClasses,
      ];
      addIn(clauses, values, "evidence_id", query.evidenceIds);
      addIn(clauses, values, "source_type", query.sourceTypes);
      addIn(clauses, values, "acceptance_state", query.acceptanceStates);
      if (query.recordedAtFrom) {
        clauses.push(`recorded_at >= ?${values.length + 1}`);
        values.push(query.recordedAtFrom);
      }
      if (query.recordedAtTo) {
        clauses.push(`recorded_at <= ?${values.length + 1}`);
        values.push(query.recordedAtTo);
      }
      if (query.authoritativeTickFrom !== undefined) {
        clauses.push(`authoritative_tick >= ?${values.length + 1}`);
        values.push(query.authoritativeTickFrom);
      }
      if (query.authoritativeTickTo !== undefined) {
        clauses.push(`authoritative_tick <= ?${values.length + 1}`);
        values.push(query.authoritativeTickTo);
      }
      const fetchLimit = Math.min(
        4096,
        Math.max(query.budget.resultLimit * 8, query.budget.resultLimit),
      );
      values.push(fetchLimit);
      const rows = await allRows<EvidenceQueryRow>(
        this.#db
          .prepare(
            `SELECT evidence_id AS id, canonical_json, authoritative_tick, recorded_at FROM ih_evidence_records WHERE ${clauses.join(" AND ")}
        ORDER BY authoritative_tick DESC, recorded_at DESC, evidence_id ASC LIMIT ?${values.length}`,
          )
          .bind(...values),
      );
      const records = rows
        .map((row) => parseRecord<EvidenceRecord>(row.canonical_json, "evidence"))
        .filter((record) => !query.tags || query.tags.every((tag) => record.tags.includes(tag)));
      return pack(records, query.budget, ["domain", "classification", "retention"]);
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1");
    }
  }

  async putMemory(record: Readonly<EpisodicMemoryRecord>): Promise<Readonly<EpisodicMemoryRecord>> {
    try {
      await validateEpisodicMemoryRecord(record);
      return await this.#putCanonical(
        "ih_memory_records",
        "memory_id",
        record.memoryId,
        canonicalStringify(record),
        this.#memoryInsert(record),
        record,
      );
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1", record.operationId);
    }
  }

  async getMemory(
    id: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<Readonly<EpisodicMemoryRecord> | null> {
    try {
      validateAccessPolicy(access);
      const row = await this.#db
        .prepare(
          `SELECT canonical_json FROM ih_memory_records WHERE memory_id=?1 AND domain_id IN (${placeholders(access.allowedDomains.length, 2)}) AND classification IN (${placeholders(access.allowedClassifications.length, 2 + access.allowedDomains.length)}) AND retention_class IN (${placeholders(access.acceptedRetentionClasses.length, 2 + access.allowedDomains.length + access.allowedClassifications.length)}) LIMIT 1`,
        )
        .bind(
          id,
          ...access.allowedDomains,
          ...access.allowedClassifications,
          ...access.acceptedRetentionClasses,
        )
        .first<CanonicalRow>();
      return row === null ? null : parseRecord<EpisodicMemoryRecord>(row.canonical_json, "memory");
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1");
    }
  }

  async attachEvidence(
    record: Readonly<MemoryEvidenceAttachment>,
  ): Promise<Readonly<MemoryEvidenceAttachment>> {
    try {
      await this.#assertExists("ih_memory_records", "memory_id", record.memoryId, "invalid_memory");
      await this.#assertExists(
        "ih_evidence_records",
        "evidence_id",
        record.evidenceId,
        "missing_evidence",
      );
      return await this.#putCanonical(
        "ih_memory_evidence",
        "attachment_id",
        record.attachmentId,
        record.canonicalContent,
        this.#attachmentInsert(record),
        record,
      );
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1");
    }
  }

  async putMemoryRelation(
    record: Readonly<MemoryRelationRecord>,
  ): Promise<Readonly<MemoryRelationRecord>> {
    try {
      await this.#assertExists(
        "ih_memory_records",
        "memory_id",
        record.sourceMemoryId,
        "invalid_memory",
      );
      await this.#assertExists(
        "ih_memory_records",
        "memory_id",
        record.targetMemoryId,
        "invalid_memory",
      );
      return await this.#putCanonical(
        "ih_memory_relations",
        "relation_id",
        record.relationId,
        record.canonicalContent,
        this.#db
          .prepare(
            `INSERT INTO ih_memory_relations (relation_id,canonical_json,relation_type,source_memory_id,target_memory_id,recorded_at) VALUES (?1,?2,?3,?4,?5,?6)`,
          )
          .bind(
            record.relationId,
            record.canonicalContent,
            record.relationType,
            record.sourceMemoryId,
            record.targetMemoryId,
            record.recordedAt,
          ),
        record,
      );
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1", record.operationId);
    }
  }

  async getMemoryRelations(
    id: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<readonly Readonly<MemoryRelationRecord>[]> {
    try {
      validateAccessPolicy(access);
      const rows = await allRows<CanonicalRow>(
        this.#db
          .prepare(
            `SELECT r.relation_id AS id,r.canonical_json FROM ih_memory_relations r JOIN ih_memory_records s ON s.memory_id=r.source_memory_id JOIN ih_memory_records t ON t.memory_id=r.target_memory_id WHERE (r.source_memory_id=?1 OR r.target_memory_id=?1) AND s.domain_id IN (${placeholders(access.allowedDomains.length, 2)}) AND t.domain_id IN (${placeholders(access.allowedDomains.length, 2)}) AND s.classification IN (${placeholders(access.allowedClassifications.length, 2 + access.allowedDomains.length)}) AND t.classification IN (${placeholders(access.allowedClassifications.length, 2 + access.allowedDomains.length)}) ORDER BY r.recorded_at ASC,r.relation_id ASC LIMIT 512`,
          )
          .bind(id, ...access.allowedDomains, ...access.allowedClassifications),
      );
      return deepFreezeJson(
        rows.map((row) => parseRecord<MemoryRelationRecord>(row.canonical_json, "memory relation")),
      );
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1");
    }
  }

  async queryMemory(
    query: Readonly<MemoryQuery>,
  ): Promise<Readonly<RetrievalResult<EpisodicMemoryRecord>>> {
    try {
      validateAccessPolicy(query);
      validateRetrievalBudget(query.budget);
      const clauses = [
        `domain_id IN (${placeholders(query.allowedDomains.length, 1)})`,
        `classification IN (${placeholders(query.allowedClassifications.length, 1 + query.allowedDomains.length)})`,
        `retention_class IN (${placeholders(query.acceptedRetentionClasses.length, 1 + query.allowedDomains.length + query.allowedClassifications.length)})`,
      ];
      const values: D1Bindable[] = [
        ...query.allowedDomains,
        ...query.allowedClassifications,
        ...query.acceptedRetentionClasses,
      ];
      addIn(clauses, values, "memory_id", query.memoryIds);
      addIn(clauses, values, "memory_kind", query.memoryKinds);
      addIn(clauses, values, "acceptance_state", query.acceptanceStates);
      if (query.recordedAtFrom) {
        clauses.push(`recorded_at>=?${values.length + 1}`);
        values.push(query.recordedAtFrom);
      }
      if (query.recordedAtTo) {
        clauses.push(`recorded_at<=?${values.length + 1}`);
        values.push(query.recordedAtTo);
      }
      const fetchLimit = Math.min(
        4096,
        Math.max(query.budget.resultLimit * 8, query.budget.resultLimit),
      );
      values.push(fetchLimit);
      const rows = await allRows<MemoryQueryRow>(
        this.#db
          .prepare(
            `SELECT memory_id AS id,canonical_json,recorded_at FROM ih_memory_records WHERE ${clauses.join(" AND ")} ORDER BY recorded_at DESC,memory_id ASC LIMIT ?${values.length}`,
          )
          .bind(...values),
      );
      let records = rows
        .map((row) => parseRecord<EpisodicMemoryRecord>(row.canonical_json, "memory"))
        .filter((record) => !query.tags || query.tags.every((tag) => record.tags.includes(tag)));
      if (query.attachedEvidenceId) {
        const attached = await allRows<{ memory_id: string }>(
          this.#db
            .prepare(`SELECT memory_id FROM ih_memory_evidence WHERE evidence_id=?1 LIMIT 4096`)
            .bind(query.attachedEvidenceId),
        );
        const ids = new Set(attached.map((row) => row.memory_id));
        records = records.filter((record) => ids.has(record.memoryId));
      }
      return pack(records, query.budget, ["domain", "classification", "retention"]);
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1");
    }
  }

  async putEpisodeBundle(bundle: Readonly<EpisodeBundle>): Promise<Readonly<EpisodeBundle>> {
    try {
      await validateEpisodicMemoryRecord(bundle.memory);
      for (const item of bundle.attachments)
        await this.#assertExists(
          "ih_evidence_records",
          "evidence_id",
          item.evidenceId,
          "missing_evidence",
        );
      const existing = await this.#db
        .prepare(`SELECT canonical_json FROM ih_memory_records WHERE memory_id=?1 LIMIT 1`)
        .bind(bundle.memory.memoryId)
        .first<CanonicalRow>();
      if (existing !== null) {
        if (existing.canonical_json !== canonicalStringify(bundle.memory))
          failMemory("identity_collision", "d1", "Memory identity collision.");
        return deepFreezeJson(bundle);
      }
      const statements = [
        this.#memoryInsert(bundle.memory),
        ...bundle.attachments.map((item) => this.#attachmentInsert(item)),
      ];
      const results = await this.#db.batch(statements);
      if (results.some((result) => result.success !== true))
        failMemory("repository_failure", "d1", "Atomic episode insertion failed.");
      return deepFreezeJson(JSON.parse(JSON.stringify(bundle)) as EpisodeBundle);
    } catch (error) {
      if (isMemoryError(error)) throw error;
      throw sanitizeRepositoryError("d1", bundle.memory.operationId);
    }
  }

  async #putCanonical<T>(
    table: string,
    idColumn: string,
    id: string,
    canonical: string,
    insert: D1PreparedStatementLike,
    record: Readonly<T>,
  ): Promise<Readonly<T>> {
    const existing = await this.#db
      .prepare(`SELECT canonical_json FROM ${table} WHERE ${idColumn}=?1 LIMIT 1`)
      .bind(id)
      .first<CanonicalRow>();
    if (existing !== null) {
      if (existing.canonical_json !== canonical)
        failMemory("identity_collision", "d1", "Record identity collision.");
      return deepFreezeJson(JSON.parse(existing.canonical_json) as T);
    }
    const result = await insert.run();
    if (result.success !== true)
      failMemory("repository_failure", "d1", "Repository insertion failed.");
    return deepFreezeJson(JSON.parse(JSON.stringify(record)) as T);
  }
  async #assertExists(
    table: string,
    column: string,
    id: string,
    code: "missing_evidence" | "invalid_memory",
  ): Promise<void> {
    const row = await this.#db
      .prepare(`SELECT ${column} AS id FROM ${table} WHERE ${column}=?1 LIMIT 1`)
      .bind(id)
      .first<{ id: string }>();
    if (row === null) failMemory(code, "d1", "Referenced record does not exist.");
  }
  #memoryInsert(record: Readonly<EpisodicMemoryRecord>): D1PreparedStatementLike {
    return this.#db
      .prepare(
        `INSERT INTO ih_memory_records (memory_id,canonical_json,content_digest,memory_kind,domain_id,domain_version,significance,acceptance_state,classification,retention_class,tags_json,recorded_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
      )
      .bind(
        record.memoryId,
        canonicalStringify(record),
        record.contentDigest,
        record.memoryKind,
        record.domainId,
        record.domainVersion,
        record.significance,
        record.acceptanceState,
        record.classification,
        record.retentionClass,
        canonicalStringify(record.tags),
        record.recordedAt,
      );
  }
  #attachmentInsert(record: Readonly<MemoryEvidenceAttachment>): D1PreparedStatementLike {
    return this.#db
      .prepare(
        `INSERT INTO ih_memory_evidence (attachment_id,canonical_json,memory_id,evidence_id,role,sequence) VALUES (?1,?2,?3,?4,?5,?6)`,
      )
      .bind(
        record.attachmentId,
        record.canonicalContent,
        record.memoryId,
        record.evidenceId,
        record.role,
        record.sequence,
      );
  }
}

function placeholders(count: number, start: number): string {
  return Array.from({ length: count }, (_, index) => `?${start + index}`).join(",");
}
function addIn(
  clauses: string[],
  values: D1Bindable[],
  column: string,
  input: readonly (string | number)[] | undefined,
): void {
  if (!input || input.length === 0) return;
  const start = values.length + 1;
  clauses.push(`${column} IN (${placeholders(input.length, start)})`);
  values.push(...input);
}
async function allRows<T>(statement: D1PreparedStatementLike): Promise<readonly T[]> {
  const result = statement.all ? await statement.all<T>() : await statement.run<T>();
  if (result.success !== true) failMemory("repository_failure", "d1", "D1 query failed.");
  return result.results ?? [];
}
function parseRecord<T>(text: string, label: string): Readonly<T> {
  try {
    const value = JSON.parse(text) as T;
    return deepFreezeJson(value);
  } catch {
    failMemory("d1_contract_failure", "d1", `Stored ${label} row is malformed.`);
  }
}
function pack<T extends object>(
  records: readonly Readonly<T>[],
  budget: { resultLimit: number; maximumSerializedCharacters: number },
  filters: string[],
): Readonly<RetrievalResult<T>> {
  const selected: Readonly<T>[] = [];
  let chars = 0;
  for (const record of records) {
    if (selected.length >= budget.resultLimit) break;
    const size = canonicalStringify(record).length;
    if (chars + size > budget.maximumSerializedCharacters) break;
    selected.push(record);
    chars += size;
  }
  return deepFreezeJson({
    records: selected,
    metadata: {
      sourceMatchCount: records.length,
      returnedCount: selected.length,
      omittedCount: records.length - selected.length,
      truncated: selected.length < records.length,
      serializedCharacters: chars,
      orderingPolicy: "authoritative_position_desc_recorded_at_desc_identity_asc",
      appliedFilters: filters,
    },
  }) as Readonly<RetrievalResult<T>>;
}
function isMemoryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "details" in error;
}

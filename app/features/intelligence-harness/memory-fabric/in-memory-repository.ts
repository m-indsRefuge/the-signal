import { canonicalStringify, deepFreezeJson } from "./canonical-json";
import {
  canonicalEvidenceRecord,
  type EvidenceRecord,
  type EvidenceRelationRecord,
  validateEvidenceRecord,
} from "./evidence-contract";
import { failMemory } from "./failures";
import {
  type EpisodicMemoryRecord,
  type MemoryEvidenceAttachment,
  type MemoryRelationRecord,
  validateEpisodicMemoryRecord,
} from "./memory-contract";
import type { EpisodeBundle, MemoryRepository } from "./repository-contract";
import {
  authoritativeTickOf,
  validateAccessPolicy,
  validateRetrievalBudget,
  type EvidenceQuery,
  type MemoryQuery,
  type RecordAccessPolicy,
  type RetrievalResult,
} from "./retrieval-contract";

const LINEAGE_EVIDENCE_TYPES = new Set(["derived_from", "corrects", "supersedes"]);
const LINEAGE_MEMORY_TYPES = new Set(["continues", "corrects", "supersedes", "derived_from"]);

export class InMemoryMemoryRepository implements MemoryRepository {
  readonly #evidence = new Map<string, Readonly<EvidenceRecord>>();
  readonly #evidenceCanonical = new Map<string, string>();
  readonly #evidenceRelations = new Map<string, Readonly<EvidenceRelationRecord>>();
  readonly #memory = new Map<string, Readonly<EpisodicMemoryRecord>>();
  readonly #memoryCanonical = new Map<string, string>();
  readonly #attachments = new Map<string, Readonly<MemoryEvidenceAttachment>>();
  readonly #memoryRelations = new Map<string, Readonly<MemoryRelationRecord>>();
  #mutationQueue: Promise<void> = Promise.resolve();
  #disposed = false;

  async putEvidence(record: Readonly<EvidenceRecord>): Promise<Readonly<EvidenceRecord>> {
    return this.#mutate(async () => {
      await validateEvidenceRecord(record);
      return this.#putCanonical(
        this.#evidence,
        this.#evidenceCanonical,
        record.evidenceId,
        record,
        canonicalEvidenceRecord(record),
      );
    });
  }

  async getEvidence(
    id: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<Readonly<EvidenceRecord> | null> {
    this.#assertActive();
    validateAccessPolicy(access);
    const record = this.#evidence.get(id);
    return record !== undefined && this.#visible(record, access) ? cloneFrozen(record) : null;
  }

  async putEvidenceRelation(
    record: Readonly<EvidenceRelationRecord>,
  ): Promise<Readonly<EvidenceRelationRecord>> {
    return this.#mutate(async () => {
      this.#requireEvidence(record.sourceEvidenceId);
      this.#requireEvidence(record.targetEvidenceId);
      if (
        LINEAGE_EVIDENCE_TYPES.has(record.relationType) &&
        this.#wouldCycleEvidence(record.sourceEvidenceId, record.targetEvidenceId)
      ) {
        failMemory("lineage_cycle", "repository", "Evidence lineage cycle rejected.", {
          operationId: record.operationId,
        });
      }
      return this.#putRelation(
        this.#evidenceRelations,
        record.relationId,
        record,
        record.canonicalContent,
      );
    });
  }

  async getEvidenceRelations(
    id: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<readonly Readonly<EvidenceRelationRecord>[]> {
    this.#assertActive();
    validateAccessPolicy(access);
    const result = [...this.#evidenceRelations.values()]
      .filter(
        (relation) =>
          (relation.sourceEvidenceId === id || relation.targetEvidenceId === id) &&
          this.#relationEvidenceVisible(relation, access),
      )
      .sort(
        (a, b) =>
          a.recordedAt.localeCompare(b.recordedAt) || a.relationId.localeCompare(b.relationId),
      );
    return deepFreezeJson(result.map(cloneFrozen)) as readonly Readonly<EvidenceRelationRecord>[];
  }

  async queryEvidence(
    query: Readonly<EvidenceQuery>,
  ): Promise<Readonly<RetrievalResult<EvidenceRecord>>> {
    this.#assertActive();
    validateAccessPolicy(query);
    validateRetrievalBudget(query.budget);
    let records = [...this.#evidence.values()].filter((record) => this.#visible(record, query));
    records = records.filter((record) => this.#matchesEvidence(record, query));
    if (query.relationType && query.relationEvidenceId) {
      const ids = new Set(
        this.#relatedEvidenceIds(query.relationEvidenceId, query.relationType, query),
      );
      records = records.filter((record) => ids.has(record.evidenceId));
    }
    records.sort(compareEvidence);
    return pack(records, query.budget, evidenceFilters(query));
  }

  async putMemory(record: Readonly<EpisodicMemoryRecord>): Promise<Readonly<EpisodicMemoryRecord>> {
    return this.#mutate(async () => {
      await validateEpisodicMemoryRecord(record);
      return this.#putCanonical(
        this.#memory,
        this.#memoryCanonical,
        record.memoryId,
        record,
        canonicalStringify(record),
      );
    });
  }

  async getMemory(
    id: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<Readonly<EpisodicMemoryRecord> | null> {
    this.#assertActive();
    validateAccessPolicy(access);
    const record = this.#memory.get(id);
    return record !== undefined && this.#visible(record, access) ? cloneFrozen(record) : null;
  }

  async attachEvidence(
    record: Readonly<MemoryEvidenceAttachment>,
  ): Promise<Readonly<MemoryEvidenceAttachment>> {
    return this.#mutate(async () => {
      this.#requireMemory(record.memoryId);
      this.#requireEvidence(record.evidenceId);
      return this.#putRelation(
        this.#attachments,
        record.attachmentId,
        record,
        record.canonicalContent,
      );
    });
  }

  async putMemoryRelation(
    record: Readonly<MemoryRelationRecord>,
  ): Promise<Readonly<MemoryRelationRecord>> {
    return this.#mutate(async () => {
      this.#requireMemory(record.sourceMemoryId);
      this.#requireMemory(record.targetMemoryId);
      if (
        LINEAGE_MEMORY_TYPES.has(record.relationType) &&
        this.#wouldCycleMemory(record.sourceMemoryId, record.targetMemoryId)
      ) {
        failMemory("lineage_cycle", "repository", "Memory lineage cycle rejected.", {
          operationId: record.operationId,
        });
      }
      return this.#putRelation(
        this.#memoryRelations,
        record.relationId,
        record,
        record.canonicalContent,
      );
    });
  }

  async getMemoryRelations(
    id: string,
    access: Readonly<RecordAccessPolicy>,
  ): Promise<readonly Readonly<MemoryRelationRecord>[]> {
    this.#assertActive();
    validateAccessPolicy(access);
    const result = [...this.#memoryRelations.values()]
      .filter((relation) => {
        if (relation.sourceMemoryId !== id && relation.targetMemoryId !== id) return false;
        const source = this.#memory.get(relation.sourceMemoryId);
        const target = this.#memory.get(relation.targetMemoryId);
        return (
          source !== undefined &&
          target !== undefined &&
          this.#visible(source, access) &&
          this.#visible(target, access)
        );
      })
      .sort(
        (a, b) =>
          a.recordedAt.localeCompare(b.recordedAt) || a.relationId.localeCompare(b.relationId),
      );
    return deepFreezeJson(result.map(cloneFrozen)) as readonly Readonly<MemoryRelationRecord>[];
  }

  async queryMemory(
    query: Readonly<MemoryQuery>,
  ): Promise<Readonly<RetrievalResult<EpisodicMemoryRecord>>> {
    this.#assertActive();
    validateAccessPolicy(query);
    validateRetrievalBudget(query.budget);
    let records = [...this.#memory.values()].filter(
      (record) => this.#visible(record, query) && this.#matchesMemory(record, query),
    );
    if (query.attachedEvidenceId) {
      const ids = new Set(
        [...this.#attachments.values()]
          .filter((item) => item.evidenceId === query.attachedEvidenceId)
          .map((item) => item.memoryId),
      );
      records = records.filter((record) => ids.has(record.memoryId));
    }
    if (query.relationType && query.relationMemoryId) {
      const ids = new Set(
        [...this.#memoryRelations.values()]
          .filter((relation) => {
            const typeMatch =
              query.relationType === "contradiction"
                ? relation.relationType === "contradicts"
                : true;
            return (
              typeMatch &&
              (relation.sourceMemoryId === query.relationMemoryId ||
                relation.targetMemoryId === query.relationMemoryId)
            );
          })
          .map((relation) =>
            relation.sourceMemoryId === query.relationMemoryId
              ? relation.targetMemoryId
              : relation.sourceMemoryId,
          ),
      );
      records = records.filter((record) => ids.has(record.memoryId));
    }
    records.sort(compareMemory);
    return pack(records, query.budget, memoryFilters(query));
  }

  async putEpisodeBundle(bundle: Readonly<EpisodeBundle>): Promise<Readonly<EpisodeBundle>> {
    return this.#mutate(async () => {
      await validateEpisodicMemoryRecord(bundle.memory);
      for (const attachment of bundle.attachments) this.#requireEvidence(attachment.evidenceId);
      const memoryCanonical = canonicalStringify(bundle.memory);
      const existing = this.#memoryCanonical.get(bundle.memory.memoryId);
      if (existing !== undefined && existing !== memoryCanonical)
        failMemory("identity_collision", "repository", "Memory identity collision.");
      for (const attachment of bundle.attachments) {
        const prior = this.#attachments.get(attachment.attachmentId);
        if (prior !== undefined && prior.canonicalContent !== attachment.canonicalContent)
          failMemory("identity_collision", "repository", "Attachment identity collision.");
      }
      this.#putCanonical(
        this.#memory,
        this.#memoryCanonical,
        bundle.memory.memoryId,
        bundle.memory,
        memoryCanonical,
      );
      for (const attachment of bundle.attachments)
        this.#putRelation(
          this.#attachments,
          attachment.attachmentId,
          attachment,
          attachment.canonicalContent,
        );
      return cloneFrozen(bundle);
    });
  }

  dispose(): void {
    this.#evidence.clear();
    this.#evidenceCanonical.clear();
    this.#evidenceRelations.clear();
    this.#memory.clear();
    this.#memoryCanonical.clear();
    this.#attachments.clear();
    this.#memoryRelations.clear();
    this.#disposed = true;
  }

  async #mutate<T>(operation: () => Promise<T>): Promise<T> {
    this.#assertActive();
    let resolveGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve;
    });
    const previous = this.#mutationQueue;
    this.#mutationQueue = previous.then(() => gate);
    await previous;
    try {
      this.#assertActive();
      return await operation();
    } finally {
      resolveGate();
    }
  }

  #assertActive(): void {
    if (this.#disposed) failMemory("repository_disposed", "repository", "Repository is disposed.");
  }
  #requireEvidence(id: string): void {
    if (!this.#evidence.has(id))
      failMemory("missing_evidence", "repository", "Referenced evidence does not exist.");
  }
  #requireMemory(id: string): void {
    if (!this.#memory.has(id))
      failMemory("invalid_memory", "repository", "Referenced memory does not exist.");
  }

  #putCanonical<T extends object>(
    map: Map<string, Readonly<T>>,
    canonicalMap: Map<string, string>,
    id: string,
    record: Readonly<T>,
    canonical: string,
  ): Readonly<T> {
    const existing = canonicalMap.get(id);
    if (existing !== undefined) {
      if (existing !== canonical)
        failMemory("identity_collision", "repository", "Record identity collision.");
      return cloneFrozen(map.get(id)!);
    }
    const clone = cloneFrozen(record);
    map.set(id, clone);
    canonicalMap.set(id, canonical);
    return cloneFrozen(clone);
  }
  #putRelation<T extends object>(
    map: Map<string, Readonly<T>>,
    id: string,
    record: Readonly<T>,
    canonical: string,
  ): Readonly<T> {
    const existing = map.get(id) as (Readonly<T> & { canonicalContent?: string }) | undefined;
    if (existing !== undefined) {
      if (existing.canonicalContent !== canonical)
        failMemory("identity_collision", "repository", "Relation identity collision.");
      return cloneFrozen(existing);
    }
    const clone = cloneFrozen(record);
    map.set(id, clone);
    return cloneFrozen(clone);
  }
  #visible(
    record: { domainId: string; classification: string; retentionClass: string },
    access: Readonly<RecordAccessPolicy>,
  ): boolean {
    return (
      access.allowedDomains.includes(record.domainId) &&
      access.allowedClassifications.includes(record.classification as never) &&
      access.acceptedRetentionClasses.includes(record.retentionClass as never)
    );
  }
  #relationEvidenceVisible(
    relation: EvidenceRelationRecord,
    access: Readonly<RecordAccessPolicy>,
  ): boolean {
    const source = this.#evidence.get(relation.sourceEvidenceId),
      target = this.#evidence.get(relation.targetEvidenceId);
    return (
      source !== undefined &&
      target !== undefined &&
      this.#visible(source, access) &&
      this.#visible(target, access)
    );
  }
  #matchesEvidence(record: EvidenceRecord, query: EvidenceQuery): boolean {
    const tick = authoritativeTickOf(record.authoritativePosition);
    return (
      (!query.evidenceIds || query.evidenceIds.includes(record.evidenceId)) &&
      (!query.sourceTypes || query.sourceTypes.includes(record.sourceType)) &&
      (!query.acceptanceStates || query.acceptanceStates.includes(record.acceptanceState)) &&
      (!query.tags || query.tags.every((tag) => record.tags.includes(tag))) &&
      (!query.recordedAtFrom || record.recordedAt >= query.recordedAtFrom) &&
      (!query.recordedAtTo || record.recordedAt <= query.recordedAtTo) &&
      (!query.authoritativeTickFrom || (tick !== null && tick >= query.authoritativeTickFrom)) &&
      (!query.authoritativeTickTo || (tick !== null && tick <= query.authoritativeTickTo))
    );
  }
  #matchesMemory(record: EpisodicMemoryRecord, query: MemoryQuery): boolean {
    return (
      (!query.memoryIds || query.memoryIds.includes(record.memoryId)) &&
      (!query.memoryKinds || query.memoryKinds.includes(record.memoryKind)) &&
      (!query.acceptanceStates || query.acceptanceStates.includes(record.acceptanceState)) &&
      (!query.tags || query.tags.every((tag) => record.tags.includes(tag))) &&
      (!query.recordedAtFrom || record.recordedAt >= query.recordedAtFrom) &&
      (!query.recordedAtTo || record.recordedAt <= query.recordedAtTo)
    );
  }
  #relatedEvidenceIds(
    id: string,
    kind: "lineage" | "contradiction",
    access: RecordAccessPolicy,
  ): string[] {
    return [...this.#evidenceRelations.values()]
      .filter(
        (relation) =>
          this.#relationEvidenceVisible(relation, access) &&
          (kind === "contradiction"
            ? relation.relationType === "contradicts"
            : LINEAGE_EVIDENCE_TYPES.has(relation.relationType)) &&
          (relation.sourceEvidenceId === id || relation.targetEvidenceId === id),
      )
      .map((relation) =>
        relation.sourceEvidenceId === id ? relation.targetEvidenceId : relation.sourceEvidenceId,
      );
  }
  #wouldCycleEvidence(source: string, target: string): boolean {
    return reaches(
      target,
      source,
      [...this.#evidenceRelations.values()]
        .filter((r) => LINEAGE_EVIDENCE_TYPES.has(r.relationType))
        .map((r) => [r.sourceEvidenceId, r.targetEvidenceId]),
    );
  }
  #wouldCycleMemory(source: string, target: string): boolean {
    return reaches(
      target,
      source,
      [...this.#memoryRelations.values()]
        .filter((r) => LINEAGE_MEMORY_TYPES.has(r.relationType))
        .map((r) => [r.sourceMemoryId, r.targetMemoryId]),
    );
  }
}

function cloneFrozen<T>(value: T): Readonly<T> {
  return deepFreezeJson(JSON.parse(JSON.stringify(value)) as T);
}
function reaches(
  start: string,
  target: string,
  edges: readonly (readonly [string, string])[],
): boolean {
  const seen = new Set<string>(),
    queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const [from, to] of edges) if (from === current) queue.push(to);
  }
  return false;
}
function compareEvidence(a: EvidenceRecord, b: EvidenceRecord): number {
  const at = authoritativeTickOf(a.authoritativePosition),
    bt = authoritativeTickOf(b.authoritativePosition);
  if (at !== null && bt !== null && at !== bt) return bt - at;
  return b.recordedAt.localeCompare(a.recordedAt) || a.evidenceId.localeCompare(b.evidenceId);
}
function compareMemory(a: EpisodicMemoryRecord, b: EpisodicMemoryRecord): number {
  return b.recordedAt.localeCompare(a.recordedAt) || a.memoryId.localeCompare(b.memoryId);
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
    selected.push(cloneFrozen(record));
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
function evidenceFilters(q: EvidenceQuery): string[] {
  return [
    "domain",
    "classification",
    "retention",
    q.evidenceIds ? "identity" : "",
    q.sourceTypes ? "source_type" : "",
    q.acceptanceStates ? "acceptance" : "",
    q.tags ? "tags" : "",
    q.authoritativeTickFrom !== undefined || q.authoritativeTickTo !== undefined
      ? "tick_range"
      : "",
    q.relationType ? "relation" : "",
  ].filter(Boolean);
}
function memoryFilters(q: MemoryQuery): string[] {
  return [
    "domain",
    "classification",
    "retention",
    q.memoryIds ? "identity" : "",
    q.memoryKinds ? "memory_kind" : "",
    q.acceptanceStates ? "acceptance" : "",
    q.tags ? "tags" : "",
    q.attachedEvidenceId ? "attachment" : "",
    q.relationType ? "relation" : "",
  ].filter(Boolean);
}

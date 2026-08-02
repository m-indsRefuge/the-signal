import { describe, expect, it } from "vitest";
import type {
  EvidenceRecord,
  EvidenceRelationRecord,
} from "../app/features/intelligence-harness/memory-fabric/evidence-contract";
import type {
  EpisodicMemoryRecord,
  MemoryEvidenceAttachment,
  MemoryRelationRecord,
} from "../app/features/intelligence-harness/memory-fabric/memory-contract";
import type { RetrievalResult } from "../app/features/intelligence-harness/memory-fabric/retrieval-contract";
import type { ReadOnlyConsolidationSource } from "../app/features/intelligence-harness/consolidation/source-contract";
import {
  selectEpisodes,
  type EpisodeSelectionPolicy,
} from "../app/features/intelligence-harness/consolidation/selection-contract";

const digest = "a".repeat(64);
const recordedAt = "2026-08-02T08:00:00.000Z";

describe("KTS-I4-F episode selection", () => {
  it("selects an accepted episode", async () => {
    const source = sourceFixture([memory("episode:a")]);
    const result = await selectEpisodes(source, request(policy()));
    expect(result.memories.map((item) => item.memoryId)).toEqual(["episode:a"]);
  });

  it("filters by domain version", async () => {
    const source = sourceFixture([memory("episode:a", { domainVersion: "2" })]);
    const result = await selectEpisodes(source, request(policy()));
    expect(result.memories).toHaveLength(0);
  });

  for (const significance of [
    "routine",
    "notable",
    "surprising",
    "failure",
    "correction",
    "benchmark",
  ] as const) {
    it(`filters significance ${significance}`, async () => {
      const source = sourceFixture([memory(`episode:${significance}`, { significance })]);
      const result = await selectEpisodes(
        source,
        request(
          policy({
            acceptedSignificance: [significance],
          }),
        ),
      );
      expect(result.memories[0]?.significance).toBe(significance);
    });
  }

  it("omits significance outside allowlist", async () => {
    const source = sourceFixture([memory("episode:a", { significance: "failure" })]);
    const result = await selectEpisodes(
      source,
      request(
        policy({
          acceptedSignificance: ["routine"],
        }),
      ),
    );
    expect(result.memories).toHaveLength(0);
  });

  it("preserves source ordering when requested", async () => {
    const source = sourceFixture([memory("episode:b"), memory("episode:a")]);
    const result = await selectEpisodes(source, request(policy({ ordering: "source_order" })));
    expect(result.memories.map((item) => item.memoryId)).toEqual(["episode:b", "episode:a"]);
  });

  it("uses canonical identity ordering", async () => {
    const source = sourceFixture([memory("episode:b"), memory("episode:a")]);
    const result = await selectEpisodes(
      source,
      request(policy({ ordering: "canonical_identity" })),
    );
    expect(result.memories.map((item) => item.memoryId)).toEqual(["episode:a", "episode:b"]);
  });

  it("uses recorded-at ascending ordering", async () => {
    const source = sourceFixture([
      memory("episode:b", { recordedAt: "2026-08-02T09:00:00.000Z" }),
      memory("episode:a", { recordedAt }),
    ]);
    const result = await selectEpisodes(
      source,
      request(policy({ ordering: "recorded_at_ascending" })),
    );
    expect(result.memories.map((item) => item.memoryId)).toEqual(["episode:a", "episode:b"]);
  });

  it("uses recorded-at descending ordering", async () => {
    const source = sourceFixture([
      memory("episode:a", { recordedAt }),
      memory("episode:b", { recordedAt: "2026-08-02T09:00:00.000Z" }),
    ]);
    const result = await selectEpisodes(
      source,
      request(policy({ ordering: "recorded_at_descending" })),
    );
    expect(result.memories.map((item) => item.memoryId)).toEqual(["episode:b", "episode:a"]);
  });

  it("requires evidence roles", async () => {
    const source = sourceFixture(
      [memory("episode:a")],
      [attachment("attachment:a", "episode:a", "evidence:a", "outcome")],
      [evidence("evidence:a")],
    );
    const result = await selectEpisodes(
      source,
      request(
        policy({
          requiredEvidenceRoles: ["outcome"],
        }),
      ),
    );
    expect(result.memories).toHaveLength(1);
  });

  it("omits episodes missing a required evidence role", async () => {
    const source = sourceFixture(
      [memory("episode:a")],
      [attachment("attachment:a", "episode:a", "evidence:a", "observation")],
      [evidence("evidence:a")],
    );
    const result = await selectEpisodes(
      source,
      request(
        policy({
          requiredEvidenceRoles: ["outcome"],
        }),
      ),
    );
    expect(result.memories).toHaveLength(0);
    expect(result.omittedMemoryIds).toEqual(["episode:a"]);
  });

  it("filters by authoritative tick lower bound", async () => {
    const source = sourceFixture(
      [memory("episode:a")],
      [attachment("attachment:a", "episode:a", "evidence:a", "outcome")],
      [evidence("evidence:a", 50)],
    );
    const result = await selectEpisodes(
      source,
      request(
        policy({
          authoritativeTickFrom: 40,
        }),
      ),
    );
    expect(result.memories).toHaveLength(1);
  });

  it("filters by authoritative tick upper bound", async () => {
    const source = sourceFixture(
      [memory("episode:a")],
      [attachment("attachment:a", "episode:a", "evidence:a", "outcome")],
      [evidence("evidence:a", 50)],
    );
    const result = await selectEpisodes(
      source,
      request(
        policy({
          authoritativeTickTo: 40,
        }),
      ),
    );
    expect(result.memories).toHaveLength(0);
  });

  it("reports truncated evidence references", async () => {
    const source = sourceFixture(
      [memory("episode:a")],
      [attachment("attachment:a", "episode:a", "evidence:missing", "outcome")],
      [],
    );
    const result = await selectEpisodes(source, request(policy()));
    expect(result.truncatedEvidenceIds).toEqual(["evidence:missing"]);
  });

  it("collects memory relations", async () => {
    const relation = memoryRelation("relation:memory");
    const source = sourceFixture([memory("episode:a")], [], [], [relation]);
    const result = await selectEpisodes(source, request(policy()));
    expect(result.memoryRelations).toEqual([relation]);
  });

  it("collects evidence relations", async () => {
    const relation = evidenceRelation("relation:evidence");
    const source = sourceFixture(
      [memory("episode:a")],
      [attachment("attachment:a", "episode:a", "evidence:a", "outcome")],
      [evidence("evidence:a")],
      [],
      [relation],
    );
    const result = await selectEpisodes(source, request(policy()));
    expect(result.evidenceRelations).toEqual([relation]);
  });

  it("deduplicates selected evidence", async () => {
    const source = sourceFixture(
      [memory("episode:a"), memory("episode:b")],
      [
        attachment("attachment:a", "episode:a", "evidence:a", "outcome"),
        attachment("attachment:b", "episode:b", "evidence:a", "outcome"),
      ],
      [evidence("evidence:a")],
    );
    const result = await selectEpisodes(source, request(policy()));
    expect(result.evidence).toHaveLength(1);
  });

  it("enforces result-count budget", async () => {
    const source = sourceFixture([memory("episode:a"), memory("episode:b")]);
    const result = await selectEpisodes(
      source,
      request(
        policy({
          budget: {
            resultLimit: 1,
            maximumSerializedCharacters: 100_000,
            relationTraversalLimit: 1,
          },
        }),
      ),
    );
    expect(result.memories).toHaveLength(1);
    expect(result.omittedMemoryIds).toHaveLength(1);
  });

  it("enforces serialized-character budget", async () => {
    const source = sourceFixture([
      memory("episode:a", { summary: { text: "x".repeat(1_000) } }),
      memory("episode:b", { summary: { text: "x".repeat(1_000) } }),
    ]);
    const result = await selectEpisodes(
      source,
      request(
        policy({
          budget: {
            resultLimit: 10,
            maximumSerializedCharacters: 1_500,
            relationTraversalLimit: 1,
          },
        }),
      ),
    );
    expect(result.memories.length).toBeLessThan(2);
    expect(result.metadata.truncated).toBe(true);
  });

  it("does not widen an unauthorized domain", async () => {
    await expect(
      selectEpisodes(
        sourceFixture([memory("episode:a")]),
        request(policy({ allowedDomains: ["another-domain"] })),
      ),
    ).rejects.toMatchObject({ code: "source_not_authorized" });
  });

  it("rejects zero result budgets", async () => {
    await expect(
      selectEpisodes(
        sourceFixture([]),
        request(
          policy({
            budget: { resultLimit: 0, maximumSerializedCharacters: 10, relationTraversalLimit: 0 },
          }),
        ),
      ),
    ).rejects.toBeDefined();
  });

  it("preserves contradictory relations rather than removing episodes", async () => {
    const source = sourceFixture(
      [memory("episode:a"), memory("episode:b")],
      [],
      [],
      [memoryRelation("relation:contradiction", "contradicts")],
    );
    const result = await selectEpisodes(source, request(policy()));
    expect(result.memories).toHaveLength(2);
    expect(result.memoryRelations[0]?.relationType).toBe("contradicts");
  });

  it("preserves correction relations", async () => {
    const source = sourceFixture(
      [memory("episode:a"), memory("episode:b")],
      [],
      [],
      [memoryRelation("relation:correction", "corrects")],
    );
    const result = await selectEpisodes(source, request(policy()));
    expect(result.memoryRelations[0]?.relationType).toBe("corrects");
  });

  it("does not mutate source arrays", async () => {
    const memories = [memory("episode:b"), memory("episode:a")];
    const original = memories.map((item) => item.memoryId);
    await selectEpisodes(sourceFixture(memories), request(policy()));
    expect(memories.map((item) => item.memoryId)).toEqual(original);
  });

  it("supports 10,000 selection candidates with a bounded result", async () => {
    const memories = Array.from({ length: 10_000 }, (_, index) =>
      memory(`episode:${String(index).padStart(5, "0")}`),
    );
    const result = await selectEpisodes(
      sourceFixture(memories),
      request(
        policy({
          budget: {
            resultLimit: 100,
            maximumSerializedCharacters: 10_000_000,
            relationTraversalLimit: 1,
          },
        }),
      ),
    );
    expect(result.memories).toHaveLength(100);
    expect(result.omittedMemoryIds).toHaveLength(9_900);
  });

  it("produces equivalent selections for equivalent inputs", async () => {
    const source = sourceFixture([memory("episode:b"), memory("episode:a")]);
    const first = await selectEpisodes(source, request(policy()));
    const second = await selectEpisodes(source, request(policy()));
    expect(first).toEqual(second);
  });

  it("reports applied filters", async () => {
    const result = await selectEpisodes(sourceFixture([]), request(policy()));
    expect(result.metadata.appliedFilters).toContain("domainVersion");
    expect(result.metadata.appliedFilters).toContain("significance");
  });
});

function request(policyValue: EpisodeSelectionPolicy) {
  return {
    requestId: "request:selection",
    domainId: "keep-the-signal",
    domainVersion: "1",
    policy: policyValue,
  };
}

function policy(overrides: Partial<EpisodeSelectionPolicy> = {}): EpisodeSelectionPolicy {
  return {
    requestId: "access:selection",
    allowedDomains: ["keep-the-signal"],
    allowedClassifications: ["internal"],
    acceptedRetentionClasses: ["standard", "protected", "benchmark", "training_lineage"],
    acceptedMemoryStates: ["accepted"],
    acceptedSignificance: [
      "routine",
      "notable",
      "surprising",
      "failure",
      "correction",
      "benchmark",
    ],
    ordering: "canonical_identity",
    budget: {
      resultLimit: 20_000,
      maximumSerializedCharacters: 100_000_000,
      relationTraversalLimit: 10,
    },
    evidenceBudget: {
      resultLimit: 100,
      maximumSerializedCharacters: 1_000_000,
      relationTraversalLimit: 10,
    },
    ...overrides,
  };
}

function memory(
  id: string,
  overrides: Partial<EpisodicMemoryRecord> = {},
): Readonly<EpisodicMemoryRecord> {
  return Object.freeze({
    memoryId: id,
    memoryKind: "episodic",
    memorySchemaId: "construct.memory",
    memorySchemaVersion: 1,
    domainId: "keep-the-signal",
    domainVersion: "1",
    significance: "routine",
    summary: { id },
    acceptanceState: "accepted",
    classification: "internal",
    retentionClass: "standard",
    tags: [],
    recordedAt,
    contentDigest: digest,
    ...overrides,
  });
}

function evidence(id: string, tick = 10): Readonly<EvidenceRecord> {
  return Object.freeze({
    evidenceId: id,
    evidenceSchemaId: "construct.evidence",
    evidenceSchemaVersion: 1,
    domainId: "keep-the-signal",
    domainVersion: "1",
    sourceType: "outcome",
    sourceSchemaId: "test.evidence",
    sourceSchemaVersion: 1,
    sourceIdentity: id,
    authoritativePosition: { tick },
    payload: { outcome: "stable" },
    acceptanceState: "accepted",
    classification: "internal",
    retentionClass: "standard",
    tags: [],
    recordedAt,
    contentDigest: digest,
  });
}

function attachment(
  id: string,
  memoryId: string,
  evidenceId: string,
  role: MemoryEvidenceAttachment["role"],
): Readonly<MemoryEvidenceAttachment> {
  return Object.freeze({
    attachmentId: id,
    attachmentSchemaVersion: 1,
    memoryId,
    evidenceId,
    role,
    sequence: 0,
    metadata: {},
    canonicalContent: "{}",
  });
}

function memoryRelation(
  id: string,
  relationType: MemoryRelationRecord["relationType"] = "related_to",
): Readonly<MemoryRelationRecord> {
  return Object.freeze({
    relationId: id,
    relationSchemaVersion: 1,
    relationType,
    sourceMemoryId: "episode:a",
    targetMemoryId: "episode:b",
    metadata: {},
    recordedAt,
    canonicalContent: "{}",
  });
}

function evidenceRelation(id: string): Readonly<EvidenceRelationRecord> {
  return Object.freeze({
    relationId: id,
    relationSchemaVersion: 1,
    relationType: "supports",
    sourceEvidenceId: "evidence:a",
    targetEvidenceId: "evidence:b",
    metadata: {},
    recordedAt,
    canonicalContent: "{}",
  });
}

function result<T>(records: readonly Readonly<T>[]): Readonly<RetrievalResult<T>> {
  return Object.freeze({
    records: Object.freeze([...records]),
    metadata: Object.freeze({
      returnedCount: records.length,
      omittedCount: 0,
      truncated: false,
      serializedCharacters: JSON.stringify(records).length,
      orderingPolicy: "fixture",
      appliedFilters: [],
    }),
  });
}

function sourceFixture(
  memories: readonly Readonly<EpisodicMemoryRecord>[],
  attachments: readonly Readonly<MemoryEvidenceAttachment>[] = [],
  evidenceRecords: readonly Readonly<EvidenceRecord>[] = [],
  memoryRelations: readonly Readonly<MemoryRelationRecord>[] = [],
  evidenceRelations: readonly Readonly<EvidenceRelationRecord>[] = [],
): ReadOnlyConsolidationSource {
  return {
    async getEvidence(id) {
      return evidenceRecords.find((record) => record.evidenceId === id) ?? null;
    },
    async getEvidenceRelations(id) {
      return evidenceRelations.filter(
        (relation) => relation.sourceEvidenceId === id || relation.targetEvidenceId === id,
      );
    },
    async queryEvidence() {
      return result(evidenceRecords);
    },
    async getMemory(id) {
      return memories.find((record) => record.memoryId === id) ?? null;
    },
    async getMemoryRelations(id) {
      return memoryRelations.filter(
        (relation) => relation.sourceMemoryId === id || relation.targetMemoryId === id,
      );
    },
    async queryMemory(query) {
      const ids = query.memoryIds === undefined ? null : new Set(query.memoryIds);
      const filtered = memories.filter((record) => {
        if (!query.allowedDomains.includes(record.domainId)) return false;
        if (!query.allowedClassifications.includes(record.classification)) return false;
        if (!query.acceptedRetentionClasses.includes(record.retentionClass)) return false;
        if (
          query.acceptanceStates !== undefined &&
          !query.acceptanceStates.includes(record.acceptanceState)
        )
          return false;
        if (ids !== null && !ids.has(record.memoryId)) return false;
        if (query.tags !== undefined && !query.tags.every((tag) => record.tags.includes(tag)))
          return false;
        if (query.recordedAtFrom !== undefined && record.recordedAt < query.recordedAtFrom)
          return false;
        if (query.recordedAtTo !== undefined && record.recordedAt > query.recordedAtTo)
          return false;
        return true;
      });
      return result(filtered);
    },
    async getMemoryAttachments(request) {
      return result(attachments.filter((item) => item.memoryId === request.memoryId));
    },
  };
}

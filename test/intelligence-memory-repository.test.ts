import { describe, expect, it } from "vitest";
import {
  createEvidenceRecord,
  createEvidenceRelation,
} from "../app/features/intelligence-harness/memory-fabric/evidence-contract";
import { finalizeEpisode } from "../app/features/intelligence-harness/memory-fabric/episode-builder";
import { InMemoryMemoryRepository } from "../app/features/intelligence-harness/memory-fabric/in-memory-repository";
import { createMemoryRelation } from "../app/features/intelligence-harness/memory-fabric/memory-contract";
const access = {
  requestId: "request:1",
  allowedDomains: ["keep-the-signal"],
  allowedClassifications: ["internal" as const],
  acceptedRetentionClasses: ["standard" as const],
};
const budget = { resultLimit: 10, maximumSerializedCharacters: 100000, relationTraversalLimit: 1 };
async function evidence(id: string, tick: number, overrides: Record<string, unknown> = {}) {
  return createEvidenceRecord({
    evidenceId: id,
    domainId: "keep-the-signal",
    domainVersion: "v1",
    sourceType: "observation",
    sourceSchemaId: "kts.observation",
    sourceSchemaVersion: 1,
    sourceIdentity: `obs:${tick}`,
    authoritativePosition: { tick },
    payload: { tick },
    acceptanceState: "accepted",
    classification: "internal",
    retentionClass: "standard",
    tags: ["kts"],
    recordedAt: `2026-08-01T12:00:${String(tick).padStart(2, "0")}.000Z`,
    ...overrides,
  } as never);
}
describe("KTS-I4-D in-memory repository", () => {
  it("stores and retrieves evidence", async () => {
    const r = new InMemoryMemoryRepository();
    const e = await evidence("e:1", 1);
    await r.putEvidence(e);
    expect((await r.getEvidence("e:1", access))?.evidenceId).toBe("e:1");
  });
  it("supports idempotent evidence", async () => {
    const r = new InMemoryMemoryRepository();
    const e = await evidence("e:1", 1);
    expect((await r.putEvidence(await r.putEvidence(e))).evidenceId).toBe("e:1");
  });
  it("rejects evidence collision", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:1", 1));
    await expect(r.putEvidence(await evidence("e:1", 2))).rejects.toThrow();
  });
  it("returns independent evidence clones", async () => {
    const r = new InMemoryMemoryRepository();
    const first = await r.putEvidence(await evidence("e:1", 1));
    const second = await r.getEvidence("e:1", access);
    expect(first).not.toBe(second);
  });
  it("hides disallowed classification", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:1", 1, { classification: "restricted" }));
    expect(await r.getEvidence("e:1", access)).toBeNull();
  });
  it("orders evidence by tick descending", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:1", 1));
    await r.putEvidence(await evidence("e:2", 2));
    const result = await r.queryEvidence({ ...access, budget });
    expect(result.records.map((x) => x.evidenceId)).toEqual(["e:2", "e:1"]);
  });
  it("filters by tick range", async () => {
    const r = new InMemoryMemoryRepository();
    for (let i = 1; i <= 3; i++) await r.putEvidence(await evidence(`e:${i}`, i));
    const result = await r.queryEvidence({
      ...access,
      budget,
      authoritativeTickFrom: 2,
      authoritativeTickTo: 2,
    });
    expect(result.records.map((x) => x.evidenceId)).toEqual(["e:2"]);
  });
  it("filters by tags", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:1", 1));
    expect((await r.queryEvidence({ ...access, budget, tags: ["kts"] })).records).toHaveLength(1);
  });
  it("reports visible truncation", async () => {
    const r = new InMemoryMemoryRepository();
    for (let i = 1; i <= 3; i++) await r.putEvidence(await evidence(`e:${i}`, i));
    expect(
      (await r.queryEvidence({ ...access, budget: { ...budget, resultLimit: 1 } })).metadata
        .truncated,
    ).toBe(true);
  });
  it("enforces character budget", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:1", 1));
    expect(
      (await r.queryEvidence({ ...access, budget: { ...budget, maximumSerializedCharacters: 1 } }))
        .records,
    ).toHaveLength(0);
  });
  it("stores an evidence relation", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:1", 1));
    await r.putEvidence(await evidence("e:2", 2));
    const relation = createEvidenceRelation({
      relationId: "rel:1",
      relationType: "supports",
      sourceEvidenceId: "e:1",
      targetEvidenceId: "e:2",
      recordedAt: "2026-08-01T12:00:00.000Z",
    });
    expect((await r.putEvidenceRelation(relation)).relationId).toBe("rel:1");
  });
  it("preserves contradiction relations", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:1", 1));
    await r.putEvidence(await evidence("e:2", 2));
    await r.putEvidenceRelation(
      createEvidenceRelation({
        relationId: "rel:1",
        relationType: "contradicts",
        sourceEvidenceId: "e:1",
        targetEvidenceId: "e:2",
        recordedAt: "2026-08-01T12:00:00.000Z",
      }),
    );
    expect((await r.getEvidenceRelations("e:1", access))[0]?.relationType).toBe("contradicts");
  });
  it("rejects missing relation evidence", async () => {
    const r = new InMemoryMemoryRepository();
    await expect(
      r.putEvidenceRelation(
        createEvidenceRelation({
          relationId: "rel:1",
          relationType: "supports",
          sourceEvidenceId: "e:1",
          targetEvidenceId: "e:2",
          recordedAt: "2026-08-01T12:00:00.000Z",
        }),
      ),
    ).rejects.toThrow();
  });
  it("rejects evidence lineage cycle", async () => {
    const r = new InMemoryMemoryRepository();
    for (let i = 1; i <= 2; i++) await r.putEvidence(await evidence(`e:${i}`, i));
    await r.putEvidenceRelation(
      createEvidenceRelation({
        relationId: "r:1",
        relationType: "derived_from",
        sourceEvidenceId: "e:1",
        targetEvidenceId: "e:2",
        recordedAt: "2026-08-01T12:00:00.000Z",
      }),
    );
    await expect(
      r.putEvidenceRelation(
        createEvidenceRelation({
          relationId: "r:2",
          relationType: "derived_from",
          sourceEvidenceId: "e:2",
          targetEvidenceId: "e:1",
          recordedAt: "2026-08-01T12:00:01.000Z",
        }),
      ),
    ).rejects.toThrow();
  });
  it("stores an atomic episode bundle", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:out", 1));
    const bundle = await finalizeEpisode({
      memoryId: "m:1",
      domainId: "keep-the-signal",
      domainVersion: "v1",
      significance: "notable",
      summary: { ok: true },
      acceptanceState: "accepted",
      classification: "internal",
      retentionClass: "standard",
      tags: ["episode"],
      recordedAt: "2026-08-01T12:00:00.000Z",
      evidence: [{ attachmentId: "a:1", evidenceId: "e:out", role: "outcome", sequence: 1 }],
      knownEvidenceIds: new Set(["e:out"]),
    });
    expect((await r.putEpisodeBundle(bundle)).memory.memoryId).toBe("m:1");
  });
  it("retrieves memory", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:out", 1));
    const bundle = await finalizeEpisode({
      memoryId: "m:1",
      domainId: "keep-the-signal",
      domainVersion: "v1",
      significance: "notable",
      summary: { ok: true },
      acceptanceState: "accepted",
      classification: "internal",
      retentionClass: "standard",
      tags: ["episode"],
      recordedAt: "2026-08-01T12:00:00.000Z",
      evidence: [{ attachmentId: "a:1", evidenceId: "e:out", role: "outcome", sequence: 1 }],
      knownEvidenceIds: new Set(["e:out"]),
    });
    await r.putEpisodeBundle(bundle);
    expect((await r.getMemory("m:1", access))?.memoryId).toBe("m:1");
  });
  it("queries attached evidence", async () => {
    const r = new InMemoryMemoryRepository();
    await r.putEvidence(await evidence("e:out", 1));
    const bundle = await finalizeEpisode({
      memoryId: "m:1",
      domainId: "keep-the-signal",
      domainVersion: "v1",
      significance: "notable",
      summary: { ok: true },
      acceptanceState: "accepted",
      classification: "internal",
      retentionClass: "standard",
      tags: ["episode"],
      recordedAt: "2026-08-01T12:00:00.000Z",
      evidence: [{ attachmentId: "a:1", evidenceId: "e:out", role: "outcome", sequence: 1 }],
      knownEvidenceIds: new Set(["e:out"]),
    });
    await r.putEpisodeBundle(bundle);
    expect(
      (await r.queryMemory({ ...access, budget, attachedEvidenceId: "e:out" })).records,
    ).toHaveLength(1);
  });
  it("stores memory relation", async () => {
    const r = new InMemoryMemoryRepository();
    for (const id of ["m:1", "m:2"])
      await r.putMemory(
        (
          await finalizeEpisode({
            memoryId: id,
            domainId: "keep-the-signal",
            domainVersion: "v1",
            significance: "routine",
            summary: {},
            acceptanceState: "accepted",
            classification: "internal",
            retentionClass: "standard",
            tags: [],
            recordedAt: "2026-08-01T12:00:00.000Z",
            evidence: [
              { attachmentId: `a:${id}`, evidenceId: "e:out", role: "outcome", sequence: 1 },
            ],
            knownEvidenceIds: new Set(["e:out"]),
          })
        ).memory,
      );
    expect(
      (
        await r.putMemoryRelation(
          createMemoryRelation({
            relationId: "mr:1",
            relationType: "continues",
            sourceMemoryId: "m:1",
            targetMemoryId: "m:2",
            recordedAt: "2026-08-01T12:00:00.000Z",
          }),
        )
      ).relationId,
    ).toBe("mr:1");
  });
  it("serializes concurrent equivalent writes", async () => {
    const r = new InMemoryMemoryRepository();
    const e = await evidence("e:1", 1);
    const result = await Promise.all([r.putEvidence(e), r.putEvidence(e), r.putEvidence(e)]);
    expect(result).toHaveLength(3);
  });
  it("makes first concurrent collision win", async () => {
    const r = new InMemoryMemoryRepository();
    const results = await Promise.allSettled([
      r.putEvidence(await evidence("e:1", 1)),
      r.putEvidence(await evidence("e:1", 2)),
    ]);
    expect(results.filter((x) => x.status === "rejected")).toHaveLength(1);
  });
  it("supports a 10000 evidence bounded scale case", async () => {
    const r = new InMemoryMemoryRepository();
    for (let i = 0; i < 10000; i++)
      await r.putEvidence(
        await evidence(`scale:${i}`, i, {
          recordedAt: `2026-08-01T12:${String(Math.floor(i / 60) % 60).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
        }),
      );
    const result = await r.queryEvidence({ ...access, budget: { ...budget, resultLimit: 25 } });
    expect(result.records).toHaveLength(25);
    expect(result.metadata.truncated).toBe(true);
  }, 30000);
  it("rejects queries without allowlists", async () => {
    const r = new InMemoryMemoryRepository();
    await expect(
      r.queryEvidence({
        requestId: "r",
        allowedDomains: [],
        allowedClassifications: [],
        acceptedRetentionClasses: [],
        budget,
      }),
    ).rejects.toThrow();
  });
  it("disposes private state", async () => {
    const r = new InMemoryMemoryRepository();
    r.dispose();
    await expect(r.getEvidence("e:1", access)).rejects.toThrow();
  });
});

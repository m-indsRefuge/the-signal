import { describe, expect, it } from "vitest";
import { finalizeEpisode } from "../app/features/intelligence-harness/memory-fabric/episode-builder";
import {
  DEFERRED_MEMORY_KINDS,
  EPISODE_SIGNIFICANCE_CLASSES,
  createEpisodicMemoryRecord,
} from "../app/features/intelligence-harness/memory-fabric/memory-contract";

function request(overrides: Record<string, unknown> = {}) {
  return {
    memoryId: "memory:1",
    domainId: "keep-the-signal",
    domainVersion: "v1",
    significance: "notable" as const,
    summary: { result: "held" },
    acceptanceState: "accepted" as const,
    classification: "internal" as const,
    retentionClass: "standard" as const,
    tags: ["episode"],
    recordedAt: "2026-08-01T12:00:00.000Z",
    evidence: [
      {
        attachmentId: "attach:1",
        evidenceId: "evidence:outcome",
        role: "outcome" as const,
        sequence: 1,
      },
    ],
    knownEvidenceIds: new Set(["evidence:outcome"]),
    ...overrides,
  };
}

describe("KTS-I4-D episode builder", () => {
  for (const significance of EPISODE_SIGNIFICANCE_CLASSES) {
    it(`accepts significance ${significance}`, async () => {
      const result = await finalizeEpisode(request({ significance }) as never);
      expect(result.memory.significance).toBe(significance);
    });
  }

  for (const kind of DEFERRED_MEMORY_KINDS) {
    it(`rejects deferred kind ${kind}`, async () => {
      await expect(
        createEpisodicMemoryRecord({ ...request(), memoryKind: kind } as never),
      ).rejects.toThrow();
    });
  }

  it("finalizes an episodic record", async () => {
    expect((await finalizeEpisode(request())).memory.memoryKind).toBe("episodic");
  });

  it("requires outcome evidence", async () => {
    await expect(finalizeEpisode(request({ evidence: [] }) as never)).rejects.toThrow();
  });

  it("rejects unknown evidence", async () => {
    await expect(
      finalizeEpisode(request({ knownEvidenceIds: new Set() }) as never),
    ).rejects.toThrow();
  });

  it("rejects duplicate attachment IDs", async () => {
    const source = request({
      evidence: [
        {
          attachmentId: "same",
          evidenceId: "evidence:outcome",
          role: "outcome",
          sequence: 1,
        },
        {
          attachmentId: "same",
          evidenceId: "evidence:2",
          role: "observation",
          sequence: 2,
        },
      ],
      knownEvidenceIds: new Set(["evidence:outcome", "evidence:2"]),
    });
    await expect(finalizeEpisode(source as never)).rejects.toThrow();
  });

  it("rejects duplicate role evidence pairs", async () => {
    const source = request({
      evidence: [
        {
          attachmentId: "a:1",
          evidenceId: "evidence:outcome",
          role: "outcome",
          sequence: 1,
        },
        {
          attachmentId: "a:2",
          evidenceId: "evidence:outcome",
          role: "outcome",
          sequence: 2,
        },
      ],
    });
    await expect(finalizeEpisode(source as never)).rejects.toThrow();
  });

  it("orders attachments by sequence", async () => {
    const source = request({
      evidence: [
        {
          attachmentId: "a:2",
          evidenceId: "evidence:outcome",
          role: "outcome",
          sequence: 2,
        },
        {
          attachmentId: "a:1",
          evidenceId: "evidence:obs",
          role: "observation",
          sequence: 1,
        },
      ],
      knownEvidenceIds: new Set(["evidence:outcome", "evidence:obs"]),
    });
    const result = await finalizeEpisode(source as never);
    expect(result.attachments.map((item) => item.attachmentId)).toEqual(["a:1", "a:2"]);
  });

  it("preserves corrections", async () => {
    const source = request({
      evidence: [
        {
          attachmentId: "a:1",
          evidenceId: "evidence:outcome",
          role: "outcome",
          sequence: 1,
        },
        {
          attachmentId: "a:2",
          evidenceId: "evidence:correction",
          role: "correction",
          sequence: 2,
        },
      ],
      knownEvidenceIds: new Set(["evidence:outcome", "evidence:correction"]),
    });
    expect((await finalizeEpisode(source as never)).attachments[1]?.role).toBe("correction");
  });

  it("preserves contradictions", async () => {
    const source = request({
      evidence: [
        {
          attachmentId: "a:1",
          evidenceId: "evidence:outcome",
          role: "outcome",
          sequence: 1,
        },
        {
          attachmentId: "a:2",
          evidenceId: "evidence:contradiction",
          role: "contradiction",
          sequence: 2,
        },
      ],
      knownEvidenceIds: new Set(["evidence:outcome", "evidence:contradiction"]),
    });
    expect((await finalizeEpisode(source as never)).attachments[1]?.role).toBe("contradiction");
  });

  it("creates stable digest", async () => {
    expect((await finalizeEpisode(request())).memory.contentDigest).toBe(
      (await finalizeEpisode(request())).memory.contentDigest,
    );
  });

  it("freezes memory", async () => {
    expect(Object.isFrozen((await finalizeEpisode(request())).memory)).toBe(true);
  });

  it("freezes attachments", async () => {
    expect(Object.isFrozen((await finalizeEpisode(request())).attachments)).toBe(true);
  });

  it("does not mutate the request", async () => {
    const source = request();
    const before = JSON.stringify({
      ...source,
      knownEvidenceIds: [...source.knownEvidenceIds],
    });
    await finalizeEpisode(source);
    expect(JSON.stringify({ ...source, knownEvidenceIds: [...source.knownEvidenceIds] })).toBe(
      before,
    );
  });
});

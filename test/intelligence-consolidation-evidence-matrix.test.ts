import { describe, expect, it } from "vitest";
import {
  createEvidenceMatrix,
  createEvidenceMatrixEntry,
  matrixEntriesByClass,
  MATRIX_EVIDENCE_CLASSES,
  MATRIX_OUTCOMES,
} from "../app/features/intelligence-harness/consolidation/evidence-matrix";

const recordedAt = "2026-08-02T08:00:00.000Z";

describe("KTS-I4-F evidence matrix", () => {
  for (const evidenceClass of MATRIX_EVIDENCE_CLASSES) {
    it(`creates immutable ${evidenceClass} entries`, () => {
      const record = createEvidenceMatrixEntry(entry({ evidenceClass }));
      expect(record.evidenceClass).toBe(evidenceClass);
      expect(Object.isFrozen(record)).toBe(true);
    });
  }

  for (const outcome of MATRIX_OUTCOMES) {
    it(`preserves outcome ${outcome}`, () => {
      expect(createEvidenceMatrixEntry(entry({ outcome })).outcome).toBe(outcome);
    });
  }

  it("accepts negative refutation weights", () => {
    expect(createEvidenceMatrixEntry(entry({ weightBasis: -10_000 })).weightBasis).toBe(-10_000);
  });

  it("accepts positive support weights", () => {
    expect(createEvidenceMatrixEntry(entry({ weightBasis: 10_000 })).weightBasis).toBe(10_000);
  });

  it("accepts not-applicable weights", () => {
    expect(createEvidenceMatrixEntry(entry({ weightBasis: "not_applicable" })).weightBasis).toBe(
      "not_applicable",
    );
  });

  it("rejects weight above maximum", () => {
    expect(() => createEvidenceMatrixEntry(entry({ weightBasis: 10_001 }))).toThrowError();
  });

  it("rejects weight below minimum", () => {
    expect(() => createEvidenceMatrixEntry(entry({ weightBasis: -10_001 }))).toThrowError();
  });

  it("deduplicates limitations", () => {
    const result = createEvidenceMatrixEntry(
      entry({
        limitations: ["limited", "limited"],
      }),
    );
    expect(result.limitations).toEqual(["limited"]);
  });

  it("sorts matrix entries by ID", async () => {
    const matrix = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(entry({ entryId: "entry:b" })),
        createEvidenceMatrixEntry(entry({ entryId: "entry:a" })),
      ]),
    );
    expect(matrix.entries.map((item) => item.entryId)).toEqual(["entry:a", "entry:b"]);
  });

  it("produces stable matrix digests", async () => {
    const first = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(entry({ entryId: "entry:b" })),
        createEvidenceMatrixEntry(entry({ entryId: "entry:a" })),
      ]),
    );
    const second = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(entry({ entryId: "entry:a" })),
        createEvidenceMatrixEntry(entry({ entryId: "entry:b" })),
      ]),
    );
    expect(first.contentDigest).toBe(second.contentDigest);
  });

  it("rejects matrix entries from another candidate", async () => {
    await expect(
      createEvidenceMatrix(
        matrixDraft([createEvidenceMatrixEntry(entry({ candidateId: "candidate:other" }))]),
      ),
    ).rejects.toMatchObject({ code: "invalid_evidence_matrix" });
  });

  it("rejects duplicate entry IDs", async () => {
    const same = createEvidenceMatrixEntry(entry());
    await expect(createEvidenceMatrix(matrixDraft([same, same]))).rejects.toMatchObject({
      code: "invalid_evidence_matrix",
    });
  });

  it("filters support entries without merging contradictions", async () => {
    const matrix = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(entry({ entryId: "entry:s", evidenceClass: "support" })),
        createEvidenceMatrixEntry(
          entry({
            entryId: "entry:c",
            evidenceClass: "contradiction",
            outcome: "refutes",
          }),
        ),
      ]),
    );
    expect(matrixEntriesByClass(matrix, "support")).toHaveLength(1);
    expect(matrixEntriesByClass(matrix, "contradiction")).toHaveLength(1);
  });

  it("keeps counterexamples separate", async () => {
    const matrix = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(entry({ entryId: "entry:s", evidenceClass: "support" })),
        createEvidenceMatrixEntry(
          entry({
            entryId: "entry:x",
            evidenceClass: "counterexample",
            outcome: "refutes",
          }),
        ),
      ]),
    );
    expect(matrixEntriesByClass(matrix, "counterexample")[0]?.referenceId).toBe("episode:a");
  });

  it("keeps unknown evidence unknown", async () => {
    const matrix = await createEvidenceMatrix(
      matrixDraft([createEvidenceMatrixEntry(entry({ outcome: "unknown" }))]),
    );
    expect(matrix.entries[0]?.outcome).toBe("unknown");
  });

  it("preserves competing explanations", async () => {
    const matrix = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(
          entry({
            evidenceClass: "competing_explanation",
            outcome: "neutral",
          }),
        ),
      ]),
    );
    expect(matrix.entries[0]?.evidenceClass).toBe("competing_explanation");
  });

  it("preserves invariant entries", async () => {
    const matrix = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(
          entry({
            evidenceClass: "domain_invariant",
            outcome: "supports",
          }),
        ),
      ]),
    );
    expect(matrix.entries[0]?.evidenceClass).toBe("domain_invariant");
  });

  it("preserves version boundaries", async () => {
    const matrix = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(
          entry({
            evidenceClass: "version_boundary",
            outcome: "supports",
          }),
        ),
      ]),
    );
    expect(matrix.entries[0]?.evidenceClass).toBe("version_boundary");
  });

  it("preserves reproducibility evidence", async () => {
    const matrix = await createEvidenceMatrix(
      matrixDraft([
        createEvidenceMatrixEntry(
          entry({
            evidenceClass: "reproducibility",
            outcome: "supports",
          }),
        ),
      ]),
    );
    expect(matrix.entries[0]?.evidenceClass).toBe("reproducibility");
  });

  it("does not mutate source entry arrays", async () => {
    const entries = [
      createEvidenceMatrixEntry(entry({ entryId: "entry:b" })),
      createEvidenceMatrixEntry(entry({ entryId: "entry:a" })),
    ];
    await createEvidenceMatrix(matrixDraft(entries));
    expect(entries.map((item) => item.entryId)).toEqual(["entry:b", "entry:a"]);
  });

  it("supports 10,000 evidence entries", async () => {
    const entries = Array.from({ length: 10_000 }, (_, index) =>
      createEvidenceMatrixEntry(
        entry({
          entryId: `entry:${String(index).padStart(5, "0")}`,
          referenceId: `episode:${String(index).padStart(5, "0")}`,
        }),
      ),
    );
    const matrix = await createEvidenceMatrix(matrixDraft(entries));
    expect(matrix.entries).toHaveLength(10_000);
    expect(matrix.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("has canonical entry content", () => {
    const result = createEvidenceMatrixEntry(entry());
    expect(result.canonicalContent).toContain('"candidateId":"candidate:1"');
  });

  it("rejects invalid recorded-at timestamps", () => {
    expect(() => createEvidenceMatrixEntry(entry({ recordedAt: "today" }))).toThrowError();
  });

  it("rejects invalid candidate identities", () => {
    expect(() => createEvidenceMatrixEntry(entry({ candidateId: "bad id" }))).toThrowError();
  });

  it("freezes complete matrices", async () => {
    const matrix = await createEvidenceMatrix(matrixDraft([createEvidenceMatrixEntry(entry())]));
    expect(Object.isFrozen(matrix)).toBe(true);
    expect(Object.isFrozen(matrix.entries)).toBe(true);
  });
});

function entry(overrides: Record<string, unknown> = {}) {
  return {
    entryId: "entry:1",
    candidateId: "candidate:1",
    candidateVersion: "1",
    evidenceClass: "support" as const,
    referenceId: "episode:a",
    evaluatorId: "evaluator:test",
    evaluatorVersion: "1",
    outcome: "supports" as const,
    weightBasis: 1_000,
    explanationCode: "direct_support",
    publicNote: "Bounded public explanation.",
    limitations: [],
    recordedAt,
    ...overrides,
  } as Parameters<typeof createEvidenceMatrixEntry>[0];
}

function matrixDraft(entries: readonly ReturnType<typeof createEvidenceMatrixEntry>[]) {
  return {
    matrixId: "matrix:1",
    matrixVersion: "1",
    candidateId: "candidate:1",
    candidateVersion: "1",
    entries,
  };
}

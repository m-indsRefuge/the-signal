import { describe, expect, it } from "vitest";
import {
  createCandidateAbstraction,
  type CandidateAbstraction,
} from "../app/features/intelligence-harness/consolidation/abstraction-contract";
import {
  validateConsolidationCandidate,
  type ConsolidationValidationPolicy,
} from "../app/features/intelligence-harness/consolidation/consolidation-validator";
import {
  createEvidenceMatrix,
  createEvidenceMatrixEntry,
  type EvidenceMatrix,
  type MatrixEvidenceClass,
  type MatrixOutcome,
} from "../app/features/intelligence-harness/consolidation/evidence-matrix";

const recordedAt = "2026-08-02T08:00:00.000Z";

describe("KTS-I4-F consolidation validator", () => {
  it("validates a fully supported candidate", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("unseen", "supports", "episode:c"),
        pair("domain_invariant", "supports", "invariant:a"),
        pair("version_boundary", "supports", "version:a"),
        pair("reproducibility", "supports", "result:a"),
      ]),
      policy(),
    );
    expect(report.classification).toBe("candidate_validated");
  });

  it("requires minimum support cardinality", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([pair("support", "supports", "episode:a")]),
      policy(),
    );
    expect(report.failedConditions).toContain("minimum_support");
  });

  it("rejects a refuting counterexample", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("counterexample", "refutes", "episode:x"),
      ]),
      policy(),
    );
    expect(report.classification).toBe("candidate_rejected");
  });

  it("quarantines unresolved contradiction", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("contradiction", "refutes", "episode:c"),
      ]),
      policy(),
    );
    expect(report.classification).toBe("candidate_quarantined");
    expect(report.failedConditions).toContain("unresolved_contradiction");
  });

  it("allows neutral contradiction evidence", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("contradiction", "neutral", "episode:c"),
      ]),
      policy({ requireVersionBoundaryEvidence: false, requireReproducibilityEvidence: false }),
    );
    expect(report.failedConditions).not.toContain("unresolved_contradiction");
  });

  it("requires unseen evidence for high confidence", async () => {
    const report = validateConsolidationCandidate(
      await candidate({ confidenceBasisPoints: 9_000 }),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
      ]),
      policy({ maximumConfidenceWithoutUnseenEvidence: 5_000 }),
    );
    expect(report.failedConditions).toContain("unsupported_confidence");
  });

  it("allows bounded confidence without unseen evidence", async () => {
    const report = validateConsolidationCandidate(
      await candidate({ confidenceBasisPoints: 4_000 }),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
      ]),
      policy({
        maximumConfidenceWithoutUnseenEvidence: 5_000,
        requireVersionBoundaryEvidence: false,
        requireReproducibilityEvidence: false,
      }),
    );
    expect(report.failedConditions).not.toContain("unsupported_confidence");
  });

  it("marks absent version evidence unknown", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
      ]),
      policy(),
    );
    expect(report.unknownConditions).toContain("version_boundary");
  });

  it("rejects failed version evidence", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("version_boundary", "refutes", "version:a"),
      ]),
      policy(),
    );
    expect(report.failedConditions).toContain("version_boundary");
  });

  it("marks absent reproducibility evidence unknown", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
      ]),
      policy(),
    );
    expect(report.unknownConditions).toContain("reproducibility");
  });

  it("rejects failed reproducibility evidence", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("reproducibility", "refutes", "result:a"),
      ]),
      policy(),
    );
    expect(report.failedConditions).toContain("reproducibility");
  });

  it("rejects a failed domain invariant", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("domain_invariant", "refutes", "invariant:a"),
      ]),
      policy(),
    );
    expect(report.failedConditions).toContain("domain_invariant");
  });

  it("accepts all non-refuting domain invariants", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("domain_invariant", "weakly_supports", "invariant:a"),
      ]),
      policy({ requireVersionBoundaryEvidence: false, requireReproducibilityEvidence: false }),
    );
    expect(report.failedConditions).not.toContain("domain_invariant");
  });

  it("requires protected references in the matrix", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
      ]),
      policy({ protectedReferenceIds: ["evidence:protected"] }),
    );
    expect(report.failedConditions).toContain("protected_evidence_missing");
  });

  it("passes when protected references are present", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("domain_invariant", "supports", "evidence:protected"),
      ]),
      policy({
        protectedReferenceIds: ["evidence:protected"],
        requireVersionBoundaryEvidence: false,
        requireReproducibilityEvidence: false,
      }),
    );
    expect(report.failedConditions).not.toContain("protected_evidence_missing");
  });

  it("counts every evidence class", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "a"),
        pair("contradiction", "neutral", "b"),
        pair("counterexample", "neutral", "c"),
        pair("unseen", "supports", "d"),
        pair("competing_explanation", "neutral", "e"),
        pair("domain_invariant", "supports", "f"),
        pair("version_boundary", "supports", "g"),
        pair("reproducibility", "supports", "h"),
      ]),
      policy({ minimumSupportCardinality: 1 }),
    );
    expect(Object.values(report.evidenceCounts).reduce((sum, value) => sum + value, 0)).toBe(8);
  });

  for (const outcome of [
    "supports",
    "weakly_supports",
    "neutral",
    "weakly_refutes",
    "refutes",
    "unknown",
    "not_applicable",
  ] as const) {
    it(`counts outcome ${outcome}`, async () => {
      const report = validateConsolidationCandidate(
        await candidate(),
        await matrix([
          pair("support", outcome, "episode:a"),
          pair("support", "supports", "episode:b"),
        ]),
        policy({ minimumSupportCardinality: 1 }),
      );
      expect(report.outcomeCounts[outcome]).toBeGreaterThan(0);
    });
  }

  it("keeps unknown evidence explicit", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("unseen", "unknown", "episode:x"),
      ]),
      policy({ requireVersionBoundaryEvidence: false, requireReproducibilityEvidence: false }),
    );
    expect(report.unknownConditions).toContain("unknown_evidence");
  });

  it("does not promote a candidate to production", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
        pair("unseen", "supports", "episode:c"),
        pair("domain_invariant", "supports", "invariant:a"),
        pair("version_boundary", "supports", "version:a"),
        pair("reproducibility", "supports", "result:a"),
      ]),
      policy(),
    );
    expect(report.classification).toBe("candidate_validated");
    expect(JSON.stringify(report)).not.toContain("accepted_production");
  });

  it("rejects candidate and matrix lineage mismatch", async () => {
    const other = await createEvidenceMatrix({
      matrixId: "matrix:other",
      matrixVersion: "1",
      candidateId: "candidate:other",
      candidateVersion: "1",
      entries: [],
    });
    const value = await candidate();
    expect(() => validateConsolidationCandidate(value, other, policy())).toThrowError();
  });

  it("returns immutable reports", async () => {
    const report = validateConsolidationCandidate(
      await candidate(),
      await matrix([
        pair("support", "supports", "episode:a"),
        pair("support", "supports", "episode:b"),
      ]),
      policy({ requireVersionBoundaryEvidence: false, requireReproducibilityEvidence: false }),
    );
    expect(Object.isFrozen(report)).toBe(true);
  });
});

function policy(
  overrides: Partial<ConsolidationValidationPolicy> = {},
): ConsolidationValidationPolicy {
  return {
    policyId: "policy:validation",
    policyVersion: "1",
    minimumSupportCardinality: 2,
    maximumConfidenceWithoutUnseenEvidence: 5_000,
    requireContradictionResolution: true,
    requireVersionBoundaryEvidence: true,
    requireReproducibilityEvidence: true,
    requireInvariantEvidence: true,
    protectedReferenceIds: [],
    ...overrides,
  };
}

async function candidate(
  overrides: Record<string, unknown> = {},
): Promise<Readonly<CandidateAbstraction>> {
  return createCandidateAbstraction({
    candidateId: "candidate:1",
    candidateVersion: "1",
    candidateSchemaId: "construct.consolidation.candidate",
    candidateSchemaVersion: 1,
    candidateKind: "pattern_candidate",
    domainId: "keep-the-signal",
    domainVersion: "1",
    sourceClusterIds: ["cluster:1"],
    sourceEpisodeIds: ["episode:a", "episode:b"],
    sourceEvidenceIds: [],
    representation: { pattern: "stable" },
    applicabilityConditions: [],
    exclusionConditions: [],
    expectedEffects: [],
    knownFailureModes: [],
    confidenceBasisPoints: 5_000,
    uncertainty: "medium",
    extractionMethodId: "test",
    extractionMethodVersion: "1",
    versionBoundaries: [],
    supportingReferences: [],
    contradictionReferences: [],
    counterexampleReferences: [],
    unseenEvaluationReferences: [],
    competingExplanationReferences: [],
    invariantCheckReferences: [],
    status: "experimental_candidate",
    actorId: "actor:test",
    recordedAt,
    ...overrides,
  });
}

function pair(evidenceClass: MatrixEvidenceClass, outcome: MatrixOutcome, referenceId: string) {
  return { evidenceClass, outcome, referenceId };
}

async function matrix(
  inputs: readonly ReturnType<typeof pair>[],
): Promise<Readonly<EvidenceMatrix>> {
  return createEvidenceMatrix({
    matrixId: "matrix:1",
    matrixVersion: "1",
    candidateId: "candidate:1",
    candidateVersion: "1",
    entries: inputs.map((input, index) =>
      createEvidenceMatrixEntry({
        entryId: `entry:${index}`,
        candidateId: "candidate:1",
        candidateVersion: "1",
        evidenceClass: input.evidenceClass,
        referenceId: input.referenceId,
        evaluatorId: "evaluator:test",
        evaluatorVersion: "1",
        outcome: input.outcome,
        weightBasis: "not_applicable",
        explanationCode: "test",
        limitations: [],
        recordedAt,
      }),
    ),
  });
}

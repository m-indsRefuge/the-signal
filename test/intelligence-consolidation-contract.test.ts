import { describe, expect, it } from "vitest";
import {
  CANDIDATE_KINDS,
  CANDIDATE_STATUSES,
  createCandidateAbstraction,
  UNCERTAINTY_CLASSES,
} from "../app/features/intelligence-harness/consolidation/abstraction-contract";
import {
  CONSOLIDATION_FAILURE_CODES,
  ConsolidationFailure,
} from "../app/features/intelligence-harness/consolidation/failures";
import {
  createEvidenceMatrix,
  createEvidenceMatrixEntry,
  MATRIX_EVIDENCE_CLASSES,
  MATRIX_OUTCOMES,
} from "../app/features/intelligence-harness/consolidation/evidence-matrix";
import {
  createInformationPreservationMap,
  createPreservationTarget,
  PRESERVATION_TARGET_TYPES,
} from "../app/features/intelligence-harness/consolidation/preservation-contract";
import {
  createTombstoneDraft,
  TOMBSTONE_DRAFT_STATUSES,
} from "../app/features/intelligence-harness/consolidation/tombstone-contract";

const recordedAt = "2026-08-02T08:00:00.000Z";
const digest = "a".repeat(64);

describe("KTS-I4-F consolidation contracts", () => {
  for (const kind of CANDIDATE_KINDS) {
    it(`accepts candidate kind ${kind}`, async () => {
      const record = await createCandidateAbstraction(candidateDraft({ candidateKind: kind }));
      expect(record.candidateKind).toBe(kind);
      expect(Object.isFrozen(record)).toBe(true);
    });
  }

  for (const status of CANDIDATE_STATUSES) {
    it(`accepts candidate status ${status}`, async () => {
      const record = await createCandidateAbstraction(candidateDraft({ status }));
      expect(record.status).toBe(status);
    });
  }

  for (const uncertainty of UNCERTAINTY_CLASSES) {
    it(`accepts uncertainty ${uncertainty}`, async () => {
      const record = await createCandidateAbstraction(candidateDraft({ uncertainty }));
      expect(record.uncertainty).toBe(uncertainty);
    });
  }

  it("accepts zero confidence", async () => {
    expect(
      (await createCandidateAbstraction(candidateDraft({ confidenceBasisPoints: 0 })))
        .confidenceBasisPoints,
    ).toBe(0);
  });

  it("accepts maximum confidence", async () => {
    expect(
      (await createCandidateAbstraction(candidateDraft({ confidenceBasisPoints: 10_000 })))
        .confidenceBasisPoints,
    ).toBe(10_000);
  });

  it("rejects confidence above maximum", async () => {
    await expect(
      createCandidateAbstraction(candidateDraft({ confidenceBasisPoints: 10_001 })),
    ).rejects.toMatchObject({ code: "invalid_abstraction" });
  });

  it("produces stable candidate digests", async () => {
    const first = await createCandidateAbstraction(candidateDraft());
    const second = await createCandidateAbstraction(candidateDraft());
    expect(first.contentDigest).toBe(second.contentDigest);
  });

  it("sorts candidate references before digesting", async () => {
    const first = await createCandidateAbstraction(
      candidateDraft({
        sourceEpisodeIds: ["episode:b", "episode:a"],
      }),
    );
    const second = await createCandidateAbstraction(
      candidateDraft({
        sourceEpisodeIds: ["episode:a", "episode:b"],
      }),
    );
    expect(first.contentDigest).toBe(second.contentDigest);
  });

  it("does not mutate the candidate draft", async () => {
    const draft = candidateDraft({ sourceEpisodeIds: ["episode:b", "episode:a"] });
    await createCandidateAbstraction(draft);
    expect(draft.sourceEpisodeIds).toEqual(["episode:b", "episode:a"]);
  });

  for (const evidenceClass of MATRIX_EVIDENCE_CLASSES) {
    it(`accepts matrix class ${evidenceClass}`, () => {
      const entry = createEvidenceMatrixEntry(entryDraft({ evidenceClass }));
      expect(entry.evidenceClass).toBe(evidenceClass);
    });
  }

  for (const outcome of MATRIX_OUTCOMES) {
    it(`accepts matrix outcome ${outcome}`, () => {
      const entry = createEvidenceMatrixEntry(entryDraft({ outcome }));
      expect(entry.outcome).toBe(outcome);
    });
  }

  it("keeps contradictions separate from support", async () => {
    const matrix = await createEvidenceMatrix({
      matrixId: "matrix:1",
      matrixVersion: "1",
      candidateId: "candidate:1",
      candidateVersion: "1",
      entries: [
        createEvidenceMatrixEntry(
          entryDraft({ entryId: "entry:support", evidenceClass: "support" }),
        ),
        createEvidenceMatrixEntry(
          entryDraft({
            entryId: "entry:contradiction",
            evidenceClass: "contradiction",
            outcome: "refutes",
          }),
        ),
      ],
    });
    expect(matrix.entries.map((entry) => entry.evidenceClass)).toEqual([
      "contradiction",
      "support",
    ]);
  });

  it("rejects duplicate matrix entry IDs", async () => {
    const entry = createEvidenceMatrixEntry(entryDraft());
    await expect(
      createEvidenceMatrix({
        matrixId: "matrix:1",
        matrixVersion: "1",
        candidateId: "candidate:1",
        candidateVersion: "1",
        entries: [entry, entry],
      }),
    ).rejects.toMatchObject({ code: "invalid_evidence_matrix" });
  });

  for (const targetType of PRESERVATION_TARGET_TYPES) {
    it(`accepts preservation target ${targetType}`, () => {
      const target = createPreservationTarget(targetDraft({ targetType }));
      expect(target.targetType).toBe(targetType);
    });
  }

  it("requires externally accepted preservation targets", () => {
    expect(() =>
      createPreservationTarget({
        ...targetDraft(),
        acceptanceClassification: "candidate" as never,
      }),
    ).toThrowError(ConsolidationFailure);
  });

  it("creates a preservation map digest", async () => {
    const map = await createInformationPreservationMap(mapDraft());
    expect(map.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects preservation maps with residual information as complete preservation", async () => {
    const map = await createInformationPreservationMap(
      mapDraft({
        residualInformationUnitIds: ["unit:missing"],
      }),
    );
    expect(map.residualInformationUnitIds).toEqual(["unit:missing"]);
  });

  for (const status of TOMBSTONE_DRAFT_STATUSES) {
    it(`accepts tombstone draft status ${status}`, async () => {
      const draft = await createTombstoneDraft(tombstoneDraft({ status }));
      expect(draft.status).toBe(status);
      expect(Object.isFrozen(draft)).toBe(true);
    });
  }

  it("rejects a noncanonical tombstone time", async () => {
    await expect(
      createTombstoneDraft(
        tombstoneDraft({
          proposedDeletionTime: "2026-08-03",
        }),
      ),
    ).rejects.toBeDefined();
  });

  it("exports every required failure code", () => {
    expect(CONSOLIDATION_FAILURE_CODES).toHaveLength(33);
    expect(CONSOLIDATION_FAILURE_CODES).toContain("forgetting_ineligible");
    expect(CONSOLIDATION_FAILURE_CODES).toContain("invalid_tombstone_draft");
  });
});

function candidateDraft(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: "candidate:1",
    candidateVersion: "1",
    candidateSchemaId: "construct.consolidation.candidate",
    candidateSchemaVersion: 1,
    candidateKind: "pattern_candidate" as const,
    domainId: "keep-the-signal",
    domainVersion: "1",
    sourceClusterIds: ["cluster:1"],
    sourceEpisodeIds: ["episode:a", "episode:b"],
    sourceEvidenceIds: ["evidence:a"],
    representation: { pattern: "stable" },
    applicabilityConditions: [],
    exclusionConditions: [],
    expectedEffects: [],
    knownFailureModes: [],
    confidenceBasisPoints: 5_000,
    uncertainty: "medium" as const,
    extractionMethodId: "deterministic:test",
    extractionMethodVersion: "1",
    versionBoundaries: [],
    supportingReferences: ["episode:a"],
    contradictionReferences: [],
    counterexampleReferences: [],
    unseenEvaluationReferences: [],
    competingExplanationReferences: [],
    invariantCheckReferences: [],
    status: "experimental_candidate" as const,
    actorId: "actor:test",
    recordedAt,
    ...overrides,
  } as Parameters<typeof createCandidateAbstraction>[0];
}

function entryDraft(overrides: Record<string, unknown> = {}) {
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
    limitations: [],
    recordedAt,
    ...overrides,
  } as Parameters<typeof createEvidenceMatrixEntry>[0];
}

function targetDraft(overrides: Record<string, unknown> = {}) {
  return {
    targetId: "target:1",
    targetVersion: "1",
    targetType: "accepted_result" as const,
    domainId: "keep-the-signal",
    domainVersion: "1",
    acceptanceClassification: "accepted_external_reference" as const,
    acceptanceEvidenceId: "evidence:acceptance",
    acceptanceDecisionId: "decision:acceptance",
    targetDigest: digest,
    representedInformation: [
      {
        informationUnitId: "unit:seed",
        destinationPath: "result.seed",
        representationKind: "exact",
      },
    ],
    sourceLineageReferences: ["episode:a"],
    applicabilityBoundaries: [],
    versionBoundaries: [],
    actorId: "actor:governance",
    recordedAt,
    ...overrides,
  } as Parameters<typeof createPreservationTarget>[0];
}

function mapDraft(overrides: Record<string, unknown> = {}) {
  return {
    mapId: "map:1",
    mapVersion: "1",
    sourceMemoryId: "episode:a",
    sourceMemoryDigest: digest,
    essentialInformationUnitIds: ["unit:seed"],
    destinationTargetIds: ["target:1"],
    destinationPaths: ["result.seed"],
    transformationMethodId: "exact_copy",
    reconstructionMethodId: "typed_path",
    residualInformationUnitIds: [],
    uniqueEvidenceIds: [],
    contradictionReferences: [],
    correctionReferences: [],
    versionConstraints: [],
    scopeConstraints: [],
    evaluatorId: "evaluator:test",
    evaluatorVersion: "1",
    ...overrides,
  } as Parameters<typeof createInformationPreservationMap>[0];
}

function tombstoneDraft(overrides: Record<string, unknown> = {}) {
  return {
    tombstoneId: "tombstone:1",
    sourceMemoryId: "episode:a",
    sourceMemoryKind: "episodic" as const,
    sourceDigest: digest,
    domainId: "keep-the-signal",
    domainVersion: "1",
    lineageReferences: ["episode:a"],
    evidenceReferences: ["evidence:a"],
    preservationTargetReferences: ["target:1"],
    forgettingReason: "Information is represented in an accepted external target.",
    retentionPolicyId: "policy:1",
    retentionPolicyVersion: "1",
    evaluationId: "evaluation:1",
    evaluationEvidenceReferences: ["evidence:evaluation"],
    authorizingActorId: "actor:governance",
    proposedDeletionTime: "2026-08-03T08:00:00.000Z",
    recordedAt,
    status: "governance_review_required" as const,
    ...overrides,
  } as Parameters<typeof createTombstoneDraft>[0];
}

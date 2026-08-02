import { describe, expect, it } from "vitest";
import type { ConsolidationSnapshot } from "../app/features/intelligence-harness/consolidation/episode-snapshot";
import {
  createVirtualRetainedView,
  type ForgettingEvaluationRequest,
} from "../app/features/intelligence-harness/consolidation/forgetting-contract";
import { evaluateForgetting } from "../app/features/intelligence-harness/consolidation/forgetting-evaluator";
import {
  createInformationPreservationMap,
  createPreservationTarget,
} from "../app/features/intelligence-harness/consolidation/preservation-contract";
import type { RetentionDecisionReport } from "../app/features/intelligence-harness/consolidation/retention-policy";
import type { TombstoneDraftInput } from "../app/features/intelligence-harness/consolidation/tombstone-contract";

const digest = "a".repeat(64);
const recordedAt = "2026-08-02T08:00:00.000Z";

describe("KTS-I4-F forgetting evaluator", () => {
  it("creates an immutable virtual retained view", () => {
    const view = createVirtualRetainedView(snapshot(), ["episode:a"]);
    expect(view.retainedMemoryIds).toEqual(["episode:b"]);
    expect(view.virtuallyExcludedMemoryIds).toEqual(["episode:a"]);
    expect(Object.isFrozen(view)).toBe(true);
  });

  it("preserves the original snapshot", () => {
    const source = snapshot();
    createVirtualRetainedView(source, ["episode:a"]);
    expect(source.memories).toHaveLength(2);
  });

  it("rejects unknown virtual exclusions", () => {
    expect(() => createVirtualRetainedView(snapshot(), ["episode:unknown"])).toThrowError();
  });

  it("returns forgetting eligible when every blocker passes", async () => {
    const report = await evaluateForgetting(await eligibleInput());
    expect(report.decisions[0]?.classification).toBe("forgetting_eligible");
    expect(report.decisions[0]?.tombstoneDraft?.status).toBe("governance_review_required");
  });

  it("requires information preservation", async () => {
    const input = await eligibleInput();
    const report = await evaluateForgetting({
      ...input,
      request: { ...input.request, preservationMaps: [] },
    });
    expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
    expect(report.decisions[0]?.failedConditions).toContain("information_not_preserved");
  });

  it("blocks residual information", async () => {
    const input = await eligibleInput();
    const map = await createInformationPreservationMap({
      ...input.request.preservationMaps[0]!,
      residualInformationUnitIds: ["unit:residual"],
    });
    const report = await evaluateForgetting({
      ...input,
      request: { ...input.request, preservationMaps: [map] },
    });
    expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
  });

  it("blocks unique evidence", async () => {
    const input = await eligibleInput();
    const map = await createInformationPreservationMap({
      ...input.request.preservationMaps[0]!,
      uniqueEvidenceIds: ["evidence:unique"],
    });
    const report = await evaluateForgetting({
      ...input,
      request: { ...input.request, preservationMaps: [map] },
    });
    expect(report.decisions[0]?.failedConditions).toContain("unique_evidence_remains");
  });

  it("protects protected retention decisions", async () => {
    const input = await eligibleInput();
    const report = await evaluateForgetting({
      ...input,
      retentionDecisions: [retention("protected")],
    });
    expect(report.decisions[0]?.classification).toBe("protected");
  });

  for (const decision of ["retain", "archive_candidate", "consolidation_rejected"] as const) {
    it(`blocks retention decision ${decision}`, async () => {
      const input = await eligibleInput();
      const report = await evaluateForgetting({
        ...input,
        retentionDecisions: [retention(decision)],
      });
      expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
    });
  }

  for (const outcome of ["fail", "unknown"] as const) {
    it(`blocks reconstruction outcome ${outcome}`, async () => {
      const input = await eligibleInput();
      const request = {
        ...input.request,
        reconstructionProbes: [
          {
            ...input.request.reconstructionProbes[0]!,
            requiredInformationUnitIds: outcome === "fail" ? ["unit:missing"] : ["unit:missing"],
          },
        ],
      };
      const report = await evaluateForgetting({ ...input, request });
      expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
    });
  }

  it("blocks retrieval loss of required results", async () => {
    const input = await eligibleInput();
    const request = {
      ...input.request,
      retrievalQualityProbes: [
        {
          ...input.request.retrievalQualityProbes[0]!,
          requiredResultIds: ["episode:a"],
        },
      ],
    };
    const report = await evaluateForgetting({ ...input, request });
    expect(report.decisions[0]?.failedConditions).toContain("retrieval_quality_probe");
  });

  it("blocks prohibited retained results", async () => {
    const input = await eligibleInput();
    const request = {
      ...input.request,
      retrievalQualityProbes: [
        {
          ...input.request.retrievalQualityProbes[0]!,
          prohibitedResultIds: ["episode:b"],
        },
      ],
    };
    const report = await evaluateForgetting({ ...input, request });
    expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
  });

  it("blocks excessive result loss", async () => {
    const input = await eligibleInput();
    const request = {
      ...input.request,
      retrievalQualityProbes: [
        {
          ...input.request.retrievalQualityProbes[0]!,
          maximumResultLoss: 0,
        },
      ],
    };
    const report = await evaluateForgetting({ ...input, request });
    expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
  });

  for (const outcome of ["fail", "unknown"] as const) {
    it(`blocks lineage outcome ${outcome}`, async () => {
      const input = await eligibleInput();
      const request = {
        ...input.request,
        lineageProbes: [
          {
            ...input.request.lineageProbes[0]!,
            suppliedOutcome: outcome,
          },
        ],
      };
      const report = await evaluateForgetting({ ...input, request });
      expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
    });

    it(`blocks reproducibility outcome ${outcome}`, async () => {
      const input = await eligibleInput();
      const request = {
        ...input.request,
        reproducibilityProbes: [
          {
            ...input.request.reproducibilityProbes[0]!,
            suppliedOutcome: outcome,
          },
        ],
      };
      const report = await evaluateForgetting({ ...input, request });
      expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
    });
  }

  it("allows a nonblocking unknown probe", async () => {
    const input = await eligibleInput();
    const request = {
      ...input.request,
      lineageProbes: [
        {
          ...input.request.lineageProbes[0]!,
          suppliedOutcome: "unknown" as const,
          blocking: false,
        },
      ],
    };
    const report = await evaluateForgetting({ ...input, request });
    expect(report.decisions[0]?.classification).toBe("forgetting_eligible");
    expect(report.decisions[0]?.unknownConditions).toContain("probe:lineage");
  });

  it("requires a complete tombstone draft", async () => {
    const input = await eligibleInput();
    const report = await evaluateForgetting({ ...input, tombstoneInputs: {} });
    expect(report.decisions[0]?.classification).toBe("forgetting_ineligible");
    expect(report.decisions[0]?.failedConditions).toContain("tombstone_draft_missing");
  });

  it("rejects snapshot lineage mismatch", async () => {
    const input = await eligibleInput();
    await expect(
      evaluateForgetting({
        ...input,
        request: { ...input.request, sourceSnapshotDigest: "b".repeat(64) },
      }),
    ).rejects.toMatchObject({ code: "invalid_forgetting_request" });
  });

  it("rejects candidate-count overflow", async () => {
    const input = await eligibleInput();
    await expect(
      evaluateForgetting({
        ...input,
        request: {
          ...input.request,
          candidateMemoryIds: ["episode:a", "episode:b"],
          maximumCandidateCount: 1,
        },
      }),
    ).rejects.toMatchObject({ code: "invalid_forgetting_request" });
  });

  it("rejects probe-count overflow", async () => {
    const input = await eligibleInput();
    await expect(
      evaluateForgetting({
        ...input,
        request: { ...input.request, maximumProbeCount: 1 },
      }),
    ).rejects.toMatchObject({ code: "invalid_forgetting_request" });
  });

  it("returns explicit passed and failed conditions", async () => {
    const input = await eligibleInput();
    const report = await evaluateForgetting({
      ...input,
      retentionDecisions: [retention("protected")],
    });
    expect(report.decisions[0]?.passedConditions.length).toBeGreaterThan(0);
    expect(report.decisions[0]?.failedConditions.length).toBeGreaterThan(0);
  });

  it("counts classifications", async () => {
    const report = await evaluateForgetting(await eligibleInput());
    expect(report.classificationCounts.forgetting_eligible).toBe(1);
    expect(report.classificationCounts.protected).toBe(0);
  });

  it("returns immutable decisions", async () => {
    const report = await evaluateForgetting(await eligibleInput());
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.decisions[0])).toBe(true);
  });

  it("supports a 10,000-record virtual view", () => {
    const large = snapshot(10_000);
    const view = createVirtualRetainedView(large, ["episode:00000"]);
    expect(view.retainedMemoryIds).toHaveLength(9_999);
  });

  it("supports 10,000 forgetting evaluations", async () => {
    const base = await eligibleInput();
    const large = snapshot(10_000);
    const candidateMemoryIds = large.memories.map((memory) => memory.memoryId);
    const maps = large.memories.map((memory) => ({
      ...base.request.preservationMaps[0]!,
      mapId: `map:${memory.memoryId}`,
      sourceMemoryId: memory.memoryId,
      sourceMemoryDigest: memory.contentDigest,
    }));
    const request: ForgettingEvaluationRequest = {
      ...base.request,
      sourceSnapshotId: large.snapshotId,
      sourceSnapshotDigest: large.contentDigest,
      candidateMemoryIds,
      preservationMaps: maps,
      reconstructionProbes: [],
      retrievalQualityProbes: [],
      lineageProbes: [],
      reproducibilityProbes: [],
      maximumCandidateCount: 10_000,
      maximumProbeCount: 1,
      maximumSerializedCharacters: 100_000_000,
    };
    const decisions = candidateMemoryIds.map((memoryId) => retention("protected", memoryId));
    const report = await evaluateForgetting({
      snapshot: large,
      request,
      retentionDecisions: decisions,
      tombstoneInputs: {},
    });
    expect(report.decisions).toHaveLength(10_000);
    expect(report.classificationCounts.protected).toBe(10_000);
  });

  it("is deterministic for equivalent requests", async () => {
    const input = await eligibleInput();
    const first = await evaluateForgetting(input);
    const second = await evaluateForgetting(input);
    expect(first).toEqual(second);
  });
});

async function eligibleInput() {
  const target = createPreservationTarget({
    targetId: "target:1",
    targetVersion: "1",
    targetType: "accepted_result",
    domainId: "keep-the-signal",
    domainVersion: "1",
    acceptanceClassification: "accepted_external_reference",
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
  });
  const map = await createInformationPreservationMap({
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
  });
  const request: ForgettingEvaluationRequest = {
    evaluationId: "evaluation:1",
    sourceSnapshotId: "snapshot:1",
    sourceSnapshotDigest: digest,
    candidateMemoryIds: ["episode:a"],
    retentionPolicyId: "policy:retention",
    retentionPolicyVersion: "1",
    preservationTargets: [target],
    preservationMaps: [map],
    reconstructionProbes: [
      {
        probeId: "probe:reconstruction",
        probeVersion: "1",
        requiredInformationUnitIds: ["unit:seed"],
        allowedPreservationTargetIds: ["target:1"],
        allowedRetainedMemoryIds: ["episode:b"],
        allowedRetainedEvidenceIds: ["evidence:a"],
        reconstructionMethodId: "typed_path",
        maximumOperations: 100,
        maximumSerializedCharacters: 10_000,
        blocking: true,
      },
    ],
    retrievalQualityProbes: [
      {
        probeId: "probe:retrieval",
        probeVersion: "1",
        requiredResultIds: ["episode:b"],
        prohibitedResultIds: [],
        expectedOrdering: ["episode:b"],
        maximumResultLoss: 1,
        maximumCharacterDifference: 10_000,
        contradictionPreservationRequired: false,
        blocking: true,
      },
    ],
    lineageProbes: [
      {
        probeId: "probe:lineage",
        probeVersion: "1",
        kind: "lineage",
        suppliedOutcome: "pass",
        blocking: true,
        referenceIds: ["episode:a"],
      },
    ],
    reproducibilityProbes: [
      {
        probeId: "probe:reproducibility",
        probeVersion: "1",
        kind: "reproducibility",
        suppliedOutcome: "pass",
        blocking: true,
        referenceIds: ["episode:a"],
      },
    ],
    maximumCandidateCount: 10,
    maximumProbeCount: 10,
    maximumSerializedCharacters: 100_000,
    actorId: "actor:governance",
    evaluatedAt: recordedAt,
  };
  return {
    snapshot: snapshot(),
    request,
    retentionDecisions: [retention("forgetting_candidate")],
    tombstoneInputs: { "episode:a": tombstone("episode:a") },
  };
}

function retention(
  decision: RetentionDecisionReport["decision"],
  memoryId = "episode:a",
): RetentionDecisionReport {
  return Object.freeze({
    memoryId,
    policyId: "policy:retention",
    policyVersion: "1",
    decision,
    protectedReasons: decision === "protected" ? ["protected_retention" as const] : [],
    passedConditions: [],
    failedConditions: [],
  });
}

function tombstone(memoryId: string): TombstoneDraftInput {
  return {
    tombstoneId: `tombstone:${memoryId}`,
    sourceMemoryId: memoryId,
    sourceMemoryKind: "episodic",
    sourceDigest: digest,
    domainId: "keep-the-signal",
    domainVersion: "1",
    lineageReferences: [memoryId],
    evidenceReferences: ["evidence:a"],
    preservationTargetReferences: ["target:1"],
    forgettingReason: "Information is represented in an accepted external target.",
    retentionPolicyId: "policy:retention",
    retentionPolicyVersion: "1",
    evaluationId: "evaluation:1",
    evaluationEvidenceReferences: [],
    authorizingActorId: "actor:governance",
    proposedDeletionTime: "2026-08-03T08:00:00.000Z",
    recordedAt,
    status: "governance_review_required",
  };
}

function snapshot(count = 2): Readonly<ConsolidationSnapshot> {
  const memories = Array.from({ length: count }, (_, index) => {
    const id =
      count === 2
        ? index === 0
          ? "episode:a"
          : "episode:b"
        : `episode:${String(index).padStart(5, "0")}`;
    return Object.freeze({
      memoryId: id,
      memoryKind: "episodic" as const,
      memorySchemaId: "construct.memory" as const,
      memorySchemaVersion: 1 as const,
      domainId: "keep-the-signal",
      domainVersion: "1",
      significance: "routine" as const,
      summary: {},
      acceptanceState: "accepted" as const,
      classification: "internal" as const,
      retentionClass: "standard" as const,
      tags: [],
      recordedAt,
      contentDigest: digest,
    });
  });
  return Object.freeze({
    snapshotId: "snapshot:1",
    snapshotSchemaId: "construct.consolidation.snapshot",
    snapshotSchemaVersion: 1,
    requestId: "request:1",
    domainId: "keep-the-signal",
    domainVersion: "1",
    memories,
    attachments: [],
    evidence: [],
    memoryRelations: [],
    evidenceRelations: [],
    retrievalReports: [],
    accessPolicy: {
      allowedDomains: ["keep-the-signal"] as const,
      allowedClassifications: ["internal"] as const,
      acceptedRetentionClasses: ["standard"] as const,
    },
    omittedReferences: [],
    truncatedReferences: [],
    serializedCharacters: 1,
    contentDigest: digest,
    recordedAt,
    actorId: "actor:test",
  });
}

import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "../app/features/intelligence-harness/memory-fabric/evidence-contract";
import type {
  EpisodicMemoryRecord,
  MemoryEvidenceAttachment,
} from "../app/features/intelligence-harness/memory-fabric/memory-contract";
import type { RetrievalResult } from "../app/features/intelligence-harness/memory-fabric/retrieval-contract";
import { createCandidateAbstraction } from "../app/features/intelligence-harness/consolidation/abstraction-contract";
import { createFeatureRecord } from "../app/features/intelligence-harness/consolidation/cluster-contract";
import {
  ConsolidationCoordinator,
  type ConsolidationBuilders,
  type ConsolidationRequest,
} from "../app/features/intelligence-harness/consolidation/consolidation-coordinator";
import {
  createEvidenceMatrix,
  createEvidenceMatrixEntry,
} from "../app/features/intelligence-harness/consolidation/evidence-matrix";
import type { ReadOnlyConsolidationSource } from "../app/features/intelligence-harness/consolidation/source-contract";

const digest = "a".repeat(64);
const recordedAt = "2026-08-02T08:00:00.000Z";

describe("KTS-I4-F consolidation coordinator", () => {
  it("runs a bounded read-only flow", async () => {
    const counters = { query: 0, attachments: 0 };
    const coordinator = new ConsolidationCoordinator(source(counters), builders());
    const result = await coordinator.run(request());
    expect(result.classification).toBe("completed");
    expect(result.snapshot?.memories).toHaveLength(1);
    expect(result.features).toHaveLength(1);
    expect(result.clusters).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);
    expect(counters.query).toBe(1);
  });

  it("never requires write operations on the source", async () => {
    const value = source();
    expect("putMemory" in value).toBe(false);
    const result = await new ConsolidationCoordinator(value, builders()).run(request());
    expect(result.classification).not.toBe("failed");
  });

  it("returns cancelled before source access", async () => {
    const counters = { query: 0, attachments: 0 };
    const controller = new AbortController();
    controller.abort();
    const result = await new ConsolidationCoordinator(source(counters), builders()).run(
      request(),
      controller.signal,
    );
    expect(result.classification).toBe("cancelled");
    expect(counters.query).toBe(0);
  });

  it("rejects a write-capable source shape", () => {
    expect(
      () =>
        new ConsolidationCoordinator(
          {
            ...source(),
            putMemory: async () => undefined,
          } as never,
          builders(),
        ),
    ).toThrowError();
  });

  it("enforces snapshot episode budget", async () => {
    const result = await new ConsolidationCoordinator(source(), builders()).run(
      request({
        maximumEpisodeCount: 0,
      }),
    );
    expect(result.classification).toBe("failed");
    expect(result.failure?.code).toBe("selection_budget_exceeded");
  });

  it("enforces snapshot evidence budget", async () => {
    const result = await new ConsolidationCoordinator(sourceWithEvidence(), builders()).run(
      request({
        maximumEvidenceCount: 0,
      }),
    );
    expect(result.classification).toBe("failed");
  });

  it("enforces snapshot character budget", async () => {
    const result = await new ConsolidationCoordinator(source(), builders()).run(
      request({
        maximumSerializedCharacters: 1,
      }),
    );
    expect(result.classification).toBe("failed");
  });

  it("bounds candidate count", async () => {
    const custom = builders();
    const result = await new ConsolidationCoordinator(source(), {
      ...custom,
      async buildCandidates(snapshot, clusters) {
        const one = await custom.buildCandidates(snapshot, clusters);
        return [one[0]!, one[0]!];
      },
    }).run(request({ maximumCandidateCount: 1 }));
    expect(result.candidates).toHaveLength(1);
  });

  it("bounds cluster count", async () => {
    const result = await new ConsolidationCoordinator(
      sourceWithMemories([
        memory("episode:a", { summary: { wave: 1 } }),
        memory("episode:b", { summary: { wave: 2 } }),
      ]),
      builders(),
    ).run(
      request({
        maximumClusterCount: 1,
        clusterPolicy: {
          ...request().clusterPolicy,
          maximumClusters: 10,
        },
      }),
    );
    expect(result.clusters).toHaveLength(1);
  });

  it("returns partial when selection truncates", async () => {
    const result = await new ConsolidationCoordinator(
      sourceWithMemories([memory("episode:a"), memory("episode:b")]),
      builders(),
    ).run(
      request({
        selectionPolicy: {
          ...request().selectionPolicy,
          budget: {
            resultLimit: 1,
            maximumSerializedCharacters: 100_000,
            relationTraversalLimit: 1,
          },
        },
      }),
    );
    expect(result.classification).toBe("partial");
  });

  it("returns rejected when all candidates are rejected", async () => {
    const custom = builders();
    const result = await new ConsolidationCoordinator(source(), {
      ...custom,
      async buildEvidenceMatrix(candidate) {
        return createEvidenceMatrix({
          matrixId: "matrix:rejected",
          matrixVersion: "1",
          candidateId: candidate.candidateId,
          candidateVersion: candidate.candidateVersion,
          entries: [
            createEvidenceMatrixEntry({
              entryId: "entry:counterexample",
              candidateId: candidate.candidateId,
              candidateVersion: candidate.candidateVersion,
              evidenceClass: "counterexample",
              referenceId: "episode:x",
              evaluatorId: "evaluator:test",
              evaluatorVersion: "1",
              outcome: "refutes",
              weightBasis: -1_000,
              explanationCode: "counterexample",
              limitations: [],
              recordedAt,
            }),
          ],
        });
      },
    }).run(request());
    expect(result.classification).toBe("rejected");
  });

  it("maps builder errors into safe failures", async () => {
    const custom = builders();
    const result = await new ConsolidationCoordinator(source(), {
      ...custom,
      async projectFeatures() {
        throw new Error("private payload");
      },
    }).run(request());
    expect(result.classification).toBe("failed");
    expect(result.failure?.message).not.toContain("private payload");
  });

  it("rejects work after disposal", async () => {
    const coordinator = new ConsolidationCoordinator(source(), builders());
    coordinator.dispose();
    await expect(coordinator.run(request())).rejects.toMatchObject({
      code: "consolidation_disposed",
    });
  });

  it("does not retry source queries", async () => {
    const counters = { query: 0, attachments: 0 };
    const result = await new ConsolidationCoordinator(source(counters, true), builders()).run(
      request(),
    );
    expect(result.classification).toBe("failed");
    expect(counters.query).toBe(1);
  });

  it("does not widen access permissions", async () => {
    const seen: string[][] = [];
    const customSource = source();
    const wrapped: ReadOnlyConsolidationSource = {
      ...customSource,
      async queryMemory(query) {
        seen.push([...query.allowedDomains]);
        return customSource.queryMemory(query);
      },
    };
    await new ConsolidationCoordinator(wrapped, builders()).run(request());
    expect(seen).toEqual([["keep-the-signal"]]);
  });

  it("produces immutable results", async () => {
    const result = await new ConsolidationCoordinator(source(), builders()).run(request());
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.features)).toBe(true);
  });

  it("keeps independent concurrent results", async () => {
    const coordinatorA = new ConsolidationCoordinator(source(), builders());
    const coordinatorB = new ConsolidationCoordinator(source(), builders());
    const [a, b] = await Promise.all([
      coordinatorA.run(request({ requestId: "request:a", snapshotId: "snapshot:a" })),
      coordinatorB.run(request({ requestId: "request:b", snapshotId: "snapshot:b" })),
    ]);
    expect(a.requestId).toBe("request:a");
    expect(b.requestId).toBe("request:b");
    expect(a).not.toBe(b);
  });

  it("produces deterministic equivalent results", async () => {
    const first = await new ConsolidationCoordinator(source(), builders()).run(request());
    const second = await new ConsolidationCoordinator(source(), builders()).run(request());
    expect(first).toEqual(second);
  });

  it("does not call a model bridge", async () => {
    const text = JSON.stringify(
      await new ConsolidationCoordinator(source(), builders()).run(request()),
    );
    expect(text).not.toContain("providerId");
    expect(text).not.toContain("modelId");
  });

  it("does not produce a retention action executor", async () => {
    const result = await new ConsolidationCoordinator(source(), builders()).run(request());
    expect("execute" in result).toBe(false);
  });

  it("preserves caller-supplied request identity", async () => {
    const result = await new ConsolidationCoordinator(source(), builders()).run(
      request({ requestId: "request:caller" }),
    );
    expect(result.requestId).toBe("request:caller");
  });

  it("preserves caller-supplied snapshot identity", async () => {
    const result = await new ConsolidationCoordinator(source(), builders()).run(
      request({ snapshotId: "snapshot:caller" }),
    );
    expect(result.snapshot?.snapshotId).toBe("snapshot:caller");
  });

  it("does not mutate the request", async () => {
    const value = request();
    const original = JSON.stringify(value);
    await new ConsolidationCoordinator(source(), builders()).run(value);
    expect(JSON.stringify(value)).toBe(original);
  });

  it("does not mutate builder output arrays", async () => {
    const custom = builders();
    const features = [await custom.projectFeatures(await fakeSnapshot())];
    expect(features).toHaveLength(1);
  });
});

function request(overrides: Partial<ConsolidationRequest> = {}): ConsolidationRequest {
  return {
    requestId: "request:1",
    snapshotId: "snapshot:1",
    domainId: "keep-the-signal",
    domainVersion: "1",
    sourceSchemaId: "construct.memory",
    sourceSchemaVersion: 1,
    selectionPolicy: {
      requestId: "access:1",
      allowedDomains: ["keep-the-signal"],
      allowedClassifications: ["internal"],
      acceptedRetentionClasses: ["standard"],
      acceptedMemoryStates: ["accepted"],
      acceptedSignificance: ["routine"],
      ordering: "canonical_identity",
      budget: {
        resultLimit: 100,
        maximumSerializedCharacters: 1_000_000,
        relationTraversalLimit: 2,
      },
      evidenceBudget: {
        resultLimit: 100,
        maximumSerializedCharacters: 1_000_000,
        relationTraversalLimit: 2,
      },
    },
    clusterPolicy: {
      policyId: "policy:cluster",
      policyVersion: "1",
      mode: "exact_feature_match",
      featureKeys: ["wave"],
      missingValueTreatment: "shared_unknown",
      maximumClusters: 100,
      maximumMembersPerCluster: 100,
      overflowBehaviour: "truncate",
      minimumClusterSize: 1,
      singletonTreatment: "retain",
    },
    validationPolicy: {
      policyId: "policy:validation",
      policyVersion: "1",
      minimumSupportCardinality: 1,
      maximumConfidenceWithoutUnseenEvidence: 10_000,
      requireContradictionResolution: false,
      requireVersionBoundaryEvidence: false,
      requireReproducibilityEvidence: false,
      requireInvariantEvidence: false,
      protectedReferenceIds: [],
    },
    retentionPolicy: {
      policyId: "policy:retention",
      policyVersion: "1",
      minimumSupportCardinality: 2,
      archiveRoutineWithoutTarget: true,
      permitForgettingCandidate: true,
    },
    maximumCandidateCount: 100,
    maximumClusterCount: 100,
    maximumEpisodeCount: 100,
    maximumEvidenceCount: 100,
    maximumSerializedCharacters: 10_000_000,
    actorId: "actor:test",
    recordedAt,
    ...overrides,
  };
}

function builders(): ConsolidationBuilders {
  return {
    async projectFeatures(snapshot) {
      return Promise.all(
        snapshot.memories.map((item) =>
          createFeatureRecord({
            featureRecordId: `feature:${item.memoryId}`,
            featureRecordVersion: "1",
            sourceEpisodeId: item.memoryId,
            sourceEpisodeDigest: item.contentDigest,
            domainId: item.domainId,
            domainVersion: item.domainVersion,
            featureSchemaId: "test.features",
            featureSchemaVersion: 1,
            features: { wave: (item.summary as { wave?: number }).wave ?? 1 },
            missingFeatures: [],
            extractionMethodId: "test",
            extractionMethodVersion: "1",
            sourceEvidenceReferences: [],
            sourceAttachmentReferences: [],
            sourceRelationReferences: [],
            projectionLimitations: [],
          }),
        ),
      );
    },
    async buildCandidates(snapshot, clusters) {
      return Promise.all(
        clusters.map((cluster, index) =>
          createCandidateAbstraction({
            candidateId: `candidate:${index}`,
            candidateVersion: "1",
            candidateSchemaId: "test.candidate",
            candidateSchemaVersion: 1,
            candidateKind: "pattern_candidate",
            domainId: snapshot.domainId,
            domainVersion: snapshot.domainVersion,
            sourceClusterIds: [cluster.clusterId],
            sourceEpisodeIds: cluster.memberEpisodeIds,
            sourceEvidenceIds: [],
            representation: cluster.sharedFeatureBasis,
            applicabilityConditions: [],
            exclusionConditions: [],
            expectedEffects: [],
            knownFailureModes: [],
            confidenceBasisPoints: 4_000,
            uncertainty: "medium",
            extractionMethodId: "test",
            extractionMethodVersion: "1",
            versionBoundaries: [],
            supportingReferences: cluster.memberEpisodeIds,
            contradictionReferences: [],
            counterexampleReferences: [],
            unseenEvaluationReferences: [],
            competingExplanationReferences: [],
            invariantCheckReferences: [],
            status: "experimental_candidate",
            actorId: snapshot.actorId,
            recordedAt: snapshot.recordedAt,
          }),
        ),
      );
    },
    async buildEvidenceMatrix(candidate) {
      return createEvidenceMatrix({
        matrixId: `matrix:${candidate.candidateId}`,
        matrixVersion: "1",
        candidateId: candidate.candidateId,
        candidateVersion: candidate.candidateVersion,
        entries: candidate.sourceEpisodeIds.map((id, index) =>
          createEvidenceMatrixEntry({
            entryId: `entry:${candidate.candidateId}:${index}`,
            candidateId: candidate.candidateId,
            candidateVersion: candidate.candidateVersion,
            evidenceClass: "support",
            referenceId: id,
            evaluatorId: "evaluator:test",
            evaluatorVersion: "1",
            outcome: "supports",
            weightBasis: 1_000,
            explanationCode: "support",
            limitations: [],
            recordedAt,
          }),
        ),
      });
    },
    async buildRetentionDecisions(snapshot) {
      return snapshot.memories.map((item) =>
        Object.freeze({
          memoryId: item.memoryId,
          policyId: "policy:retention",
          policyVersion: "1",
          decision: "retain" as const,
          protectedReasons: [],
          passedConditions: ["retention_required"],
          failedConditions: [],
        }),
      );
    },
  };
}

function source(
  counters = { query: 0, attachments: 0 },
  failQuery = false,
): ReadOnlyConsolidationSource {
  return sourceWithMemories([memory("episode:a")], counters, failQuery);
}

function sourceWithMemories(
  memories: readonly Readonly<EpisodicMemoryRecord>[],
  counters = { query: 0, attachments: 0 },
  failQuery = false,
): ReadOnlyConsolidationSource {
  return {
    async getEvidence() {
      return null;
    },
    async getEvidenceRelations() {
      return [];
    },
    async queryEvidence() {
      return result<EvidenceRecord>([]);
    },
    async getMemory(id) {
      return memories.find((item) => item.memoryId === id) ?? null;
    },
    async getMemoryRelations() {
      return [];
    },
    async queryMemory() {
      counters.query += 1;
      if (failQuery) throw new Error("source failure");
      return result(memories);
    },
    async getMemoryAttachments(_request) {
      void _request;
      counters.attachments += 1;
      return result<MemoryEvidenceAttachment>([]);
    },
  };
}

function sourceWithEvidence(): ReadOnlyConsolidationSource {
  const item = memory("episode:a");
  const evidenceRecord: Readonly<EvidenceRecord> = Object.freeze({
    evidenceId: "evidence:a",
    evidenceSchemaId: "construct.evidence",
    evidenceSchemaVersion: 1,
    domainId: "keep-the-signal",
    domainVersion: "1",
    sourceType: "outcome",
    sourceSchemaId: "test.evidence",
    sourceSchemaVersion: 1,
    sourceIdentity: "outcome:a",
    authoritativePosition: { tick: 1 },
    payload: { outcome: "stable" },
    acceptanceState: "accepted",
    classification: "internal",
    retentionClass: "standard",
    tags: [],
    recordedAt,
    contentDigest: digest,
  });
  const attachment: Readonly<MemoryEvidenceAttachment> = Object.freeze({
    attachmentId: "attachment:a",
    attachmentSchemaVersion: 1,
    memoryId: item.memoryId,
    evidenceId: evidenceRecord.evidenceId,
    role: "outcome",
    sequence: 0,
    metadata: {},
    canonicalContent: "{}",
  });
  return {
    async getEvidence(id) {
      return id === evidenceRecord.evidenceId ? evidenceRecord : null;
    },
    async getEvidenceRelations() {
      return [];
    },
    async queryEvidence() {
      return result([evidenceRecord]);
    },
    async getMemory(id) {
      return id === item.memoryId ? item : null;
    },
    async getMemoryRelations() {
      return [];
    },
    async queryMemory() {
      return result([item]);
    },
    async getMemoryAttachments() {
      return result([attachment]);
    },
  };
}

function result<T>(records: readonly Readonly<T>[]): Readonly<RetrievalResult<T>> {
  return {
    records,
    metadata: {
      returnedCount: records.length,
      omittedCount: 0,
      truncated: false,
      serializedCharacters: JSON.stringify(records).length,
      orderingPolicy: "fixture",
      appliedFilters: [],
    },
  };
}

function memory(
  memoryId: string,
  overrides: Partial<EpisodicMemoryRecord> = {},
): Readonly<EpisodicMemoryRecord> {
  return Object.freeze({
    memoryId,
    memoryKind: "episodic",
    memorySchemaId: "construct.memory",
    memorySchemaVersion: 1,
    domainId: "keep-the-signal",
    domainVersion: "1",
    significance: "routine",
    summary: { wave: 1 },
    acceptanceState: "accepted",
    classification: "internal",
    retentionClass: "standard",
    tags: [],
    recordedAt,
    contentDigest: digest,
    ...overrides,
  });
}

async function fakeSnapshot() {
  const result = await new ConsolidationCoordinator(source(), builders()).run(request());
  return result.snapshot!;
}

import type { EvidenceRecord } from "../../intelligence-harness/memory-fabric/evidence-contract";
import type {
  EpisodicMemoryRecord,
  MemoryEvidenceAttachment,
} from "../../intelligence-harness/memory-fabric/memory-contract";
import {
  createCandidateAbstraction,
  type CandidateAbstraction,
} from "../../intelligence-harness/consolidation/abstraction-contract";
import type { ClusterRecord } from "../../intelligence-harness/consolidation/cluster-contract";
import {
  createEvidenceMatrix,
  createEvidenceMatrixEntry,
  type EvidenceMatrix,
} from "../../intelligence-harness/consolidation/evidence-matrix";
import type { ConsolidationSnapshot } from "../../intelligence-harness/consolidation/episode-snapshot";
import type { ConsolidationBuilders } from "../../intelligence-harness/consolidation/consolidation-coordinator";
import type { ConsolidationValidationReport } from "../../intelligence-harness/consolidation/consolidation-validator";
import type {
  RetentionDecisionReport,
  RetentionPolicy,
} from "../../intelligence-harness/consolidation/retention-policy";
import { buildKtsRetentionContext, evaluateKtsRetention } from "./kts-consolidation-policy";
import { projectKtsConsolidationFeatures } from "./kts-consolidation-features";

function evidenceForMemory(
  snapshot: Readonly<ConsolidationSnapshot>,
  memoryId: string,
): readonly Readonly<EvidenceRecord>[] {
  const ids = new Set(
    snapshot.attachments
      .filter((attachment) => attachment.memoryId === memoryId)
      .map((attachment) => attachment.evidenceId),
  );
  return snapshot.evidence.filter((record) => ids.has(record.evidenceId));
}

function attachmentsForMemory(
  snapshot: Readonly<ConsolidationSnapshot>,
  memoryId: string,
): readonly Readonly<MemoryEvidenceAttachment>[] {
  return snapshot.attachments.filter((attachment) => attachment.memoryId === memoryId);
}

async function buildKtsCandidates(
  snapshot: Readonly<ConsolidationSnapshot>,
  clusters: readonly Readonly<ClusterRecord>[],
): Promise<readonly Readonly<CandidateAbstraction>[]> {
  const candidates: Readonly<CandidateAbstraction>[] = [];
  for (const [index, cluster] of clusters.entries()) {
    candidates.push(
      await createCandidateAbstraction({
        candidateId: `candidate:kts:${index}`,
        candidateVersion: "1",
        candidateSchemaId: "kts.consolidation.candidate",
        candidateSchemaVersion: 1,
        candidateKind: "pattern_candidate",
        domainId: snapshot.domainId,
        domainVersion: snapshot.domainVersion,
        sourceClusterIds: [cluster.clusterId],
        sourceEpisodeIds: cluster.memberEpisodeIds,
        sourceEvidenceIds: snapshot.attachments
          .filter((attachment) => cluster.memberEpisodeIds.includes(attachment.memoryId))
          .map((attachment) => attachment.evidenceId),
        representation: {
          sharedFeatures: cluster.sharedFeatureBasis,
          divergentFeatures: cluster.divergentFeatureReport,
        },
        applicabilityConditions: [],
        exclusionConditions: [],
        expectedEffects: [],
        knownFailureModes: cluster.contradictionReferences.length
          ? ["Contradictory source outcomes require explicit resolution."]
          : [],
        confidenceBasisPoints: Math.min(9_000, 4_000 + cluster.memberCount * 100),
        uncertainty: cluster.contradictionReferences.length ? "high" : "medium",
        extractionMethodId: "kts.deterministic_cluster_abstraction",
        extractionMethodVersion: "1",
        versionBoundaries: [],
        supportingReferences: cluster.memberEpisodeIds,
        contradictionReferences: cluster.contradictionReferences,
        counterexampleReferences: [],
        unseenEvaluationReferences: [],
        competingExplanationReferences: [],
        invariantCheckReferences: [],
        status: "experimental_candidate",
        actorId: snapshot.actorId,
        recordedAt: snapshot.recordedAt,
      }),
    );
  }
  return Object.freeze(candidates);
}

async function buildKtsMatrix(
  candidate: Readonly<CandidateAbstraction>,
  snapshot: Readonly<ConsolidationSnapshot>,
): Promise<Readonly<EvidenceMatrix>> {
  const entries = candidate.sourceEpisodeIds.map((memoryId, index) =>
    createEvidenceMatrixEntry({
      entryId: `matrix-entry:${candidate.candidateId}:${index}`,
      candidateId: candidate.candidateId,
      candidateVersion: candidate.candidateVersion,
      evidenceClass: "support",
      referenceId: memoryId,
      evaluatorId: "kts.deterministic_matrix",
      evaluatorVersion: "1",
      outcome: "supports",
      weightBasis: 1_000,
      explanationCode: "source_cluster_member",
      limitations: [],
      recordedAt: snapshot.recordedAt,
    }),
  );
  for (const [index, reference] of candidate.contradictionReferences.entries()) {
    entries.push(
      createEvidenceMatrixEntry({
        entryId: `matrix-contradiction:${candidate.candidateId}:${index}`,
        candidateId: candidate.candidateId,
        candidateVersion: candidate.candidateVersion,
        evidenceClass: "contradiction",
        referenceId: reference,
        evaluatorId: "kts.deterministic_matrix",
        evaluatorVersion: "1",
        outcome: "refutes",
        weightBasis: -1_000,
        explanationCode: "explicit_contradiction",
        limitations: [],
        recordedAt: snapshot.recordedAt,
      }),
    );
  }
  return createEvidenceMatrix({
    matrixId: `matrix:${candidate.candidateId}`,
    matrixVersion: "1",
    candidateId: candidate.candidateId,
    candidateVersion: candidate.candidateVersion,
    entries,
  });
}

async function buildKtsRetentionDecisions(
  snapshot: Readonly<ConsolidationSnapshot>,
  validations: readonly Readonly<ConsolidationValidationReport>[],
  policy: Readonly<RetentionPolicy>,
): Promise<readonly Readonly<RetentionDecisionReport>[]> {
  const validation = validations[0]?.classification ?? "needs_more_evidence";
  return Object.freeze(
    snapshot.memories.map((memory: Readonly<EpisodicMemoryRecord>) => {
      const evidence = evidenceForMemory(snapshot, memory.memoryId);
      const attachments = attachmentsForMemory(snapshot, memory.memoryId);
      const context = buildKtsRetentionContext({
        memory,
        attachments,
        evidence,
        relations: snapshot.memoryRelations.filter(
          (relation) =>
            relation.sourceMemoryId === memory.memoryId ||
            relation.targetMemoryId === memory.memoryId,
        ),
        validationClassification: validation,
        supportCardinality: snapshot.memories.length,
        higherLevelTargetAvailable: false,
        requiredForReproducibility:
          memory.significance === "benchmark" ||
          evidence.some((record) => record.tags.includes("reproducibility")),
        legalStatus: "unknown",
        consentStatus: "unknown",
        auditStatus: "unknown",
      });
      return evaluateKtsRetention({ policy, context });
    }),
  );
}

export function createKtsConsolidationBuilders(): Readonly<ConsolidationBuilders> {
  return Object.freeze({
    projectFeatures: projectKtsConsolidationFeatures,
    buildCandidates: buildKtsCandidates,
    buildEvidenceMatrix: buildKtsMatrix,
    buildRetentionDecisions: buildKtsRetentionDecisions,
  });
}

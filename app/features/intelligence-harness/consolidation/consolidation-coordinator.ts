import { deepFreezeJson, type JsonObject } from "../memory-fabric/canonical-json";
import type { CandidateAbstraction } from "./abstraction-contract";
import type { FeatureRecord, ClusterRecord, DeterministicClusterPolicy } from "./cluster-contract";
import { clusterDeterministically } from "./deterministic-clusterer";
import type { ConsolidationSnapshot, SnapshotAccessPolicy } from "./episode-snapshot";
import { snapshotFromSelection } from "./episode-snapshot";
import type { EvidenceMatrix } from "./evidence-matrix";
import {
  ConsolidationFailure,
  failConsolidation,
  mapUnknownConsolidationFailure,
  validateConsolidationIdentity,
  validateConsolidationTimestamp,
} from "./failures";
import type {
  ForgettingEvaluationReport,
  ForgettingEvaluationRequest,
} from "./forgetting-contract";
import { evaluateForgetting } from "./forgetting-evaluator";
import type { ReadOnlyConsolidationSource } from "./source-contract";
import { isReadOnlyConsolidationSource } from "./source-contract";
import { selectEpisodes, type EpisodeSelectionPolicy } from "./selection-contract";
import type {
  ConsolidationValidationPolicy,
  ConsolidationValidationReport,
} from "./consolidation-validator";
import { validateConsolidationCandidate } from "./consolidation-validator";
import type { RetentionDecisionReport, RetentionPolicy } from "./retention-policy";
import type { TombstoneDraftInput } from "./tombstone-contract";

export interface ConsolidationRequest {
  readonly requestId: string;
  readonly snapshotId: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly sourceSchemaId: string;
  readonly sourceSchemaVersion: number;
  readonly selectionPolicy: EpisodeSelectionPolicy;
  readonly clusterPolicy: DeterministicClusterPolicy;
  readonly validationPolicy: ConsolidationValidationPolicy;
  readonly retentionPolicy: RetentionPolicy;
  readonly maximumCandidateCount: number;
  readonly maximumClusterCount: number;
  readonly maximumEpisodeCount: number;
  readonly maximumEvidenceCount: number;
  readonly maximumSerializedCharacters: number;
  readonly actorId: string;
  readonly recordedAt: string;
  readonly sessionId?: string;
  readonly batchId?: string;
  readonly predecessorRequestId?: string;
  readonly governanceDecisionId?: string;
}

export interface ConsolidationBuilders {
  projectFeatures(
    snapshot: Readonly<ConsolidationSnapshot>,
  ): Promise<readonly Readonly<FeatureRecord>[]>;
  buildCandidates(
    snapshot: Readonly<ConsolidationSnapshot>,
    clusters: readonly Readonly<ClusterRecord>[],
  ): Promise<readonly Readonly<CandidateAbstraction>[]>;
  buildEvidenceMatrix(
    candidate: Readonly<CandidateAbstraction>,
    snapshot: Readonly<ConsolidationSnapshot>,
  ): Promise<Readonly<EvidenceMatrix>>;
  buildRetentionDecisions(
    snapshot: Readonly<ConsolidationSnapshot>,
    validations: readonly Readonly<ConsolidationValidationReport>[],
    policy: Readonly<RetentionPolicy>,
  ): Promise<readonly Readonly<RetentionDecisionReport>[]>;
  buildForgettingRequest?(
    snapshot: Readonly<ConsolidationSnapshot>,
    retentionDecisions: readonly Readonly<RetentionDecisionReport>[],
  ): Promise<Readonly<ForgettingEvaluationRequest> | null>;
  buildTombstoneInputs?(
    snapshot: Readonly<ConsolidationSnapshot>,
    request: Readonly<ForgettingEvaluationRequest>,
  ): Promise<Readonly<Record<string, Readonly<TombstoneDraftInput>>>>;
}

export type ConsolidationCoordinatorClassification =
  "completed" | "partial" | "rejected" | "failed" | "cancelled";

export interface ConsolidationCoordinatorResult {
  readonly requestId: string;
  readonly classification: ConsolidationCoordinatorClassification;
  readonly snapshot?: Readonly<ConsolidationSnapshot>;
  readonly features: readonly Readonly<FeatureRecord>[];
  readonly clusters: readonly Readonly<ClusterRecord>[];
  readonly candidates: readonly Readonly<CandidateAbstraction>[];
  readonly matrices: readonly Readonly<EvidenceMatrix>[];
  readonly validations: readonly Readonly<ConsolidationValidationReport>[];
  readonly retentionDecisions: readonly Readonly<RetentionDecisionReport>[];
  readonly forgettingReport?: Readonly<ForgettingEvaluationReport>;
  readonly failure?: Readonly<ConsolidationFailure>;
}

export class ConsolidationCoordinator {
  #disposed = false;
  readonly #source: ReadOnlyConsolidationSource;
  readonly #builders: ConsolidationBuilders;

  constructor(source: ReadOnlyConsolidationSource, builders: ConsolidationBuilders) {
    if (!isReadOnlyConsolidationSource(source)) {
      failConsolidation(
        "invalid_source",
        "source",
        "Consolidation requires an injected read-only source.",
      );
    }
    this.#source = source;
    this.#builders = builders;
  }

  async run(
    request: Readonly<ConsolidationRequest>,
    signal?: AbortSignal,
  ): Promise<Readonly<ConsolidationCoordinatorResult>> {
    if (this.#disposed) {
      failConsolidation(
        "consolidation_disposed",
        "coordination",
        "Consolidation coordinator is disposed.",
      );
    }
    validateConsolidationIdentity(
      request.requestId,
      "requestId",
      "invalid_consolidation_request",
      "request_validation",
      { requestId: request.requestId },
    );
    validateConsolidationIdentity(
      request.snapshotId,
      "snapshotId",
      "invalid_consolidation_request",
      "request_validation",
      { requestId: request.requestId },
    );
    validateConsolidationIdentity(
      request.domainId,
      "domainId",
      "invalid_consolidation_request",
      "request_validation",
      { requestId: request.requestId },
    );
    validateConsolidationIdentity(
      request.domainVersion,
      "domainVersion",
      "invalid_consolidation_request",
      "request_validation",
      { requestId: request.requestId },
    );
    validateConsolidationIdentity(
      request.sourceSchemaId,
      "sourceSchemaId",
      "invalid_consolidation_request",
      "request_validation",
      { requestId: request.requestId },
    );
    validateConsolidationIdentity(
      request.actorId,
      "actorId",
      "invalid_consolidation_request",
      "request_validation",
      { requestId: request.requestId },
    );
    validateConsolidationTimestamp(
      request.recordedAt,
      "invalid_consolidation_request",
      "request_validation",
      { requestId: request.requestId },
    );
    if (signal?.aborted) {
      return Object.freeze({
        requestId: request.requestId,
        classification: "cancelled",
        features: [],
        clusters: [],
        candidates: [],
        matrices: [],
        validations: [],
        retentionDecisions: [],
      });
    }
    try {
      const selection = await selectEpisodes(this.#source, {
        requestId: request.requestId,
        domainId: request.domainId,
        domainVersion: request.domainVersion,
        policy: request.selectionPolicy,
      });
      const snapshot = await snapshotFromSelection(selection, {
        snapshotId: request.snapshotId,
        domainId: request.domainId,
        domainVersion: request.domainVersion,
        accessPolicy: {
          allowedDomains: request.selectionPolicy.allowedDomains,
          allowedClassifications: request.selectionPolicy.allowedClassifications,
          acceptedRetentionClasses: request.selectionPolicy.acceptedRetentionClasses,
        } satisfies SnapshotAccessPolicy,
        recordedAt: request.recordedAt,
        actorId: request.actorId,
      });
      if (
        snapshot.memories.length > request.maximumEpisodeCount ||
        snapshot.evidence.length > request.maximumEvidenceCount ||
        snapshot.serializedCharacters > request.maximumSerializedCharacters
      ) {
        failConsolidation(
          "selection_budget_exceeded",
          "snapshot",
          "Coordinator snapshot budget was exceeded.",
          {
            requestId: request.requestId,
            snapshotId: snapshot.snapshotId,
          },
        );
      }
      const features = await this.#builders.projectFeatures(snapshot);
      const clusterResult = await clusterDeterministically(features, {
        ...request.clusterPolicy,
        maximumClusters: Math.min(
          request.clusterPolicy.maximumClusters,
          request.maximumClusterCount,
        ),
      });
      const candidates = (
        await this.#builders.buildCandidates(snapshot, clusterResult.clusters)
      ).slice(0, request.maximumCandidateCount);
      const matrices: Readonly<EvidenceMatrix>[] = [];
      const validations: Readonly<ConsolidationValidationReport>[] = [];
      for (const candidate of candidates) {
        const matrix = await this.#builders.buildEvidenceMatrix(candidate, snapshot);
        matrices.push(matrix);
        validations.push(
          validateConsolidationCandidate(candidate, matrix, request.validationPolicy),
        );
      }
      const retentionDecisions = await this.#builders.buildRetentionDecisions(
        snapshot,
        validations,
        request.retentionPolicy,
      );
      let forgettingReport;
      if (this.#builders.buildForgettingRequest !== undefined) {
        const forgettingRequest = await this.#builders.buildForgettingRequest(
          snapshot,
          retentionDecisions,
        );
        if (forgettingRequest !== null) {
          const tombstoneInputs =
            this.#builders.buildTombstoneInputs === undefined
              ? {}
              : await this.#builders.buildTombstoneInputs(snapshot, forgettingRequest);
          forgettingReport = await evaluateForgetting({
            snapshot,
            request: forgettingRequest,
            retentionDecisions,
            tombstoneInputs,
          });
        }
      }
      const rejected =
        validations.length > 0 &&
        validations.every((report) => report.classification === "candidate_rejected");
      const partial =
        selection.metadata.truncated ||
        clusterResult.overflowed ||
        candidates.length < clusterResult.clusters.length;
      return deepFreezeJson({
        requestId: request.requestId,
        classification: rejected ? "rejected" : partial ? "partial" : "completed",
        snapshot,
        features,
        clusters: clusterResult.clusters,
        candidates,
        matrices,
        validations,
        retentionDecisions,
        ...(forgettingReport ? { forgettingReport } : {}),
      } as unknown as JsonObject) as unknown as Readonly<ConsolidationCoordinatorResult>;
    } catch (error) {
      const failure = mapUnknownConsolidationFailure(error, "coordination", {
        requestId: request.requestId,
      });
      return Object.freeze({
        requestId: request.requestId,
        classification: failure.code === "consolidation_cancelled" ? "cancelled" : "failed",
        features: [],
        clusters: [],
        candidates: [],
        matrices: [],
        validations: [],
        retentionDecisions: [],
        failure,
      });
    }
  }

  dispose(): void {
    this.#disposed = true;
  }
}

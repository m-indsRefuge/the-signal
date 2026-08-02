import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import type { ConsolidationSnapshot } from "./episode-snapshot";
import type { InformationPreservationMap, PreservationTarget } from "./preservation-contract";
import type { RetentionDecisionReport } from "./retention-policy";
import type { TombstoneDraft } from "./tombstone-contract";
import {
  failConsolidation,
  validateConsolidationIdentity,
  validateConsolidationTimestamp,
} from "./failures";

export const PROBE_OUTCOMES = Object.freeze(["pass", "fail", "unknown", "not_applicable"] as const);
export type ProbeOutcome = (typeof PROBE_OUTCOMES)[number];

export const FORGETTING_CLASSIFICATIONS = Object.freeze([
  "forgetting_eligible",
  "forgetting_ineligible",
  "protected",
  "evaluation_failed",
] as const);
export type ForgettingClassification = (typeof FORGETTING_CLASSIFICATIONS)[number];

export interface ReconstructionProbe {
  readonly probeId: string;
  readonly probeVersion: string;
  readonly requiredInformationUnitIds: readonly string[];
  readonly allowedPreservationTargetIds: readonly string[];
  readonly allowedRetainedMemoryIds: readonly string[];
  readonly allowedRetainedEvidenceIds: readonly string[];
  readonly reconstructionMethodId: string;
  readonly expectedCanonicalResult?: JsonValue;
  readonly maximumOperations: number;
  readonly maximumSerializedCharacters: number;
  readonly blocking: boolean;
}

export interface RetrievalQualityProbe {
  readonly probeId: string;
  readonly probeVersion: string;
  readonly requiredResultIds: readonly string[];
  readonly prohibitedResultIds: readonly string[];
  readonly expectedOrdering?: readonly string[];
  readonly maximumResultLoss: number;
  readonly maximumCharacterDifference: number;
  readonly contradictionPreservationRequired: boolean;
  readonly blocking: boolean;
}

export interface BooleanVerificationProbe {
  readonly probeId: string;
  readonly probeVersion: string;
  readonly kind: "lineage" | "reproducibility";
  readonly suppliedOutcome: ProbeOutcome;
  readonly blocking: boolean;
  readonly referenceIds: readonly string[];
}

export interface ForgettingEvaluationRequest {
  readonly evaluationId: string;
  readonly sourceSnapshotId: string;
  readonly sourceSnapshotDigest: string;
  readonly candidateMemoryIds: readonly string[];
  readonly retentionPolicyId: string;
  readonly retentionPolicyVersion: string;
  readonly preservationTargets: readonly Readonly<PreservationTarget>[];
  readonly preservationMaps: readonly Readonly<InformationPreservationMap>[];
  readonly reconstructionProbes: readonly Readonly<ReconstructionProbe>[];
  readonly retrievalQualityProbes: readonly Readonly<RetrievalQualityProbe>[];
  readonly lineageProbes: readonly Readonly<BooleanVerificationProbe>[];
  readonly reproducibilityProbes: readonly Readonly<BooleanVerificationProbe>[];
  readonly maximumCandidateCount: number;
  readonly maximumProbeCount: number;
  readonly maximumSerializedCharacters: number;
  readonly actorId: string;
  readonly evaluatedAt: string;
  readonly governanceDecisionId?: string;
}

export interface VirtualRetainedView {
  readonly snapshotId: string;
  readonly snapshotDigest: string;
  readonly retainedMemoryIds: readonly string[];
  readonly virtuallyExcludedMemoryIds: readonly string[];
  readonly retainedEvidenceIds: readonly string[];
  readonly tombstoneDraftIds: readonly string[];
  readonly attemptedExcludedAccesses: readonly string[];
  readonly canonicalContent: string;
}

export interface ProbeReport {
  readonly probeId: string;
  readonly probeVersion: string;
  readonly outcome: ProbeOutcome;
  readonly passedConditions: readonly string[];
  readonly failedConditions: readonly string[];
  readonly unknownConditions: readonly string[];
  readonly beforeResultIds?: readonly string[];
  readonly afterResultIds?: readonly string[];
  readonly serializedCharacterDifference?: number;
}

export interface ForgettingDecision {
  readonly memoryId: string;
  readonly classification: ForgettingClassification;
  readonly passedConditions: readonly string[];
  readonly failedConditions: readonly string[];
  readonly unknownConditions: readonly string[];
  readonly retentionDecision: Readonly<RetentionDecisionReport>;
  readonly reconstructionReports: readonly Readonly<ProbeReport>[];
  readonly retrievalReports: readonly Readonly<ProbeReport>[];
  readonly lineageReports: readonly Readonly<ProbeReport>[];
  readonly reproducibilityReports: readonly Readonly<ProbeReport>[];
  readonly tombstoneDraft?: Readonly<TombstoneDraft>;
}

export interface ForgettingEvaluationReport {
  readonly evaluationId: string;
  readonly sourceSnapshotId: string;
  readonly virtualView: Readonly<VirtualRetainedView>;
  readonly decisions: readonly Readonly<ForgettingDecision>[];
  readonly classificationCounts: Readonly<Record<ForgettingClassification, number>>;
}

export function validateForgettingRequest(
  request: Readonly<ForgettingEvaluationRequest>,
  snapshot: Readonly<ConsolidationSnapshot>,
): void {
  for (const [label, value] of [
    ["evaluationId", request.evaluationId],
    ["sourceSnapshotId", request.sourceSnapshotId],
    ["retentionPolicyId", request.retentionPolicyId],
    ["retentionPolicyVersion", request.retentionPolicyVersion],
    ["actorId", request.actorId],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_forgetting_request", "forgetting", {
      evaluationId: request.evaluationId,
    });
  }
  validateConsolidationTimestamp(request.evaluatedAt, "invalid_forgetting_request", "forgetting", {
    evaluationId: request.evaluationId,
  });
  if (
    request.sourceSnapshotId !== snapshot.snapshotId ||
    request.sourceSnapshotDigest !== snapshot.contentDigest
  ) {
    failConsolidation(
      "invalid_forgetting_request",
      "forgetting",
      "Forgetting request snapshot lineage differs.",
      {
        evaluationId: request.evaluationId,
      },
    );
  }
  const probeCount =
    request.reconstructionProbes.length +
    request.retrievalQualityProbes.length +
    request.lineageProbes.length +
    request.reproducibilityProbes.length;
  if (
    !Number.isSafeInteger(request.maximumCandidateCount) ||
    request.maximumCandidateCount < 1 ||
    request.candidateMemoryIds.length > request.maximumCandidateCount ||
    !Number.isSafeInteger(request.maximumProbeCount) ||
    request.maximumProbeCount < 1 ||
    probeCount > request.maximumProbeCount ||
    !Number.isSafeInteger(request.maximumSerializedCharacters) ||
    request.maximumSerializedCharacters < 1 ||
    canonicalStringify(request).length > request.maximumSerializedCharacters
  ) {
    failConsolidation(
      "invalid_forgetting_request",
      "forgetting",
      "Forgetting request budget is invalid.",
      {
        evaluationId: request.evaluationId,
      },
    );
  }
}

export function createVirtualRetainedView(
  snapshot: Readonly<ConsolidationSnapshot>,
  excludedMemoryIds: readonly string[],
  tombstoneDrafts: readonly Readonly<TombstoneDraft>[] = [],
): Readonly<VirtualRetainedView> {
  const known = new Set(snapshot.memories.map((memory) => memory.memoryId));
  if (excludedMemoryIds.some((id) => !known.has(id))) {
    failConsolidation(
      "invalid_virtual_view",
      "virtual_view",
      "Virtual exclusion references unknown memory.",
    );
  }
  const excluded = [...new Set(excludedMemoryIds)].sort();
  const retained = snapshot.memories
    .map((memory) => memory.memoryId)
    .filter((id) => !excluded.includes(id))
    .sort();
  const normalized = canonicalizeJson({
    snapshotId: snapshot.snapshotId,
    snapshotDigest: snapshot.contentDigest,
    retainedMemoryIds: retained,
    virtuallyExcludedMemoryIds: excluded,
    retainedEvidenceIds: snapshot.evidence.map((record) => record.evidenceId).sort(),
    tombstoneDraftIds: tombstoneDrafts.map((draft) => draft.tombstoneId).sort(),
    attemptedExcludedAccesses: [],
  }) as unknown as Omit<VirtualRetainedView, "canonicalContent">;
  return deepFreezeJson({
    ...normalized,
    canonicalContent: canonicalStringify(normalized),
  } as unknown as JsonObject) as unknown as Readonly<VirtualRetainedView>;
}

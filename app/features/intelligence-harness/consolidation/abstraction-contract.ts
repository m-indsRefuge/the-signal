import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import {
  failConsolidation,
  validateConsolidationIdentity,
  validateConsolidationTimestamp,
} from "./failures";

export const CANDIDATE_KINDS = Object.freeze([
  "pattern_candidate",
  "semantic_claim_candidate",
  "strategy_refinement_candidate",
] as const);
export type CandidateKind = (typeof CANDIDATE_KINDS)[number];

export const CANDIDATE_STATUSES = Object.freeze([
  "experimental_candidate",
  "validated_candidate",
  "rejected",
  "quarantined",
  "superseded",
] as const);
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const UNCERTAINTY_CLASSES = Object.freeze(["low", "medium", "high", "unknown"] as const);
export type ConsolidationUncertainty = (typeof UNCERTAINTY_CLASSES)[number];

export interface CandidateAbstractionDraft {
  readonly candidateId: string;
  readonly candidateVersion: string;
  readonly candidateSchemaId: string;
  readonly candidateSchemaVersion: number;
  readonly candidateKind: CandidateKind;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly sourceClusterIds: readonly string[];
  readonly sourceEpisodeIds: readonly string[];
  readonly sourceEvidenceIds: readonly string[];
  readonly representation: JsonValue;
  readonly applicabilityConditions: readonly JsonObject[];
  readonly exclusionConditions: readonly JsonObject[];
  readonly expectedEffects?: readonly JsonObject[];
  readonly knownFailureModes: readonly string[];
  readonly confidenceBasisPoints: number;
  readonly uncertainty: ConsolidationUncertainty;
  readonly extractionMethodId: string;
  readonly extractionMethodVersion: string;
  readonly versionBoundaries: readonly JsonObject[];
  readonly supportingReferences: readonly string[];
  readonly contradictionReferences: readonly string[];
  readonly counterexampleReferences: readonly string[];
  readonly unseenEvaluationReferences: readonly string[];
  readonly competingExplanationReferences: readonly string[];
  readonly invariantCheckReferences: readonly string[];
  readonly status: CandidateStatus;
  readonly actorId: string;
  readonly recordedAt: string;
}

export interface CandidateAbstraction extends CandidateAbstractionDraft {
  readonly contentDigest: string;
}

export async function createCandidateAbstraction(
  draft: Readonly<CandidateAbstractionDraft>,
): Promise<Readonly<CandidateAbstraction>> {
  for (const [label, value] of [
    ["candidateId", draft.candidateId],
    ["candidateVersion", draft.candidateVersion],
    ["candidateSchemaId", draft.candidateSchemaId],
    ["domainId", draft.domainId],
    ["domainVersion", draft.domainVersion],
    ["extractionMethodId", draft.extractionMethodId],
    ["extractionMethodVersion", draft.extractionMethodVersion],
    ["actorId", draft.actorId],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_abstraction", "abstraction", {
      candidateId: draft.candidateId,
    });
  }
  validateConsolidationTimestamp(draft.recordedAt, "invalid_abstraction", "abstraction", {
    candidateId: draft.candidateId,
  });
  if (
    !Number.isSafeInteger(draft.candidateSchemaVersion) ||
    draft.candidateSchemaVersion < 1 ||
    !Number.isSafeInteger(draft.confidenceBasisPoints) ||
    draft.confidenceBasisPoints < 0 ||
    draft.confidenceBasisPoints > 10_000
  ) {
    failConsolidation(
      "invalid_abstraction",
      "abstraction",
      "Candidate schema or confidence is invalid.",
      {
        candidateId: draft.candidateId,
      },
    );
  }
  if (
    !CANDIDATE_KINDS.includes(draft.candidateKind) ||
    !CANDIDATE_STATUSES.includes(draft.status) ||
    !UNCERTAINTY_CLASSES.includes(draft.uncertainty)
  ) {
    failConsolidation(
      "invalid_abstraction",
      "abstraction",
      "Candidate classification is unsupported.",
      {
        candidateId: draft.candidateId,
      },
    );
  }
  const normalized = canonicalizeJson({
    ...draft,
    sourceClusterIds: [...new Set(draft.sourceClusterIds)].sort(),
    sourceEpisodeIds: [...new Set(draft.sourceEpisodeIds)].sort(),
    sourceEvidenceIds: [...new Set(draft.sourceEvidenceIds)].sort(),
    knownFailureModes: [...new Set(draft.knownFailureModes)].sort(),
    supportingReferences: [...new Set(draft.supportingReferences)].sort(),
    contradictionReferences: [...new Set(draft.contradictionReferences)].sort(),
    counterexampleReferences: [...new Set(draft.counterexampleReferences)].sort(),
    unseenEvaluationReferences: [...new Set(draft.unseenEvaluationReferences)].sort(),
    competingExplanationReferences: [...new Set(draft.competingExplanationReferences)].sort(),
    invariantCheckReferences: [...new Set(draft.invariantCheckReferences)].sort(),
  }) as unknown as Omit<CandidateAbstraction, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonObject) as unknown as Readonly<CandidateAbstraction>;
}

export async function validateCandidateAbstraction(
  candidate: Readonly<CandidateAbstraction>,
): Promise<void> {
  const { contentDigest, ...envelope } = candidate;
  if (!(await verifySha256Hex(canonicalStringify(envelope), contentDigest))) {
    failConsolidation(
      "abstraction_digest_mismatch",
      "abstraction",
      "Candidate digest does not match.",
      {
        candidateId: candidate.candidateId,
      },
    );
  }
}

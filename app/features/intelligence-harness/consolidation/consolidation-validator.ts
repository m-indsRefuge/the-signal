import { deepFreezeJson, type JsonObject } from "../memory-fabric/canonical-json";
import type { CandidateAbstraction } from "./abstraction-contract";
import type { EvidenceMatrix, MatrixEvidenceClass, MatrixOutcome } from "./evidence-matrix";
import { failConsolidation, validateConsolidationIdentity } from "./failures";

export const CONSOLIDATION_VALIDATION_CLASSIFICATIONS = Object.freeze([
  "candidate_validated",
  "candidate_rejected",
  "candidate_quarantined",
  "needs_more_evidence",
] as const);
export type ConsolidationValidationClassification =
  (typeof CONSOLIDATION_VALIDATION_CLASSIFICATIONS)[number];

export interface ConsolidationValidationPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly minimumSupportCardinality: number;
  readonly maximumConfidenceWithoutUnseenEvidence: number;
  readonly requireContradictionResolution: boolean;
  readonly requireVersionBoundaryEvidence: boolean;
  readonly requireReproducibilityEvidence: boolean;
  readonly requireInvariantEvidence: boolean;
  readonly protectedReferenceIds: readonly string[];
}

export interface ConsolidationValidationReport {
  readonly candidateId: string;
  readonly candidateVersion: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly classification: ConsolidationValidationClassification;
  readonly passedConditions: readonly string[];
  readonly failedConditions: readonly string[];
  readonly unknownConditions: readonly string[];
  readonly evidenceCounts: Readonly<Record<MatrixEvidenceClass, number>>;
  readonly outcomeCounts: Readonly<Record<MatrixOutcome, number>>;
}

function countBy<T extends string>(values: readonly T[], allowed: readonly T[]): Record<T, number> {
  const counts = Object.fromEntries(allowed.map((value) => [value, 0])) as Record<T, number>;
  for (const value of values) counts[value] += 1;
  return counts;
}

export function validateConsolidationCandidate(
  candidate: Readonly<CandidateAbstraction>,
  matrix: Readonly<EvidenceMatrix>,
  policy: Readonly<ConsolidationValidationPolicy>,
): Readonly<ConsolidationValidationReport> {
  validateConsolidationIdentity(
    policy.policyId,
    "policyId",
    "invalid_consolidation_request",
    "candidate_validation",
  );
  validateConsolidationIdentity(
    policy.policyVersion,
    "policyVersion",
    "invalid_consolidation_request",
    "candidate_validation",
  );
  if (
    !Number.isSafeInteger(policy.minimumSupportCardinality) ||
    policy.minimumSupportCardinality < 1 ||
    !Number.isSafeInteger(policy.maximumConfidenceWithoutUnseenEvidence) ||
    policy.maximumConfidenceWithoutUnseenEvidence < 0 ||
    policy.maximumConfidenceWithoutUnseenEvidence > 10_000
  ) {
    failConsolidation(
      "invalid_consolidation_request",
      "candidate_validation",
      "Validation policy is invalid.",
    );
  }
  if (
    matrix.candidateId !== candidate.candidateId ||
    matrix.candidateVersion !== candidate.candidateVersion
  ) {
    failConsolidation(
      "invalid_evidence_matrix",
      "candidate_validation",
      "Candidate and matrix lineage differ.",
    );
  }

  const passed: string[] = [];
  const failed: string[] = [];
  const unknown: string[] = [];
  const support = matrix.entries.filter(
    (entry) =>
      entry.evidenceClass === "support" &&
      (entry.outcome === "supports" || entry.outcome === "weakly_supports"),
  );
  const counterexamples = matrix.entries.filter(
    (entry) =>
      entry.evidenceClass === "counterexample" &&
      (entry.outcome === "refutes" || entry.outcome === "weakly_refutes"),
  );
  const contradictions = matrix.entries.filter(
    (entry) =>
      entry.evidenceClass === "contradiction" &&
      entry.outcome !== "not_applicable" &&
      entry.outcome !== "neutral",
  );
  const unseen = matrix.entries.filter((entry) => entry.evidenceClass === "unseen");
  const version = matrix.entries.filter((entry) => entry.evidenceClass === "version_boundary");
  const reproducibility = matrix.entries.filter(
    (entry) => entry.evidenceClass === "reproducibility",
  );
  const invariants = matrix.entries.filter((entry) => entry.evidenceClass === "domain_invariant");
  const unknownEntries = matrix.entries.filter((entry) => entry.outcome === "unknown");

  if (support.length >= policy.minimumSupportCardinality) passed.push("minimum_support");
  else failed.push("minimum_support");
  if (counterexamples.length === 0) passed.push("no_refuting_counterexample");
  else failed.push("counterexample_present");
  if (!policy.requireContradictionResolution || contradictions.length === 0) {
    passed.push("contradictions_resolved");
  } else {
    failed.push("unresolved_contradiction");
  }
  if (
    !policy.requireVersionBoundaryEvidence ||
    version.some((entry) => entry.outcome === "supports")
  ) {
    passed.push("version_boundary");
  } else if (version.length === 0) {
    unknown.push("version_boundary");
  } else failed.push("version_boundary");
  if (
    !policy.requireReproducibilityEvidence ||
    reproducibility.some((entry) => entry.outcome === "supports")
  ) {
    passed.push("reproducibility");
  } else if (reproducibility.length === 0) {
    unknown.push("reproducibility");
  } else failed.push("reproducibility");
  if (
    !policy.requireInvariantEvidence ||
    invariants.every((entry) => entry.outcome !== "refutes" && entry.outcome !== "weakly_refutes")
  ) {
    passed.push("domain_invariants");
  } else failed.push("domain_invariant");
  if (
    unseen.length > 0 ||
    candidate.confidenceBasisPoints <= policy.maximumConfidenceWithoutUnseenEvidence
  )
    passed.push("supported_confidence");
  else failed.push("unsupported_confidence");
  if (candidate.sourceEpisodeIds.length >= support.length)
    passed.push("scope_not_broader_than_sources");
  else failed.push("candidate_scope");
  const matrixRefs = new Set(matrix.entries.map((entry) => entry.referenceId));
  if (policy.protectedReferenceIds.every((reference) => matrixRefs.has(reference))) {
    passed.push("protected_references_present");
  } else failed.push("protected_evidence_missing");
  if (unknownEntries.length > 0) unknown.push("unknown_evidence");

  let classification: ConsolidationValidationClassification;
  if (failed.includes("counterexample_present") || failed.includes("candidate_scope")) {
    classification = "candidate_rejected";
  } else if (failed.length > 0) {
    classification = "candidate_quarantined";
  } else if (unknown.length > 0 || unseen.length === 0) {
    classification = "needs_more_evidence";
  } else {
    classification = "candidate_validated";
  }

  return deepFreezeJson({
    candidateId: candidate.candidateId,
    candidateVersion: candidate.candidateVersion,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    classification,
    passedConditions: passed.sort(),
    failedConditions: failed.sort(),
    unknownConditions: unknown.sort(),
    evidenceCounts: countBy(
      matrix.entries.map((entry) => entry.evidenceClass),
      [
        "support",
        "contradiction",
        "counterexample",
        "unseen",
        "competing_explanation",
        "domain_invariant",
        "version_boundary",
        "reproducibility",
      ],
    ),
    outcomeCounts: countBy(
      matrix.entries.map((entry) => entry.outcome),
      [
        "supports",
        "weakly_supports",
        "neutral",
        "weakly_refutes",
        "refutes",
        "unknown",
        "not_applicable",
      ],
    ),
  } as unknown as JsonObject) as unknown as Readonly<ConsolidationValidationReport>;
}

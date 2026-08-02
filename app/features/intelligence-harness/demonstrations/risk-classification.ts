import { EVIDENCE_RISK_LABELS, type EvidenceRiskLabel } from "./demonstration-contract";
import { freezeDeep } from "./evidence-digest";

export interface EvidenceRiskFacts {
  readonly validatorRejected: boolean;
  readonly blockingPlannerRisk: boolean;
  readonly lineageMismatch: boolean;
  readonly digestMismatch: boolean;
  readonly versionMismatch: boolean;
  readonly reconstructable: boolean | null;
  readonly truncated: boolean;
  readonly duplicate: boolean;
  readonly conflictingDuplicate: boolean;
  readonly reviewRequired: boolean;
}

export function deriveEvidenceRiskLabels(facts: EvidenceRiskFacts): readonly EvidenceRiskLabel[] {
  const labels: EvidenceRiskLabel[] = [];
  if (facts.validatorRejected) labels.push("validator_rejected");
  if (facts.blockingPlannerRisk) labels.push("blocking_planner_risk");
  if (facts.lineageMismatch) labels.push("lineage_mismatch");
  if (facts.digestMismatch) labels.push("digest_mismatch");
  if (facts.versionMismatch) labels.push("version_mismatch");
  if (facts.reconstructable === false) labels.push("unreconstructable");
  if (facts.truncated) labels.push("budget_truncated");
  if (facts.duplicate) labels.push("duplicate");
  if (facts.conflictingDuplicate) labels.push("conflicting_duplicate");
  if (facts.reviewRequired) labels.push("review_required");
  if (labels.length === 0) labels.push("none_observed");
  const canonical = [...new Set(labels)]
    .filter((label) => EVIDENCE_RISK_LABELS.includes(label))
    .sort();
  return freezeDeep(canonical);
}

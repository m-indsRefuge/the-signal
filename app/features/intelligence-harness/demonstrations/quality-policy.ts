import { QUALITY_LABELS, type QualityLabel } from "./demonstration-contract";
import { freezeDeep } from "./evidence-digest";

export interface QualityFacts {
  readonly schemaComplete: boolean;
  readonly lineageComplete: boolean;
  readonly legalActionSetBound: boolean;
  readonly plannerResultBound: boolean;
  readonly proposalProjectionBound: boolean;
  readonly validatorResultBound: boolean;
  readonly reconstructable: boolean | null;
  readonly truncated: boolean;
  readonly humanReviewPresent: boolean;
  readonly outcomeEvidencePresent: boolean;
}

export function deriveQualityLabels(facts: QualityFacts): readonly QualityLabel[] {
  const labels: QualityLabel[] = [];
  if (facts.schemaComplete) labels.push("schema_complete");
  if (facts.lineageComplete) labels.push("lineage_complete");
  if (facts.legalActionSetBound) labels.push("legal_action_set_bound");
  if (facts.plannerResultBound) labels.push("planner_result_bound");
  if (facts.proposalProjectionBound) labels.push("proposal_projection_bound");
  if (facts.validatorResultBound) labels.push("validator_result_bound");
  if (facts.reconstructable === true) labels.push("deterministically_reconstructable");
  if (facts.truncated) labels.push("bounded_with_declared_truncation");
  else labels.push("bounded_without_truncation");
  if (!facts.humanReviewPresent) labels.push("human_review_missing");
  if (!facts.outcomeEvidencePresent) labels.push("outcome_evidence_missing");
  if (labels.length === 0) labels.push("quality_unknown");
  const canonical = [...new Set(labels)].filter((label) => QUALITY_LABELS.includes(label)).sort();
  return freezeDeep(canonical);
}

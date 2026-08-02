import {
  DEMONSTRATION_MAXIMA,
  type DemonstrationOutcome,
  type EvidenceRiskLabel,
  type QualityLabel,
} from "./demonstration-contract";
import { evidenceDigest, freezeDeep, serializedCharacters } from "./evidence-digest";
import type { DemonstrationEvidenceInput } from "./evidence-input";
import { failDemonstration } from "./failures";

export interface DemonstrationEvidenceRecord extends DemonstrationEvidenceInput {
  readonly qualityLabels: readonly QualityLabel[];
  readonly riskLabels: readonly EvidenceRiskLabel[];
  readonly quarantineState: "quarantined";
  readonly trainingAdmission: "not_evaluated";
  readonly exportAuthorization: "absent";
  readonly actionExecuted: false;
  readonly recordDigest: string;
}

export function createDemonstrationEvidenceRecord(
  input: DemonstrationEvidenceInput,
  qualityLabels: readonly QualityLabel[],
  riskLabels: readonly EvidenceRiskLabel[],
): DemonstrationEvidenceRecord {
  validateOutcomeShape(input.outcome, input);
  if (qualityLabels.length > DEMONSTRATION_MAXIMA.qualityLabels) {
    return failDemonstration("record_budget_exceeded", "Quality labels exceed their budget.");
  }
  if (riskLabels.length > DEMONSTRATION_MAXIMA.evidenceRiskLabels) {
    return failDemonstration("record_budget_exceeded", "Risk labels exceed their budget.");
  }
  const body = freezeDeep({
    ...input,
    qualityLabels: Object.freeze([...new Set(qualityLabels)].sort()),
    riskLabels: Object.freeze([...new Set(riskLabels)].sort()),
    quarantineState: "quarantined" as const,
    trainingAdmission: "not_evaluated" as const,
    exportAuthorization: "absent" as const,
    actionExecuted: false as const,
  });
  const record = freezeDeep({ ...body, recordDigest: evidenceDigest(body) });
  if (serializedCharacters(record) > DEMONSTRATION_MAXIMA.evidenceRecordCharacters) {
    return failDemonstration("serialized_size_exceeded", "Evidence record exceeds size budget.");
  }
  return record;
}

function validateOutcomeShape(
  outcome: DemonstrationOutcome,
  input: DemonstrationEvidenceInput,
): void {
  if (outcome === "proposal_accepted" || outcome === "proposal_rejected") {
    if (input.selectedPlan === null || input.proposal === null || input.validator === null) {
      return failDemonstration(
        "proposal_projection_mismatch",
        "Proposal outcomes require plan, proposal, and validator evidence.",
      );
    }
    if (input.proposal.proposalDigest !== input.validator.proposalDigest) {
      return failDemonstration(
        "validator_result_mismatch",
        "Validator evidence does not bind the projected proposal.",
      );
    }
    if (outcome === "proposal_accepted" && input.validator.decision !== "accepted") {
      return failDemonstration("validator_result_mismatch", "Accepted outcome lacks acceptance.");
    }
    if (outcome === "proposal_rejected" && input.validator.decision !== "rejected") {
      return failDemonstration("validator_result_mismatch", "Rejected outcome lacks rejection.");
    }
  } else if (input.proposal !== null || input.validator !== null) {
    return failDemonstration(
      "proposal_projection_mismatch",
      "Non-proposal outcomes must not fabricate proposal evidence.",
    );
  }
}

export function verifyEvidenceRecordDigest(record: DemonstrationEvidenceRecord): boolean {
  const { recordDigest, ...body } = record;
  return evidenceDigest(body) === recordDigest;
}

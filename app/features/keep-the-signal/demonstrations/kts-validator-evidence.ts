import { stableDigest } from "../../intelligence-harness/planning";
import {
  createProposalEvidence,
  createValidatorEvidence,
  type ProposalEvidence,
  type ValidatorEvidence,
} from "../../intelligence-harness/demonstrations";
import type { KtsPlanningProposalCandidate } from "../planning";

export interface KtsProposalValidationReport {
  readonly classification: "schema_valid" | "advisory_valid" | "advisory_rejected" | "abstained";
  readonly issues: readonly Readonly<{
    readonly code: string;
    readonly message: string;
  }>[];
}

export function createKtsProposalEvidence(
  proposal: KtsPlanningProposalCandidate,
): ProposalEvidence {
  return createProposalEvidence({
    proposalSchemaId: "kts-planning-proposal-candidate",
    proposalSchemaVersion: "1",
    sourcePlannerResultDigest: proposal.sourceResultDigest,
    primaryActionId: proposal.primaryActionId,
    orderedActionIds: proposal.actionSequence,
    utility: proposal.utility,
    confidence: proposal.confidence,
    canonicalContentDigest: stableDigest({
      primaryActionId: proposal.primaryActionId,
      actionSequence: proposal.actionSequence,
      utility: proposal.utility,
      confidence: proposal.confidence,
    }),
    proposalDigest: proposal.proposalDigest,
  });
}

export function createKtsValidatorEvidence(
  proposal: KtsPlanningProposalCandidate,
  report: KtsProposalValidationReport,
): ValidatorEvidence {
  const reasons = report.issues.map((issue) => `${issue.code}:${issue.message}`).sort();
  const unsupportedReferences = report.issues
    .filter((issue) => issue.code.includes("reference"))
    .map((issue) => issue.code)
    .sort();
  const legalityFindings = report.issues
    .filter((issue) => issue.code.includes("target") || issue.code.includes("ready"))
    .map((issue) => issue.code)
    .sort();
  const riskFindings = report.issues
    .filter((issue) => issue.code.includes("grounded") || issue.code.includes("uncertain"))
    .map((issue) => issue.code)
    .sort();
  const decision =
    report.classification === "advisory_valid"
      ? "accepted"
      : report.classification === "abstained"
        ? "abstained"
        : "rejected";
  const resultDigest = stableDigest({
    proposalDigest: proposal.proposalDigest,
    classification: report.classification,
    issues: report.issues,
  });
  return createValidatorEvidence({
    validatorId: "kts-deterministic-proposal-validator",
    validatorVersion: "1",
    proposalDigest: proposal.proposalDigest,
    decision,
    reasons,
    unsupportedReferences,
    legalityFindings,
    riskFindings,
    validatorResultDigest: resultDigest,
  });
}

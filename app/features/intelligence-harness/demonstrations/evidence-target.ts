import type { PlannerResultStatus, SearchBudget } from "../planning";
import {
  DEMONSTRATION_MAXIMA,
  requireBoundedStringSequence,
  requireBoundedStrings,
  requireDigest,
  requireIdentity,
} from "./demonstration-contract";
import { evidenceDigest, freezeDeep } from "./evidence-digest";
import { failDemonstration } from "./failures";

export interface EvidenceScoreComponent {
  readonly metric: string;
  readonly normalizedValue: number;
  readonly weight: number;
  readonly contribution: number;
}

export interface SelectedPlanEvidenceInput {
  readonly planId: string;
  readonly planDigest: string;
  readonly rank: number;
  readonly totalScore: number;
  readonly riskPenalty: number;
  readonly blocked: boolean;
  readonly orderedActionIds: readonly string[];
  readonly lineageCandidateIds: readonly string[];
  readonly sourceStateDigest: string;
  readonly resultStateDigest: string;
  readonly simulationResultDigests: readonly string[];
  readonly scoreComponents: readonly EvidenceScoreComponent[];
  readonly riskFlags: readonly string[];
  readonly explanationReferences: readonly string[];
  readonly terminalClassification: string;
  readonly futureOptionValue: number | null;
  readonly tieBreakValues: readonly number[];
  readonly truncated: boolean;
}

export interface SelectedPlanEvidence extends SelectedPlanEvidenceInput {
  readonly selectedPlanEvidenceDigest: string;
}

export function createSelectedPlanEvidence(input: SelectedPlanEvidenceInput): SelectedPlanEvidence {
  if (
    !Number.isSafeInteger(input.rank) ||
    input.rank <= 0 ||
    !Number.isFinite(input.totalScore) ||
    !Number.isFinite(input.riskPenalty) ||
    input.riskPenalty < 0 ||
    (input.futureOptionValue !== null && !Number.isFinite(input.futureOptionValue)) ||
    input.tieBreakValues.some((value) => !Number.isFinite(value))
  ) {
    return failDemonstration("invalid_schema", "Selected-plan scalar values are invalid.");
  }
  if (input.orderedActionIds.length > DEMONSTRATION_MAXIMA.selectedPlanActions) {
    return failDemonstration("record_budget_exceeded", "Selected plan exceeds the action budget.");
  }
  if (input.scoreComponents.length > DEMONSTRATION_MAXIMA.scoreComponents) {
    return failDemonstration(
      "record_budget_exceeded",
      "Selected plan exceeds score-component budget.",
    );
  }
  const body = freezeDeep({
    planId: requireIdentity(input.planId, "planId"),
    planDigest: requireDigest(input.planDigest, "planDigest"),
    rank: input.rank,
    totalScore: input.totalScore,
    riskPenalty: input.riskPenalty,
    blocked: input.blocked,
    orderedActionIds: requireBoundedStringSequence(
      input.orderedActionIds,
      DEMONSTRATION_MAXIMA.selectedPlanActions,
      "orderedActionIds",
    ),
    lineageCandidateIds: requireBoundedStringSequence(
      input.lineageCandidateIds,
      DEMONSTRATION_MAXIMA.sourceLineageReferences,
      "lineageCandidateIds",
    ),
    sourceStateDigest: requireDigest(input.sourceStateDigest, "sourceStateDigest"),
    resultStateDigest: requireDigest(input.resultStateDigest, "resultStateDigest"),
    simulationResultDigests: Object.freeze(
      input.simulationResultDigests.map((digest) =>
        requireDigest(digest, "simulationResultDigest"),
      ),
    ),
    scoreComponents: Object.freeze(
      input.scoreComponents.map((component) => {
        if (
          !component.metric.trim() ||
          !Number.isFinite(component.normalizedValue) ||
          !Number.isFinite(component.weight) ||
          !Number.isFinite(component.contribution)
        ) {
          return failDemonstration("invalid_schema", "Score component is invalid.");
        }
        return freezeDeep({ ...component, metric: component.metric.trim() });
      }),
    ),
    riskFlags: requireBoundedStrings(input.riskFlags, DEMONSTRATION_MAXIMA.riskFlags, "riskFlags"),
    explanationReferences: requireBoundedStringSequence(
      input.explanationReferences,
      DEMONSTRATION_MAXIMA.explanationReferences,
      "explanationReferences",
    ),
    terminalClassification: requireIdentity(input.terminalClassification, "terminalClassification"),
    futureOptionValue: input.futureOptionValue,
    tieBreakValues: Object.freeze([...input.tieBreakValues]),
    truncated: input.truncated,
  });
  return freezeDeep({ ...body, selectedPlanEvidenceDigest: evidenceDigest(body) });
}

export interface ProposalEvidenceInput {
  readonly proposalSchemaId: string;
  readonly proposalSchemaVersion: string;
  readonly sourcePlannerResultDigest: string;
  readonly primaryActionId: string;
  readonly orderedActionIds: readonly string[];
  readonly utility: number;
  readonly confidence: number;
  readonly canonicalContentDigest: string;
  readonly proposalDigest: string;
}

export interface ProposalEvidence extends ProposalEvidenceInput {
  readonly requiresProposalValidation: true;
  readonly actionExecuted: false;
  readonly proposalEvidenceDigest: string;
}

export function createProposalEvidence(input: ProposalEvidenceInput): ProposalEvidence {
  if (!Number.isFinite(input.utility) || !Number.isFinite(input.confidence)) {
    return failDemonstration("invalid_schema", "Proposal utility and confidence must be finite.");
  }
  const body = freezeDeep({
    proposalSchemaId: requireIdentity(input.proposalSchemaId, "proposalSchemaId"),
    proposalSchemaVersion: requireIdentity(input.proposalSchemaVersion, "proposalSchemaVersion"),
    sourcePlannerResultDigest: requireDigest(
      input.sourcePlannerResultDigest,
      "sourcePlannerResultDigest",
    ),
    primaryActionId: requireIdentity(input.primaryActionId, "primaryActionId"),
    orderedActionIds: requireBoundedStringSequence(
      input.orderedActionIds,
      DEMONSTRATION_MAXIMA.selectedPlanActions,
      "proposalActionIds",
    ),
    utility: input.utility,
    confidence: input.confidence,
    canonicalContentDigest: requireDigest(input.canonicalContentDigest, "canonicalContentDigest"),
    proposalDigest: requireDigest(input.proposalDigest, "proposalDigest"),
    requiresProposalValidation: true as const,
    actionExecuted: false as const,
  });
  return freezeDeep({ ...body, proposalEvidenceDigest: evidenceDigest(body) });
}

export interface ValidatorEvidenceInput {
  readonly validatorId: string;
  readonly validatorVersion: string;
  readonly proposalDigest: string;
  readonly decision: "accepted" | "rejected" | "abstained";
  readonly reasons: readonly string[];
  readonly unsupportedReferences: readonly string[];
  readonly legalityFindings: readonly string[];
  readonly riskFindings: readonly string[];
  readonly validatorResultDigest: string;
}

export interface ValidatorEvidence extends ValidatorEvidenceInput {
  readonly actionExecuted: false;
  readonly validatorEvidenceDigest: string;
}

export function createValidatorEvidence(input: ValidatorEvidenceInput): ValidatorEvidence {
  const body = freezeDeep({
    validatorId: requireIdentity(input.validatorId, "validatorId"),
    validatorVersion: requireIdentity(input.validatorVersion, "validatorVersion"),
    proposalDigest: requireDigest(input.proposalDigest, "validatorProposalDigest"),
    decision: input.decision,
    reasons: requireBoundedStringSequence(
      input.reasons,
      DEMONSTRATION_MAXIMA.validatorReasons,
      "validatorReasons",
    ),
    unsupportedReferences: requireBoundedStringSequence(
      input.unsupportedReferences,
      DEMONSTRATION_MAXIMA.unsupportedReferences,
      "unsupportedReferences",
    ),
    legalityFindings: requireBoundedStringSequence(
      input.legalityFindings,
      DEMONSTRATION_MAXIMA.validatorReasons,
      "legalityFindings",
    ),
    riskFindings: requireBoundedStringSequence(
      input.riskFindings,
      DEMONSTRATION_MAXIMA.validatorReasons,
      "riskFindings",
    ),
    validatorResultDigest: requireDigest(input.validatorResultDigest, "validatorResultDigest"),
    actionExecuted: false as const,
  });
  return freezeDeep({ ...body, validatorEvidenceDigest: evidenceDigest(body) });
}

export interface PlannerExecutionEvidence {
  readonly plannerStatus: PlannerResultStatus;
  readonly plannerBudget: SearchBudget;
  readonly candidateExpansions: number;
  readonly simulationCalls: number;
  readonly retainedCandidates: number;
}

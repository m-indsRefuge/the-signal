import { stableDigest } from "./candidate-digest";
import { fail } from "./failures";
import type { LegalAction } from "./legal-action-port";
import type { RiskAssessment } from "./risk-policy";
import type { ScoreBreakdown } from "./score-contract";
import type { SimulatedState } from "./simulation-port";

export interface PlanningCandidate {
  readonly candidateId: string;
  readonly parentCandidateId: string | null;
  readonly rootRequestId: string;
  readonly depth: number;
  readonly actionSequence: readonly LegalAction[];
  readonly lineageCandidateIds: readonly string[];
  readonly actionSequenceDigest: string;
  readonly sourceStateDigest: string;
  readonly resultState: SimulatedState;
  readonly score: ScoreBreakdown;
  readonly risk: RiskAssessment;
  readonly terminal: boolean;
  readonly expansionOrdinal: number;
  readonly evidenceDigest: string;
  readonly candidateDigest: string;
}

export type CandidateInput = Omit<
  PlanningCandidate,
  "candidateId" | "actionSequenceDigest" | "candidateDigest"
>;

export function createCandidate(input: CandidateInput): PlanningCandidate {
  if (
    !input.rootRequestId ||
    !input.sourceStateDigest ||
    !input.evidenceDigest ||
    !Number.isSafeInteger(input.depth) ||
    input.depth < 0 ||
    !Number.isSafeInteger(input.expansionOrdinal) ||
    input.expansionOrdinal < 0
  ) {
    return fail("invalid_candidate", "Candidate identity or ordinal is invalid.");
  }
  if (input.depth !== input.actionSequence.length) {
    return fail("candidate_lineage_incomplete", "Candidate depth does not match action lineage.");
  }
  const actionSequence = Object.freeze(
    input.actionSequence.map((action) => Object.freeze({ ...action })),
  );
  const actionSequenceDigest = stableDigest(actionSequence.map((action) => action.actionId));
  const candidateId = stableDigest({
    rootRequestId: input.rootRequestId,
    parentCandidateId: input.parentCandidateId,
    lineageCandidateIds: input.lineageCandidateIds,
    depth: input.depth,
    actionSequenceDigest,
    resultStateDigest: input.resultState.stateDigest,
    expansionOrdinal: input.expansionOrdinal,
  });
  if (
    input.parentCandidateId === null
      ? input.lineageCandidateIds.length !== 0
      : input.lineageCandidateIds.at(-1) !== input.parentCandidateId
  ) {
    return fail(
      "candidate_lineage_incomplete",
      "Candidate lineage does not terminate at its parent.",
    );
  }
  const lineageCandidateIds = Object.freeze([...input.lineageCandidateIds]);
  const body = {
    ...input,
    actionSequence,
    lineageCandidateIds,
    actionSequenceDigest,
    candidateId,
  };
  return Object.freeze({
    ...body,
    candidateDigest: stableDigest(body),
  });
}

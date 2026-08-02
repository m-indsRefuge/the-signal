import { stableDigest } from "./candidate-digest";
import { fail } from "./failures";
import type { PlannerIdentity } from "./planner-contract";
import { createSearchBudget, type SearchBudget } from "./search-budget";
import type { RiskPolicy } from "./risk-policy";
import type { ScorePolicy } from "./score-policy";
import type { SimulatedState } from "./simulation-port";

export interface PlanningRequestInput {
  readonly requestId: string;
  readonly planner: PlannerIdentity;
  readonly observationSchemaVersion: string;
  readonly legalActionSchemaVersion: string;
  readonly simulatorVersion: string;
  readonly scoringPolicy: ScorePolicy;
  readonly riskPolicy: RiskPolicy;
  readonly initialState: SimulatedState;
  readonly budget: SearchBudget;
  readonly abstentionThreshold: number;
  readonly tieBreakPolicyVersion: string;
  readonly seedIdentity: string;
  readonly cancelled: boolean;
}

export interface PlanningRequest extends PlanningRequestInput {
  readonly budget: SearchBudget;
  readonly requestDigest: string;
}

export function createPlanningRequest(input: PlanningRequestInput): PlanningRequest {
  if (
    !input.requestId.trim() ||
    !input.observationSchemaVersion.trim() ||
    !input.legalActionSchemaVersion.trim() ||
    !input.simulatorVersion.trim() ||
    !input.tieBreakPolicyVersion.trim() ||
    !input.seedIdentity.trim()
  ) {
    return fail("invalid_planning_request", "Planning-request identity is incomplete.");
  }
  if (!Number.isFinite(input.abstentionThreshold)) {
    return fail("invalid_planning_request", "Abstention threshold must be finite.");
  }
  if (input.initialState.simulatorVersion !== input.simulatorVersion) {
    return fail("version_mismatch", "Initial-state simulator version does not match the request.");
  }
  const budget = createSearchBudget(input.budget);
  const body = {
    ...input,
    requestId: input.requestId.trim(),
    budget,
  };
  return Object.freeze({
    ...body,
    requestDigest: stableDigest(body),
  });
}

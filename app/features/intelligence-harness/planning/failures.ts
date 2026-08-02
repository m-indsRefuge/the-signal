export const PLANNING_FAILURE_CODES = [
  "invalid_planning_request",
  "invalid_planner_identity",
  "invalid_observation",
  "unsupported_observation_version",
  "invalid_legal_action_set",
  "illegal_action_candidate",
  "invalid_simulator",
  "unsupported_simulator_version",
  "simulation_failed",
  "simulation_digest_mismatch",
  "invalid_scoring_policy",
  "invalid_scoring_weight",
  "non_finite_score",
  "invalid_search_budget",
  "search_budget_exceeded",
  "candidate_limit_exceeded",
  "simulation_limit_exceeded",
  "invalid_candidate",
  "candidate_lineage_incomplete",
  "candidate_digest_mismatch",
  "invalid_plan",
  "plan_digest_mismatch",
  "no_legal_actions",
  "all_candidates_blocked",
  "abstention_threshold_not_met",
  "search_cancelled",
  "search_failed",
  "version_mismatch",
  "proposal_validation_required",
  "execution_not_authorized",
  "training_data_generation_not_authorized",
  "controller_disposed",
  "controller_internal_failure",
] as const;

export type PlanningFailureCode = (typeof PLANNING_FAILURE_CODES)[number];

export class PlanningFailure extends Error {
  readonly code: PlanningFailureCode;
  readonly details: Readonly<Record<string, string | number | boolean>>;

  constructor(
    code: PlanningFailureCode,
    message: string,
    details: Readonly<Record<string, string | number | boolean>> = {},
  ) {
    super(message);
    this.name = "PlanningFailure";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export function fail(
  code: PlanningFailureCode,
  message: string,
  details: Readonly<Record<string, string | number | boolean>> = {},
): never {
  throw new PlanningFailure(code, message, details);
}

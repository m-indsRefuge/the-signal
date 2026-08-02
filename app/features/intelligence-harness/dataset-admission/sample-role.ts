import type { EvidenceOutcome } from "./admission-request";
import { fail } from "./failures";

export type SampleRole =
  | "accepted_demonstration"
  | "rejected_proposal"
  | "planner_abstention"
  | "planner_budget_exhaustion"
  | "planner_cancellation"
  | "planner_rejection"
  | "planner_failure";

const ROLE_BY_OUTCOME: Readonly<Record<EvidenceOutcome, SampleRole>> = Object.freeze({
  proposal_accepted: "accepted_demonstration",
  proposal_rejected: "rejected_proposal",
  planner_abstained: "planner_abstention",
  planner_budget_exhausted: "planner_budget_exhaustion",
  planner_cancelled: "planner_cancellation",
  planner_rejected: "planner_rejection",
  planner_failed: "planner_failure",
});

export function classifySampleRole(outcome: EvidenceOutcome): SampleRole {
  const role = ROLE_BY_OUTCOME[outcome];
  if (!role) {
    fail("indeterminate_sample_role", "unsupported evidence outcome");
  }
  return role;
}

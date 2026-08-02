import {
  createTrainingPlan,
  type TrainingPlanDraft,
} from "../../intelligence-harness/fine-tuning/training-plan";
export const KTS_FINE_TUNING_TASKS = Object.freeze([
  "tactical_proposal_schema_compliance",
  "legal_proposal_classification",
  "grounded_tactical_proposal",
  "uncertainty_safe_abstention",
  "deterministic_strategy_selection",
  "correction_and_failure_recovery",
  "proposal_preference",
  "outcome_sensitive_comparison",
] as const);
export function createKtsTrainingPlan(draft: Readonly<TrainingPlanDraft>) {
  return createTrainingPlan(draft);
}

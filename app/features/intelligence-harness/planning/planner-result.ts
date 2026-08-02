import { stableDigest } from "./candidate-digest";
import type { PlannerResultStatus } from "./planner-contract";
import type { RankedPlan } from "./plan-contract";
import type { PlannerMetrics } from "./planner-metrics";
import type { SearchBudget } from "./search-budget";

export interface PlannerResult {
  readonly requestId: string;
  readonly requestDigest: string;
  readonly plannerId: string;
  readonly plannerVersion: string;
  readonly simulatorVersion: string;
  readonly scoringPolicyVersion: string;
  readonly tieBreakPolicyVersion: string;
  readonly status: PlannerResultStatus;
  readonly rankedPlans: readonly RankedPlan[];
  readonly selectedPlan: RankedPlan | null;
  readonly metrics: PlannerMetrics;
  readonly budget: SearchBudget;
  readonly budgetConsumption: Readonly<{
    candidateExpansions: number;
    simulationCalls: number;
    retainedCandidates: number;
  }>;
  readonly limitations: readonly string[];
  readonly noExecution: true;
  readonly resultDigest: string;
}

export function createPlannerResult(
  input: Omit<PlannerResult, "noExecution" | "resultDigest">,
): PlannerResult {
  const body = {
    ...input,
    rankedPlans: Object.freeze([...input.rankedPlans]),
    budget: Object.freeze({ ...input.budget }),
    budgetConsumption: Object.freeze({ ...input.budgetConsumption }),
    limitations: Object.freeze([...input.limitations]),
    noExecution: true as const,
  };
  return Object.freeze({ ...body, resultDigest: stableDigest(body) });
}

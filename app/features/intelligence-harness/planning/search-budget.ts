import { fail } from "./failures";
import { PLANNER_MAXIMA } from "./planner-contract";

export interface SearchBudget {
  readonly maximumPlanningDepth: number;
  readonly beamWidth: number;
  readonly maximumCandidateExpansions: number;
  readonly maximumSimulationCalls: number;
  readonly maximumRetainedCandidates: number;
  readonly maximumReturnedPlans: number;
  readonly maximumExplanationEntries: number;
  readonly maximumCandidateActions: number;
  readonly maximumScoreComponents: number;
  readonly maximumOutputBytes: number;
}

export interface BudgetUsage {
  readonly candidateExpansions: number;
  readonly simulationCalls: number;
  readonly retainedCandidates: number;
}

function boundedInteger(name: string, value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    return fail("invalid_search_budget", `${name} is outside the accepted range.`, {
      value,
      maximum,
    });
  }
  return value;
}

export function createSearchBudget(input: SearchBudget): SearchBudget {
  return Object.freeze({
    maximumPlanningDepth: boundedInteger(
      "maximumPlanningDepth",
      input.maximumPlanningDepth,
      PLANNER_MAXIMA.maximumPlanningDepth,
    ),
    beamWidth: boundedInteger("beamWidth", input.beamWidth, PLANNER_MAXIMA.maximumBeamWidth),
    maximumCandidateExpansions: boundedInteger(
      "maximumCandidateExpansions",
      input.maximumCandidateExpansions,
      PLANNER_MAXIMA.maximumCandidateExpansions,
    ),
    maximumSimulationCalls: boundedInteger(
      "maximumSimulationCalls",
      input.maximumSimulationCalls,
      PLANNER_MAXIMA.maximumSimulationCalls,
    ),
    maximumRetainedCandidates: boundedInteger(
      "maximumRetainedCandidates",
      input.maximumRetainedCandidates,
      PLANNER_MAXIMA.maximumRetainedCandidates,
    ),
    maximumReturnedPlans: boundedInteger(
      "maximumReturnedPlans",
      input.maximumReturnedPlans,
      PLANNER_MAXIMA.maximumReturnedPlans,
    ),
    maximumExplanationEntries: boundedInteger(
      "maximumExplanationEntries",
      input.maximumExplanationEntries,
      PLANNER_MAXIMA.maximumExplanationEntries,
    ),
    maximumCandidateActions: boundedInteger(
      "maximumCandidateActions",
      input.maximumCandidateActions,
      PLANNER_MAXIMA.maximumCandidateActions,
    ),
    maximumScoreComponents: boundedInteger(
      "maximumScoreComponents",
      input.maximumScoreComponents,
      PLANNER_MAXIMA.maximumScoreComponents,
    ),
    maximumOutputBytes: boundedInteger(
      "maximumOutputBytes",
      input.maximumOutputBytes,
      PLANNER_MAXIMA.maximumOutputBytes,
    ),
  });
}

export function initialBudgetUsage(): BudgetUsage {
  return Object.freeze({ candidateExpansions: 0, simulationCalls: 0, retainedCandidates: 0 });
}

export function addBudgetUsage(
  budget: SearchBudget,
  usage: BudgetUsage,
  increments: Partial<BudgetUsage>,
): BudgetUsage {
  const next = Object.freeze({
    candidateExpansions: usage.candidateExpansions + (increments.candidateExpansions ?? 0),
    simulationCalls: usage.simulationCalls + (increments.simulationCalls ?? 0),
    retainedCandidates: usage.retainedCandidates + (increments.retainedCandidates ?? 0),
  });

  if (next.candidateExpansions > budget.maximumCandidateExpansions) {
    return fail("candidate_limit_exceeded", "Candidate expansion budget exceeded.");
  }
  if (next.simulationCalls > budget.maximumSimulationCalls) {
    return fail("simulation_limit_exceeded", "Simulation-call budget exceeded.");
  }
  if (next.retainedCandidates > budget.maximumRetainedCandidates) {
    return fail("candidate_limit_exceeded", "Retained-candidate budget exceeded.");
  }
  return next;
}

export function hasExpansionCapacity(budget: SearchBudget, usage: BudgetUsage): boolean {
  return (
    usage.candidateExpansions < budget.maximumCandidateExpansions &&
    usage.simulationCalls < budget.maximumSimulationCalls
  );
}

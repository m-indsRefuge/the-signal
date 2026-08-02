import { fail } from "./failures";
import type { LegalActionPort } from "./legal-action-port";
import { runBoundedBeamSearch } from "./beam-search";
import type { PlannerResult } from "./planner-result";
import type { PlanningRequest } from "./planning-request";
import type { SimulationPort } from "./simulation-port";

export interface PlannerController {
  plan(request: PlanningRequest): PlannerResult;
  dispose(): void;
  readonly disposed: boolean;
}

export function createPlannerController(
  legalActions: LegalActionPort,
  simulator: SimulationPort,
): PlannerController {
  let isDisposed = false;
  return {
    get disposed() {
      return isDisposed;
    },
    plan(request: PlanningRequest): PlannerResult {
      if (isDisposed) {
        return fail("controller_disposed", "Planner controller has been disposed.");
      }
      return runBoundedBeamSearch(request, { legalActions, simulator });
    },
    dispose(): void {
      isDisposed = true;
    },
  };
}

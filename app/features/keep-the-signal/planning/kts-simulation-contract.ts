import type {
  LegalAction,
  SimulatedState,
  SimulationOutcome,
} from "../../intelligence-harness/planning";

export interface KtsSimulationProjection {
  readonly simulatorVersion: string;
  project(state: SimulatedState, legalAction: LegalAction): SimulationOutcome;
}

export function assertKtsSimulationOutcome(
  source: SimulatedState,
  action: LegalAction,
  outcome: SimulationOutcome,
): SimulationOutcome {
  if (
    outcome.sourceStateDigest !== source.stateDigest ||
    outcome.appliedActionId !== action.actionId ||
    outcome.resultState.simulatorVersion !== source.simulatorVersion
  ) {
    throw new Error("KTS simulation projection violated its immutable contract.");
  }
  return outcome;
}

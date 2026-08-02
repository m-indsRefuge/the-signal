import { stableDigest, type SimulatedState } from "../../intelligence-harness/planning";

export interface KtsPlanningObservationInput {
  readonly observationId: string;
  readonly simulatorVersion: string;
  readonly signal: number;
  readonly defence: number;
  readonly coherence: number;
  readonly threat: number;
  readonly damage: number;
  readonly resource: number;
  readonly recoveryPotential: number;
  readonly waveProgress: number;
  readonly futureOptions: number;
  readonly terminalSurvival: number;
  readonly terminal: boolean;
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function projectKtsPlanningObservation(input: KtsPlanningObservationInput): SimulatedState {
  const metrics = Object.freeze({
    signal: clamp(input.signal),
    defence: clamp(input.defence),
    coherence: clamp(input.coherence),
    threat: clamp(input.threat),
    damage: clamp(input.damage),
    resource: clamp(input.resource),
    recoveryPotential: clamp(input.recoveryPotential),
    waveProgress: clamp(input.waveProgress),
    futureOptions: clamp(input.futureOptions),
    terminalSurvival: clamp(input.terminalSurvival),
  });
  const body = {
    stateId: input.observationId,
    simulatorVersion: input.simulatorVersion,
    terminal: input.terminal,
    metrics,
  };
  return Object.freeze({ ...body, stateDigest: stableDigest(body) });
}

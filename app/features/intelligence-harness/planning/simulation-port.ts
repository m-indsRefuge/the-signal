import type { LegalAction } from "./legal-action-port";

export interface SimulatedMetrics {
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
}

export interface SimulatedState {
  readonly stateId: string;
  readonly stateDigest: string;
  readonly simulatorVersion: string;
  readonly terminal: boolean;
  readonly metrics: SimulatedMetrics;
}

export interface SimulationOutcome {
  readonly sourceStateDigest: string;
  readonly resultState: SimulatedState;
  readonly appliedActionId: string;
  readonly scoreDelta: number;
  readonly signalDelta: number;
  readonly defenceDelta: number;
  readonly coherenceDelta: number;
  readonly threatDelta: number;
  readonly damageDelta: number;
  readonly resourceDelta: number;
  readonly waveProgressDelta: number;
  readonly evidenceDigest: string;
}

export interface SimulationPort {
  readonly simulatorVersion: string;
  simulate(state: SimulatedState, action: LegalAction): SimulationOutcome;
}

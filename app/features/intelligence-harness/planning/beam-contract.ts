import type { PlanningCandidate } from "./candidate-contract";

export interface BeamSnapshot {
  readonly depth: number;
  readonly retained: readonly PlanningCandidate[];
  readonly rejectedCount: number;
  readonly blockedCount: number;
  readonly snapshotDigest: string;
}

import { stableDigest } from "./candidate-digest";

export interface PlannerMetrics {
  readonly depthsVisited: number;
  readonly candidateExpansions: number;
  readonly simulationCalls: number;
  readonly retainedCandidates: number;
  readonly blockedCandidates: number;
  readonly terminalCandidates: number;
  readonly noLegalActionStates: number;
  readonly metricsDigest: string;
}

export function createPlannerMetrics(input: Omit<PlannerMetrics, "metricsDigest">): PlannerMetrics {
  return Object.freeze({ ...input, metricsDigest: stableDigest(input) });
}

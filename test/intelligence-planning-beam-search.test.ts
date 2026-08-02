import { describe, expect, it } from "vitest";
import {
  PLANNER_MAXIMA,
  PLANNING_FAILURE_CODES,
  SCORE_METRICS,
  PLANNER_RESULT_STATUSES,
  PLANNER_EVALUATION_GROUPS,
  PLANNER_EVALUATION_METRICS,
  createPlannerIdentity,
  createSearchBudget,
  createLegalAction,
  createLegalActionSet,
  createScorePolicy,
  createRiskPolicy,
  createPlanningRequest,
  createCandidate,
  createRankedPlan,
  createPlannerResult,
  createPlannerMetrics,
  createPlannerEvaluationObservation,
  compareAgainstRuleBaseline,
  runBoundedBeamSearch,
  createPlannerController,
  stableDigest,
  canonicalize,
  assessRisk,
  evaluateScore,
  compareCandidates,
  type SimulatedState,
  type LegalActionPort,
  type SimulationPort,
} from "../app/features/intelligence-harness/planning";

void [
  PLANNER_MAXIMA,
  PLANNING_FAILURE_CODES,
  SCORE_METRICS,
  PLANNER_RESULT_STATUSES,
  PLANNER_EVALUATION_GROUPS,
  PLANNER_EVALUATION_METRICS,
  createPlannerIdentity,
  createSearchBudget,
  createLegalAction,
  createLegalActionSet,
  createScorePolicy,
  createRiskPolicy,
  createPlanningRequest,
  createCandidate,
  createRankedPlan,
  createPlannerResult,
  createPlannerMetrics,
  createPlannerEvaluationObservation,
  compareAgainstRuleBaseline,
  runBoundedBeamSearch,
  createPlannerController,
  stableDigest,
  canonicalize,
  assessRisk,
  evaluateScore,
  compareCandidates,
];

const defaultWeights = Object.fromEntries(SCORE_METRICS.map((metric) => [metric, 1])) as Record<
  (typeof SCORE_METRICS)[number],
  number
>;
const planner = createPlannerIdentity("planner", "1");
const scorePolicy = createScorePolicy("score", "1", defaultWeights);
const riskPolicy = createRiskPolicy({
  policyId: "risk",
  policyVersion: "1",
  lowSignalThreshold: -0.9,
  defenceCollapseThreshold: -0.9,
  resourceDepletionThreshold: -0.9,
  highDamageThreshold: 0.9,
  lowCoherenceThreshold: -0.9,
  blockingFlags: ["terminal_failure"],
  penaltyPerFlag: 2,
});
function state(id: string, value = 0, terminal = false): SimulatedState {
  const metrics = {
    signal: value,
    defence: value,
    coherence: value,
    threat: -value,
    damage: -value,
    resource: value,
    recoveryPotential: value,
    waveProgress: value,
    futureOptions: value,
    terminalSurvival: terminal ? value : 1,
  };
  const body = { stateId: id, simulatorVersion: "sim-1", terminal, metrics };
  return Object.freeze({ ...body, stateDigest: stableDigest(body) });
}
function budget(overrides = {}) {
  return createSearchBudget({
    maximumPlanningDepth: 3,
    beamWidth: 4,
    maximumCandidateExpansions: 100,
    maximumSimulationCalls: 100,
    maximumRetainedCandidates: 100,
    maximumReturnedPlans: 8,
    maximumExplanationEntries: 256,
    maximumCandidateActions: 16,
    maximumScoreComponents: 16,
    maximumOutputBytes: 100000,
    ...overrides,
  });
}
function request(overrides = {}) {
  return createPlanningRequest({
    requestId: "request",
    planner,
    observationSchemaVersion: "obs-1",
    legalActionSchemaVersion: "actions-1",
    simulatorVersion: "sim-1",
    scoringPolicy: scorePolicy,
    riskPolicy,
    initialState: state("root"),
    budget: budget(),
    abstentionThreshold: -100,
    tieBreakPolicyVersion: "tie-1",
    seedIdentity: "seed-1",
    cancelled: false,
    ...overrides,
  });
}
const legalPort: LegalActionPort = {
  schemaVersion: "actions-1",
  enumerate(current) {
    if (current.terminal) return createLegalActionSet(current.stateDigest, "actions-1", []);
    return createLegalActionSet(current.stateDigest, "actions-1", [
      createLegalAction("advance", "advance", 1, { step: 1 }),
      createLegalAction("guard", "guard", 0, { step: 1 }),
    ]);
  },
};
const simulationPort: SimulationPort = {
  simulatorVersion: "sim-1",
  simulate(current, action) {
    const delta = action.actionId === "advance" ? 0.2 : 0.1;
    const next = state(
      `${current.stateId}-${action.actionId}`,
      Math.min(1, current.metrics.signal + delta),
      current.stateId.split("-").length >= 3,
    );
    return Object.freeze({
      sourceStateDigest: current.stateDigest,
      resultState: next,
      appliedActionId: action.actionId,
      scoreDelta: delta,
      signalDelta: delta,
      defenceDelta: delta,
      coherenceDelta: delta,
      threatDelta: -delta,
      damageDelta: -delta,
      resourceDelta: delta,
      waveProgressDelta: delta,
      evidenceDigest: stableDigest({
        current: current.stateDigest,
        action: action.actionId,
        next: next.stateDigest,
      }),
    });
  },
};

void [planner, scorePolicy, riskPolicy, state, budget, request, legalPort, simulationPort];

describe("KTS-I4-I bounded beam search", () => {
  for (let index = 0; index < 30; index += 1) {
    it(`reconstructs equivalent search ${index}`, () => {
      const currentRequest = request({ requestId: `search-${index}` });
      const left = runBoundedBeamSearch(currentRequest, {
        legalActions: legalPort,
        simulator: simulationPort,
      });
      const right = runBoundedBeamSearch(currentRequest, {
        legalActions: legalPort,
        simulator: simulationPort,
      });
      expect(left.resultDigest).toBe(right.resultDigest);
      expect(left.status).toBe("planned");
    });
  }
  for (const depth of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`respects maximum depth ${depth}`, () => {
      const result = runBoundedBeamSearch(
        request({ requestId: `depth-${depth}`, budget: budget({ maximumPlanningDepth: depth }) }),
        { legalActions: legalPort, simulator: simulationPort },
      );
      expect(result.metrics.depthsVisited).toBeLessThanOrEqual(depth);
    });
  }
  for (const width of [1, 2, 4, 8, 16, 32, 64]) {
    it(`respects beam width ${width}`, () => {
      const result = runBoundedBeamSearch(
        request({ requestId: `width-${width}`, budget: budget({ beamWidth: width }) }),
        { legalActions: legalPort, simulator: simulationPort },
      );
      expect(result.metrics.retainedCandidates).toBeLessThanOrEqual(
        width * result.metrics.depthsVisited,
      );
    });
  }
  for (const limit of [1, 2, 3, 4, 5]) {
    it(`reports expansion budget ${limit}`, () => {
      const result = runBoundedBeamSearch(
        request({
          requestId: `limit-${limit}`,
          budget: budget({ maximumCandidateExpansions: limit, maximumSimulationCalls: limit }),
        }),
        { legalActions: legalPort, simulator: simulationPort },
      );
      expect(result.metrics.candidateExpansions).toBeLessThanOrEqual(limit);
    });
  }
  it("returns cancelled without simulation", () =>
    expect(
      runBoundedBeamSearch(request({ cancelled: true }), {
        legalActions: legalPort,
        simulator: simulationPort,
      }).status,
    ).toBe("cancelled"));
  it("rejects legal-action version mismatch", () =>
    expect(() =>
      runBoundedBeamSearch(request(), {
        legalActions: { ...legalPort, schemaVersion: "other" },
        simulator: simulationPort,
      }),
    ).toThrow());
  it("rejects simulator version mismatch", () =>
    expect(() =>
      runBoundedBeamSearch(request(), {
        legalActions: legalPort,
        simulator: { ...simulationPort, simulatorVersion: "other" },
      }),
    ).toThrow());
  it("abstains when threshold is unreachable", () =>
    expect(
      runBoundedBeamSearch(request({ abstentionThreshold: 1_000_000 }), {
        legalActions: legalPort,
        simulator: simulationPort,
      }).status,
    ).toBe("abstained"));
  it("produces no execution declaration", () =>
    expect(
      runBoundedBeamSearch(request(), { legalActions: legalPort, simulator: simulationPort })
        .noExecution,
    ).toBe(true));
  it("supports ten thousand bounded expansions", () => {
    const largeRequest = request({
      budget: budget({
        maximumPlanningDepth: 8,
        beamWidth: 64,
        maximumCandidateExpansions: 10000,
        maximumSimulationCalls: 10000,
        maximumRetainedCandidates: 10000,
      }),
    });
    const result = runBoundedBeamSearch(largeRequest, {
      legalActions: legalPort,
      simulator: simulationPort,
    });
    expect(result.metrics.candidateExpansions).toBeLessThanOrEqual(10000);
  });
});

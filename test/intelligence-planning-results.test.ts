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

describe("KTS-I4-I planner results", () => {
  for (const status of PLANNER_RESULT_STATUSES) {
    it(`creates result status ${status}`, () => {
      const metrics = createPlannerMetrics({
        depthsVisited: 0,
        candidateExpansions: 0,
        simulationCalls: 0,
        retainedCandidates: 0,
        blockedCandidates: 0,
        terminalCandidates: 0,
        noLegalActionStates: 0,
      });
      const result = createPlannerResult({
        requestId: "r",
        requestDigest: stableDigest("r"),
        plannerId: "p",
        plannerVersion: "1",
        simulatorVersion: "sim-1",
        scoringPolicyVersion: "1",
        tieBreakPolicyVersion: "tie-1",
        status,
        rankedPlans: [],
        selectedPlan: null,
        metrics,
        budget: budget(),
        budgetConsumption: { candidateExpansions: 0, simulationCalls: 0, retainedCandidates: 0 },
        limitations: [],
      });
      expect(result.status).toBe(status);
      expect(result.noExecution).toBe(true);
    });
  }
  for (let index = 0; index < 30; index += 1) {
    it(`creates deterministic metrics ${index}`, () => {
      const input = {
        depthsVisited: index,
        candidateExpansions: index * 2,
        simulationCalls: index * 2,
        retainedCandidates: index,
        blockedCandidates: 0,
        terminalCandidates: 0,
        noLegalActionStates: 0,
      };
      expect(createPlannerMetrics(input).metricsDigest).toBe(
        createPlannerMetrics(input).metricsDigest,
      );
    });
  }
  for (let index = 0; index < 10; index += 1) {
    it(`freezes result ${index}`, () =>
      expect(
        Object.isFrozen(
          runBoundedBeamSearch(request({ requestId: `freeze-${index}` }), {
            legalActions: legalPort,
            simulator: simulationPort,
          }),
        ),
      ).toBe(true));
  }
  it("ranks plans from one", () =>
    expect(
      runBoundedBeamSearch(request(), { legalActions: legalPort, simulator: simulationPort })
        .rankedPlans[0]?.rank,
    ).toBe(1));
  it("preserves request digest", () => {
    const r = request();
    expect(
      runBoundedBeamSearch(r, { legalActions: legalPort, simulator: simulationPort }).requestDigest,
    ).toBe(r.requestDigest);
  });
});

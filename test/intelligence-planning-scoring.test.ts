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

describe("KTS-I4-I explicit scoring", () => {
  for (const metric of SCORE_METRICS) {
    it(`exports score metric ${metric}`, () => expect(metric).toMatch(/^[a-z_]+$/));
  }
  for (let index = -10; index <= 10; index += 1) {
    it(`reconstructs score at normalized value ${index / 10}`, () => {
      const current = state(`score-${index}`, index / 10);
      const risk = assessRisk(riskPolicy, current);
      const score = evaluateScore(scorePolicy, current, risk.penalty);
      const sum = score.components.reduce((total, component) => total + component.contribution, 0);
      expect(score.utilityBeforeRisk).toBeCloseTo(sum);
      expect(score.totalUtility).toBeCloseTo(sum - risk.penalty);
    });
  }
  for (const weight of [-100, -10, 0, 1, 10, 100]) {
    it(`accepts bounded weight ${weight}`, () => {
      const weights = { ...defaultWeights, signal_retention: weight };
      expect(createScorePolicy("score", "1", weights).weights.signal_retention).toBe(weight);
    });
  }
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 101, -101]) {
    it(`rejects invalid weight ${String(bad)}`, () =>
      expect(() =>
        createScorePolicy("score", "1", { ...defaultWeights, signal_retention: bad }),
      ).toThrow());
  }
  for (const value of [-1, -0.9, 0, 0.9, 1]) {
    it(`assesses risk deterministically at ${value}`, () =>
      expect(assessRisk(riskPolicy, state(`risk-${value}`, value))).toEqual(
        assessRisk(riskPolicy, state(`risk-${value}`, value)),
      ));
  }
  it("blocks terminal failure", () =>
    expect(assessRisk(riskPolicy, state("terminal", -1, true)).blocked).toBe(true));
  it("sorts candidates deterministically", () => {
    const result = runBoundedBeamSearch(request(), {
      legalActions: legalPort,
      simulator: simulationPort,
    });
    expect(result.rankedPlans.map((plan) => plan.rank)).toEqual(
      [...result.rankedPlans].map((_, index) => index + 1),
    );
  });
});

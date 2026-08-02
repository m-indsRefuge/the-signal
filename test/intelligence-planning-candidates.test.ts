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

describe("KTS-I4-I planning candidates", () => {
  for (let index = 0; index < 30; index += 1) {
    it(`creates deterministic candidate ${index}`, () => {
      const action = createLegalAction(`action-${index}`, "test", index, { index });
      const resultState = state(`state-${index}`, index / 30);
      const risk = assessRisk(riskPolicy, resultState);
      const score = evaluateScore(scorePolicy, resultState, risk.penalty);
      const input = {
        parentCandidateId: "parent",
        lineageCandidateIds: ["parent"],
        rootRequestId: "root",
        depth: 1,
        actionSequence: [action],
        sourceStateDigest: state("source").stateDigest,
        resultState,
        score,
        risk,
        terminal: false,
        expansionOrdinal: index,
        evidenceDigest: stableDigest({ index }),
      };
      const left = createCandidate(input);
      const right = createCandidate(input);
      expect(left.candidateDigest).toBe(right.candidateDigest);
      expect(left.actionSequenceDigest).toBe(right.actionSequenceDigest);
    });
  }
  it("rejects candidate depth mismatch", () => {
    const s = state("s");
    const risk = assessRisk(riskPolicy, s);
    const score = evaluateScore(scorePolicy, s, 0);
    expect(() =>
      createCandidate({
        parentCandidateId: null,
        lineageCandidateIds: [],
        rootRequestId: "r",
        depth: 1,
        actionSequence: [],
        sourceStateDigest: s.stateDigest,
        resultState: s,
        score,
        risk,
        terminal: false,
        expansionOrdinal: 0,
        evidenceDigest: "e",
      }),
    ).toThrow();
  });
  for (const value of [null, true, false, 0, 1, "text", [1, 2], { b: 2, a: 1 }]) {
    it(`canonicalizes ${JSON.stringify(value)}`, () =>
      expect(canonicalize(value)).toBeTypeOf("string"));
  }
  it("sorts object keys canonically", () =>
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 })));
  it("rejects non-finite canonical numbers", () =>
    expect(() => canonicalize(Number.NaN)).toThrow());
});

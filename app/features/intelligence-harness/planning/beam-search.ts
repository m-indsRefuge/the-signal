import { canonicalize, stableDigest } from "./candidate-digest";
import { createCandidate, type PlanningCandidate } from "./candidate-contract";
import { fail } from "./failures";
import type { LegalActionPort } from "./legal-action-port";
import { createRankedPlan } from "./plan-contract";
import { createPlannerMetrics } from "./planner-metrics";
import { createPlannerResult, type PlannerResult } from "./planner-result";
import type { PlanningRequest } from "./planning-request";
import { assessRisk } from "./risk-policy";
import { evaluateScore } from "./score-policy";
import {
  addBudgetUsage,
  hasExpansionCapacity,
  initialBudgetUsage,
  type BudgetUsage,
} from "./search-budget";
import type { SimulationPort } from "./simulation-port";
import { compareCandidates } from "./tie-break-policy";

export interface BeamSearchDependencies {
  readonly legalActions: LegalActionPort;
  readonly simulator: SimulationPort;
}

export function runBoundedBeamSearch(
  request: PlanningRequest,
  dependencies: BeamSearchDependencies,
): PlannerResult {
  if (request.cancelled) {
    return createPlannerResult({
      requestId: request.requestId,
      requestDigest: request.requestDigest,
      plannerId: request.planner.plannerId,
      plannerVersion: request.planner.plannerVersion,
      simulatorVersion: request.simulatorVersion,
      scoringPolicyVersion: request.scoringPolicy.policyVersion,
      tieBreakPolicyVersion: request.tieBreakPolicyVersion,
      status: "cancelled",
      rankedPlans: [],
      selectedPlan: null,
      metrics: createPlannerMetrics({
        depthsVisited: 0,
        candidateExpansions: 0,
        simulationCalls: 0,
        retainedCandidates: 0,
        blockedCandidates: 0,
        terminalCandidates: 0,
        noLegalActionStates: 0,
      }),
      budget: request.budget,
      budgetConsumption: {
        candidateExpansions: 0,
        simulationCalls: 0,
        retainedCandidates: 0,
      },
      limitations: ["search_cancelled"],
    });
  }
  if (dependencies.legalActions.schemaVersion !== request.legalActionSchemaVersion) {
    return fail("version_mismatch", "Legal-action schema version does not match the request.");
  }
  if (dependencies.simulator.simulatorVersion !== request.simulatorVersion) {
    return fail("unsupported_simulator_version", "Simulator version does not match the request.");
  }

  let usage: BudgetUsage = initialBudgetUsage();
  const accepted: PlanningCandidate[] = [];
  let blockedCandidates = 0;
  let terminalCandidates = 0;
  let noLegalActionStates = 0;
  let depthsVisited = 0;
  let budgetExhausted = false;
  let ordinal = 0;

  const rootActions = Object.freeze([]);
  const rootRisk = assessRisk(request.riskPolicy, request.initialState);
  const rootScore = evaluateScore(request.scoringPolicy, request.initialState, rootRisk.penalty);
  let frontier: PlanningCandidate[] = [
    createCandidate({
      parentCandidateId: null,
      rootRequestId: request.requestId,
      depth: 0,
      actionSequence: rootActions,
      lineageCandidateIds: [],
      sourceStateDigest: request.initialState.stateDigest,
      resultState: request.initialState,
      score: rootScore,
      risk: rootRisk,
      terminal: request.initialState.terminal,
      expansionOrdinal: ordinal,
      evidenceDigest: stableDigest({ root: request.initialState.stateDigest }),
    }),
  ];

  for (let depth = 1; depth <= request.budget.maximumPlanningDepth; depth += 1) {
    depthsVisited = depth;
    const children: PlanningCandidate[] = [];

    for (const parent of [...frontier].sort(compareCandidates)) {
      if (parent.terminal) {
        terminalCandidates += 1;
        accepted.push(parent);
        continue;
      }
      const actionSet = dependencies.legalActions.enumerate(parent.resultState);
      if (actionSet.stateDigest !== parent.resultState.stateDigest) {
        return fail(
          "invalid_legal_action_set",
          "Legal-action state digest does not match candidate state.",
        );
      }
      if (actionSet.actions.length === 0) {
        noLegalActionStates += 1;
        continue;
      }
      if (actionSet.actions.length > request.budget.maximumCandidateActions) {
        return fail("candidate_limit_exceeded", "Legal-action count exceeds the request budget.");
      }

      for (const action of actionSet.actions) {
        if (!hasExpansionCapacity(request.budget, usage)) {
          budgetExhausted = true;
          break;
        }
        usage = addBudgetUsage(request.budget, usage, {
          candidateExpansions: 1,
          simulationCalls: 1,
        });
        const outcome = dependencies.simulator.simulate(parent.resultState, action);
        if (outcome.sourceStateDigest !== parent.resultState.stateDigest) {
          return fail(
            "simulation_digest_mismatch",
            "Simulation source digest does not match candidate state.",
          );
        }
        if (outcome.appliedActionId !== action.actionId) {
          return fail("illegal_action_candidate", "Simulation applied a different action.");
        }
        const deltas = [
          outcome.scoreDelta,
          outcome.signalDelta,
          outcome.defenceDelta,
          outcome.coherenceDelta,
          outcome.threatDelta,
          outcome.damageDelta,
          outcome.resourceDelta,
          outcome.waveProgressDelta,
        ];
        if (deltas.some((value) => !Number.isFinite(value))) {
          return fail("simulation_failed", "Simulation returned a non-finite delta.");
        }
        ordinal += 1;
        const risk = assessRisk(request.riskPolicy, outcome.resultState);
        const score = evaluateScore(request.scoringPolicy, outcome.resultState, risk.penalty);
        const child = createCandidate({
          parentCandidateId: parent.candidateId,
          rootRequestId: request.requestId,
          depth,
          actionSequence: [...parent.actionSequence, action],
          lineageCandidateIds: [...parent.lineageCandidateIds, parent.candidateId],
          sourceStateDigest: parent.resultState.stateDigest,
          resultState: outcome.resultState,
          score,
          risk,
          terminal: outcome.resultState.terminal,
          expansionOrdinal: ordinal,
          evidenceDigest: outcome.evidenceDigest,
        });
        if (risk.blocked) {
          blockedCandidates += 1;
        } else {
          children.push(child);
          accepted.push(child);
        }
      }
      if (budgetExhausted) break;
    }

    if (children.length === 0 || budgetExhausted) break;
    frontier = children.sort(compareCandidates).slice(0, request.budget.beamWidth);
    usage = addBudgetUsage(request.budget, usage, { retainedCandidates: frontier.length });
  }

  const rankedCandidates = accepted
    .filter((candidate) => !candidate.risk.blocked)
    .sort(compareCandidates)
    .slice(0, request.budget.maximumReturnedPlans);
  if (
    rankedCandidates.some(
      (candidate) => candidate.score.components.length > request.budget.maximumScoreComponents,
    )
  ) {
    return fail("search_budget_exceeded", "Score-component budget exceeded.");
  }
  const explanationEntries = rankedCandidates.reduce(
    (total, candidate) => total + candidate.score.components.length,
    0,
  );
  if (explanationEntries > request.budget.maximumExplanationEntries) {
    return fail("search_budget_exceeded", "Explanation-entry budget exceeded.");
  }
  const rankedPlans = rankedCandidates.map((candidate, index) =>
    createRankedPlan(candidate, index + 1),
  );
  const selectedPlan =
    rankedPlans.find((plan) => plan.totalUtility >= request.abstentionThreshold) ?? null;

  let status: PlannerResult["status"];
  const limitations: string[] = [];
  if (budgetExhausted) {
    status = "budget_exhausted";
    limitations.push("search_budget_exhausted");
  } else if (selectedPlan) {
    status = "planned";
  } else {
    status = "abstained";
    limitations.push(
      rankedPlans.length === 0 ? "no_unblocked_candidates" : "abstention_threshold_not_met",
    );
  }

  const result = createPlannerResult({
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    plannerId: request.planner.plannerId,
    plannerVersion: request.planner.plannerVersion,
    simulatorVersion: request.simulatorVersion,
    scoringPolicyVersion: request.scoringPolicy.policyVersion,
    tieBreakPolicyVersion: request.tieBreakPolicyVersion,
    status,
    rankedPlans,
    selectedPlan,
    metrics: createPlannerMetrics({
      depthsVisited,
      candidateExpansions: usage.candidateExpansions,
      simulationCalls: usage.simulationCalls,
      retainedCandidates: usage.retainedCandidates,
      blockedCandidates,
      terminalCandidates,
      noLegalActionStates,
    }),
    budget: request.budget,
    budgetConsumption: {
      candidateExpansions: usage.candidateExpansions,
      simulationCalls: usage.simulationCalls,
      retainedCandidates: usage.retainedCandidates,
    },
    limitations,
  });
  if (canonicalize(result).length > request.budget.maximumOutputBytes) {
    return fail("search_budget_exceeded", "Planner output exceeds the byte budget.");
  }
  return result;
}

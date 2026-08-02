import { describe, expect, it } from "vitest";
import {
  createPlannerController,
  createPlannerIdentity,
  createPlanningRequest,
  createSearchBudget,
  stableDigest,
  type LegalActionPort,
  type PlannerResult,
  type SimulationPort,
} from "../app/features/intelligence-harness/planning";
import {
  createKtsRiskPolicy,
  createKtsScorePolicy,
  projectKtsLegalActions,
  projectKtsPlanningObservation,
  projectKtsPlanningProposal,
} from "../app/features/keep-the-signal/planning";

describe("KTS-I4-I Keep the Signal adapter", () => {
  for (let index = 0; index < 30; index += 1) {
    it(`projects immutable observation ${index}`, () => {
      const observation = projectKtsPlanningObservation({
        observationId: `obs-${index}`,
        simulatorVersion: "sim-1",
        signal: index / 10,
        defence: 0,
        coherence: 0,
        threat: 0,
        damage: 0,
        resource: 0,
        recoveryPotential: 0,
        waveProgress: 0,
        futureOptions: 1,
        terminalSurvival: 1,
        terminal: false,
      });
      expect(observation.metrics.signal).toBeLessThanOrEqual(1);
      expect(Object.isFrozen(observation)).toBe(true);
    });
  }
  for (let index = 0; index < 15; index += 1) {
    it(`projects canonical legal actions ${index}`, () => {
      const stateDigest = stableDigest(index);
      const set = projectKtsLegalActions(stateDigest, "actions-1", [
        { actionId: `b-${index}`, actionType: "b", resourceCost: 1, payload: index },
        { actionId: `a-${index}`, actionType: "a", resourceCost: 0, payload: index },
      ]);
      expect(set.actions[0]?.actionId).toBe(`a-${index}`);
    });
  }
  it("creates the accepted KTS score policy", () =>
    expect(createKtsScorePolicy().weights.signal_retention).toBe(10));
  it("creates the accepted KTS risk policy", () =>
    expect(createKtsRiskPolicy().blockingFlags).toContain("terminal_failure"));
  it("projects no proposal from abstention", () =>
    expect(
      projectKtsPlanningProposal({ status: "abstained" } as unknown as PlannerResult),
    ).toBeNull());
  it("marks proposals as requiring validation", () => {
    const initial = projectKtsPlanningObservation({
      observationId: "obs",
      simulatorVersion: "sim-1",
      signal: 0,
      defence: 0,
      coherence: 0,
      threat: 0,
      damage: 0,
      resource: 0,
      recoveryPotential: 0,
      waveProgress: 0,
      futureOptions: 1,
      terminalSurvival: 1,
      terminal: false,
    });
    const legal: LegalActionPort = {
      schemaVersion: "actions-1",
      enumerate(current) {
        return projectKtsLegalActions(current.stateDigest, "actions-1", [
          { actionId: "advance", actionType: "advance", resourceCost: 0, payload: {} },
        ]);
      },
    };
    const simulator: SimulationPort = {
      simulatorVersion: "sim-1",
      simulate(current, action) {
        const result = projectKtsPlanningObservation({
          observationId: "next",
          simulatorVersion: "sim-1",
          signal: 1,
          defence: 1,
          coherence: 1,
          threat: -1,
          damage: -1,
          resource: 1,
          recoveryPotential: 1,
          waveProgress: 1,
          futureOptions: 1,
          terminalSurvival: 1,
          terminal: true,
        });
        return {
          sourceStateDigest: current.stateDigest,
          resultState: result,
          appliedActionId: action.actionId,
          scoreDelta: 1,
          signalDelta: 1,
          defenceDelta: 1,
          coherenceDelta: 1,
          threatDelta: -1,
          damageDelta: -1,
          resourceDelta: 1,
          waveProgressDelta: 1,
          evidenceDigest: stableDigest(result),
        };
      },
    };
    const request = createPlanningRequest({
      requestId: "kts",
      planner: createPlannerIdentity("planner", "1"),
      observationSchemaVersion: "obs-1",
      legalActionSchemaVersion: "actions-1",
      simulatorVersion: "sim-1",
      scoringPolicy: createKtsScorePolicy(),
      riskPolicy: createKtsRiskPolicy(),
      initialState: initial,
      budget: createSearchBudget({
        maximumPlanningDepth: 1,
        beamWidth: 1,
        maximumCandidateExpansions: 2,
        maximumSimulationCalls: 2,
        maximumRetainedCandidates: 2,
        maximumReturnedPlans: 1,
        maximumExplanationEntries: 32,
        maximumCandidateActions: 8,
        maximumScoreComponents: 16,
        maximumOutputBytes: 100000,
      }),
      abstentionThreshold: -100,
      tieBreakPolicyVersion: "tie-1",
      seedIdentity: "seed-1",
      cancelled: false,
    });
    const proposal = projectKtsPlanningProposal(
      createPlannerController(legal, simulator).plan(request),
    );
    expect(proposal?.requiresProposalValidation).toBe(true);
    expect(proposal?.noExecution).toBe(true);
  });
});

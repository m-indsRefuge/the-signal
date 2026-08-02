import {
  createRiskPolicy,
  createScorePolicy,
  type RiskPolicy,
  type ScorePolicy,
} from "../../intelligence-harness/planning";

export function createKtsScorePolicy(): ScorePolicy {
  return createScorePolicy("kts-signal-officer", "1", {
    signal_retention: 10,
    defence_retention: 7,
    coherence: 8,
    damage_avoidance: 6,
    threat_reduction: 5,
    resource_efficiency: 4,
    recovery_potential: 5,
    wave_progress: 3,
    terminal_survival: 12,
    future_option_value: 4,
  });
}

export function createKtsRiskPolicy(): RiskPolicy {
  return createRiskPolicy({
    policyId: "kts-risk",
    policyVersion: "1",
    lowSignalThreshold: -0.8,
    defenceCollapseThreshold: -0.9,
    resourceDepletionThreshold: -0.95,
    highDamageThreshold: 0.9,
    lowCoherenceThreshold: -0.85,
    blockingFlags: ["terminal_failure", "defence_collapse"],
    penaltyPerFlag: 5,
  });
}

import { stableDigest } from "./candidate-digest";
import { fail } from "./failures";
import type { SimulatedState } from "./simulation-port";

export const RISK_FLAGS = [
  "terminal_failure",
  "low_signal_exposure",
  "defence_collapse",
  "resource_depletion",
  "high_damage_transition",
  "low_coherence_transition",
  "strategic_irreversibility",
] as const;

export type RiskFlag = (typeof RISK_FLAGS)[number];

export interface RiskPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly lowSignalThreshold: number;
  readonly defenceCollapseThreshold: number;
  readonly resourceDepletionThreshold: number;
  readonly highDamageThreshold: number;
  readonly lowCoherenceThreshold: number;
  readonly blockingFlags: readonly RiskFlag[];
  readonly penaltyPerFlag: number;
  readonly digest: string;
}

export interface RiskAssessment {
  readonly flags: readonly RiskFlag[];
  readonly penalty: number;
  readonly blocked: boolean;
}

export function createRiskPolicy(input: Omit<RiskPolicy, "digest">): RiskPolicy {
  const numbers = [
    input.lowSignalThreshold,
    input.defenceCollapseThreshold,
    input.resourceDepletionThreshold,
    input.highDamageThreshold,
    input.lowCoherenceThreshold,
    input.penaltyPerFlag,
  ];
  if (
    !input.policyId.trim() ||
    !input.policyVersion.trim() ||
    numbers.some((value) => !Number.isFinite(value))
  ) {
    return fail("invalid_scoring_policy", "Risk policy is malformed.");
  }
  const blockingFlags = Object.freeze([...new Set(input.blockingFlags)].sort());
  return Object.freeze({
    ...input,
    policyId: input.policyId.trim(),
    policyVersion: input.policyVersion.trim(),
    blockingFlags,
    digest: stableDigest({ ...input, blockingFlags }),
  });
}

export function assessRisk(policy: RiskPolicy, state: SimulatedState): RiskAssessment {
  const flags: RiskFlag[] = [];
  if (state.terminal && state.metrics.terminalSurvival <= 0) flags.push("terminal_failure");
  if (state.metrics.signal <= policy.lowSignalThreshold) flags.push("low_signal_exposure");
  if (state.metrics.defence <= policy.defenceCollapseThreshold) flags.push("defence_collapse");
  if (state.metrics.resource <= policy.resourceDepletionThreshold) flags.push("resource_depletion");
  if (state.metrics.damage >= policy.highDamageThreshold) flags.push("high_damage_transition");
  if (state.metrics.coherence <= policy.lowCoherenceThreshold)
    flags.push("low_coherence_transition");
  if (state.metrics.futureOptions <= 0) flags.push("strategic_irreversibility");
  const canonicalFlags = Object.freeze([...new Set(flags)].sort());
  return Object.freeze({
    flags: canonicalFlags,
    penalty: canonicalFlags.length * policy.penaltyPerFlag,
    blocked: canonicalFlags.some((flag) => policy.blockingFlags.includes(flag)),
  });
}

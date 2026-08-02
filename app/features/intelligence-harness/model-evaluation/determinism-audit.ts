import { digestCanonical, immutableCopy } from "./evaluation-contract";
import type { BaselineRunEvidence } from "./baseline-run";

export type RepeatabilityState = "stable" | "unstable" | "partially_stable" | "unknown";

export type RepeatabilityAudit = Readonly<{
  state: RepeatabilityState;
  rawResponseEqual: boolean | "unknown";
  normalizedResponseEqual: boolean | "unknown";
  proposalEqual: boolean | "unknown";
  validatorDecisionEqual: boolean | "unknown";
  caseOutcomeEqual: boolean | "unknown";
  tokenVariance: number | "unknown";
  latencyVarianceMilliseconds: number | "unknown";
  memoryVarianceMiB: number | "unknown";
  auditDigest: string;
}>;

function variance(values: readonly (number | undefined)[]): number | "unknown" {
  const known = values.filter((value): value is number => typeof value === "number");
  if (known.length !== values.length || known.length < 2) return "unknown";
  return Math.max(...known) - Math.min(...known);
}

export function auditRepeatability(runs: readonly BaselineRunEvidence[]): RepeatabilityAudit {
  if (runs.length < 2) {
    const core = {
      state: "unknown" as const,
      rawResponseEqual: "unknown" as const,
      normalizedResponseEqual: "unknown" as const,
      proposalEqual: "unknown" as const,
      validatorDecisionEqual: "unknown" as const,
      caseOutcomeEqual: "unknown" as const,
      tokenVariance: "unknown" as const,
      latencyVarianceMilliseconds: "unknown" as const,
      memoryVarianceMiB: "unknown" as const,
    };
    return immutableCopy({
      ...core,
      auditDigest: digestCanonical(core),
    }) as RepeatabilityAudit;
  }
  const first = runs[0];
  const rawResponseEqual = runs.every((run) => run.response.rawDigest === first.response.rawDigest);
  const normalizedResponseEqual = runs.every(
    (run) => run.parsed.normalizedDigest === first.parsed.normalizedDigest,
  );
  const proposalEqual = runs.every(
    (run) =>
      digestCanonical(run.parsed.object ?? null) === digestCanonical(first.parsed.object ?? null),
  );
  const validatorDecisionEqual = runs.every(
    (run) => run.validator.decision === first.validator.decision,
  );
  const caseOutcomeEqual = runs.every((run) => run.outcome === first.outcome);
  const tokenVariance = variance(runs.map((run) => run.response.generatedTokens));
  const latencyVarianceMilliseconds = variance(
    runs.map((run) => run.response.totalDurationMilliseconds),
  );
  const memoryVarianceMiB = variance(runs.map((run) => run.response.peakGpuMemoryMiB));
  const exact =
    rawResponseEqual &&
    normalizedResponseEqual &&
    proposalEqual &&
    validatorDecisionEqual &&
    caseOutcomeEqual;
  const semantic =
    normalizedResponseEqual && proposalEqual && validatorDecisionEqual && caseOutcomeEqual;
  const state: RepeatabilityState = exact ? "stable" : semantic ? "partially_stable" : "unstable";
  const core = {
    state,
    rawResponseEqual,
    normalizedResponseEqual,
    proposalEqual,
    validatorDecisionEqual,
    caseOutcomeEqual,
    tokenVariance,
    latencyVarianceMilliseconds,
    memoryVarianceMiB,
  };
  return immutableCopy({
    ...core,
    auditDigest: digestCanonical(core),
  }) as RepeatabilityAudit;
}

import { digestCanonical, immutableCopy } from "./admission-contract";
import type { AdmissionDecision } from "./admission-decision";
import type { DatasetManifest } from "./manifest-contract";

export type AdmissionMetrics = Readonly<{
  requestCount: number;
  eligibilityCounts: Readonly<Record<string, number>>;
  roleCounts: Readonly<Record<string, number>>;
  duplicateCounts: Readonly<Record<string, number>>;
  outcomeCounts: Readonly<Record<string, number>>;
  partitionCounts: Readonly<Record<string, number>>;
  leakageCounts: Readonly<Record<string, number>>;
  manifestSampleCount: number;
  digest: string;
}>;

function increment(target: Record<string, number>, key: string | undefined): void {
  if (key) {
    target[key] = (target[key] ?? 0) + 1;
  }
}

export function calculateAdmissionMetrics(
  decisions: readonly AdmissionDecision[],
  manifest?: DatasetManifest,
): AdmissionMetrics {
  const eligibilityCounts: Record<string, number> = {};
  const roleCounts: Record<string, number> = {};
  const duplicateCounts: Record<string, number> = {};
  const outcomeCounts: Record<string, number> = {};
  const partitionCounts: Record<string, number> = {};
  const leakageCounts: Record<string, number> = {};

  for (const decision of decisions) {
    increment(eligibilityCounts, decision.eligibility.state);
    increment(roleCounts, decision.role);
    increment(duplicateCounts, decision.duplicate.status);
    increment(outcomeCounts, decision.outcome);
    increment(partitionCounts, decision.partition?.partition);
    increment(leakageCounts, decision.leakage.state);
  }

  const core = {
    requestCount: decisions.length,
    eligibilityCounts,
    roleCounts,
    duplicateCounts,
    outcomeCounts,
    partitionCounts,
    leakageCounts,
    manifestSampleCount: manifest?.samples.length ?? 0,
  };
  return immutableCopy({
    ...core,
    digest: digestCanonical(core),
  }) as AdmissionMetrics;
}

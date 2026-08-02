import { canonicalizeJson, deepFreezeJson, type JsonValue } from "../memory-fabric/canonical-json";
import { failFineTuning } from "./failures";
import type { MetricName } from "./metrics-contract";
export const REGRESSION_DIRECTIONS = Object.freeze(["minimum", "maximum"] as const);
export type RegressionDirection = (typeof REGRESSION_DIRECTIONS)[number];
export interface RegressionGate {
  readonly gateId: string;
  readonly metricName: MetricName;
  readonly direction: RegressionDirection;
  readonly threshold: number;
  readonly blocking: boolean;
}
export interface RegressionGateResult {
  readonly gateId: string;
  readonly outcome: "pass" | "fail" | "unknown";
  readonly observed?: number;
  readonly reason: string;
  readonly blocking: boolean;
}
export function evaluateRegressionGates(
  gates: readonly RegressionGate[],
  metrics: Readonly<Partial<Record<MetricName, number>>>,
): readonly Readonly<RegressionGateResult>[] {
  const results = gates.map((g) => {
    const observed = metrics[g.metricName];
    if (observed === undefined)
      return {
        gateId: g.gateId,
        outcome: "unknown" as const,
        reason: "Metric is unavailable.",
        blocking: g.blocking,
      };
    const pass = g.direction === "minimum" ? observed >= g.threshold : observed <= g.threshold;
    return {
      gateId: g.gateId,
      outcome: pass ? ("pass" as const) : ("fail" as const),
      observed,
      reason: pass ? "Threshold satisfied." : "Threshold violated.",
      blocking: g.blocking,
    };
  });
  return deepFreezeJson(
    canonicalizeJson(results) as JsonValue,
  ) as unknown as readonly Readonly<RegressionGateResult>[];
}
export function assertNoBlockingRegression(results: readonly RegressionGateResult[]): void {
  if (results.some((r) => r.blocking && r.outcome !== "pass"))
    failFineTuning(
      "regression_gate_failed",
      "regression",
      "A blocking regression gate did not pass.",
    );
}

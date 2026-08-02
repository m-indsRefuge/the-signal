import { deepFreezeJson, canonicalizeJson, type JsonValue } from "../memory-fabric/canonical-json";
import { failFineTuning } from "./failures";
import type { MetricName } from "./metrics-contract";
export interface BaselineMetricSet {
  readonly baselineId: string;
  readonly values: Readonly<Partial<Record<MetricName, number>>>;
}
export interface MetricDelta {
  readonly metricName: MetricName;
  readonly candidateValue: number;
  readonly baselineValue: number;
  readonly delta: number;
}
export interface BaselineComparison {
  readonly candidateId: string;
  readonly baselineId: string;
  readonly deltas: readonly MetricDelta[];
}
export function compareAgainstBaseline(
  candidateId: string,
  candidate: Readonly<Partial<Record<MetricName, number>>>,
  baseline: Readonly<BaselineMetricSet>,
  metrics: readonly MetricName[],
): Readonly<BaselineComparison> {
  const deltas: MetricDelta[] = [];
  for (const metricName of metrics) {
    const c = candidate[metricName],
      b = baseline.values[metricName];
    if (c === undefined || b === undefined)
      failFineTuning("baseline_missing", "baseline", "Required baseline metric is missing.", {
        metricName,
      });
    deltas.push({ metricName, candidateValue: c, baselineValue: b, delta: c - b });
  }
  return deepFreezeJson(
    canonicalizeJson({ candidateId, baselineId: baseline.baselineId, deltas }) as JsonValue,
  ) as unknown as Readonly<BaselineComparison>;
}

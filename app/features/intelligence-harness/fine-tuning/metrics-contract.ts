import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export const REQUIRED_METRICS = Object.freeze([
  "schema_compliance",
  "legal_proposal_rate",
  "unsupported_claim_rate",
  "grounding_completeness",
  "abstention_correctness",
  "wasted_recommendation_rate",
  "confidence_calibration",
  "inference_latency_ms",
  "context_size",
  "signal_retained",
  "defence_retained",
  "coherence",
  "score",
  "wave_completion",
  "unseen_seed_performance",
] as const);
export type MetricName = (typeof REQUIRED_METRICS)[number];
export interface MetricObservationDraft {
  readonly metricId: string;
  readonly metricName: MetricName;
  readonly value: number;
  readonly sampleCount: number;
  readonly partition: string;
  readonly caseReference: string;
}
export interface MetricObservation extends MetricObservationDraft {
  readonly contentDigest: string;
}
export async function createMetricObservation(
  draft: Readonly<MetricObservationDraft>,
): Promise<Readonly<MetricObservation>> {
  validateFineTuningIdentity(draft.metricId, "metricId", "evaluation_invalid");
  validateFineTuningIdentity(draft.partition, "partition", "evaluation_invalid");
  validateFineTuningIdentity(draft.caseReference, "caseReference", "evaluation_invalid");
  if (
    !REQUIRED_METRICS.includes(draft.metricName) ||
    !Number.isFinite(draft.value) ||
    !Number.isSafeInteger(draft.sampleCount) ||
    draft.sampleCount < 1
  )
    failFineTuning("evaluation_invalid", "metrics", "Metric observation is invalid.");
  const normalized = canonicalizeJson(draft) as unknown as MetricObservationDraft;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<MetricObservation>;
}

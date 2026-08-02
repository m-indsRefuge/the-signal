import type { MetricName } from "../../intelligence-harness/fine-tuning/metrics-contract";
export interface KtsEvaluationSummary {
  readonly schemaCompliance: number;
  readonly legalProposalRate: number;
  readonly unsupportedClaimRate: number;
  readonly groundingCompleteness: number;
  readonly abstentionCorrectness: number;
  readonly wastedRecommendationRate: number;
  readonly confidenceCalibration: number;
  readonly inferenceLatencyMs: number;
  readonly contextSize: number;
  readonly signalRetained: number;
  readonly defenceRetained: number;
  readonly coherence: number;
  readonly score: number;
  readonly waveCompletion: number;
  readonly unseenSeedPerformance: number;
}
export function projectKtsMetrics(
  summary: Readonly<KtsEvaluationSummary>,
): Readonly<Record<MetricName, number>> {
  return Object.freeze({
    schema_compliance: summary.schemaCompliance,
    legal_proposal_rate: summary.legalProposalRate,
    unsupported_claim_rate: summary.unsupportedClaimRate,
    grounding_completeness: summary.groundingCompleteness,
    abstention_correctness: summary.abstentionCorrectness,
    wasted_recommendation_rate: summary.wastedRecommendationRate,
    confidence_calibration: summary.confidenceCalibration,
    inference_latency_ms: summary.inferenceLatencyMs,
    context_size: summary.contextSize,
    signal_retained: summary.signalRetained,
    defence_retained: summary.defenceRetained,
    coherence: summary.coherence,
    score: summary.score,
    wave_completion: summary.waveCompletion,
    unseen_seed_performance: summary.unseenSeedPerformance,
  });
}

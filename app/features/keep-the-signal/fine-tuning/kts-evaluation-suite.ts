import {
  createEvaluationPlan,
  type EvaluationCase,
} from "../../intelligence-harness/fine-tuning/evaluation-plan";
import { REQUIRED_METRICS } from "../../intelligence-harness/fine-tuning/metrics-contract";
import { KTS_BASELINES } from "./kts-baseline-contract";
export interface KtsEvaluationSuiteInput {
  readonly planId: string;
  readonly planVersion: string;
  readonly cases: readonly EvaluationCase[];
  readonly maximumCases: number;
}
export function createKtsEvaluationSuite(input: Readonly<KtsEvaluationSuiteInput>) {
  return createEvaluationPlan({
    planId: input.planId,
    planVersion: input.planVersion,
    baselines: KTS_BASELINES,
    cases: input.cases,
    requiredMetricNames: REQUIRED_METRICS,
    maximumCases: input.maximumCases,
  });
}

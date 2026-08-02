import {
  projectNormalizedSample,
  type NormalizedSample,
  type SampleProjectionInput,
} from "../../intelligence-harness/dataset-admission";

export const KTS_SAMPLE_PROJECTOR_ID = "kts-i4-k.kts-sample-projector";
export const KTS_SAMPLE_PROJECTOR_VERSION = "1.0.0";

export function projectKtsSample(input: SampleProjectionInput): NormalizedSample {
  return projectNormalizedSample(input);
}

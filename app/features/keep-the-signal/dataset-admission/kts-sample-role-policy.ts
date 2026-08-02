import {
  classifySampleRole,
  type EvidenceOutcome,
  type SampleRole,
} from "../../intelligence-harness/dataset-admission";

export const KTS_SAMPLE_ROLE_POLICY_ID = "kts-i4-k.kts-sample-role";
export const KTS_SAMPLE_ROLE_POLICY_VERSION = "1.0.0";

export function classifyKtsSampleRole(outcome: EvidenceOutcome): SampleRole {
  return classifySampleRole(outcome);
}

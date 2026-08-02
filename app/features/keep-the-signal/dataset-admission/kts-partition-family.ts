import {
  deriveFamilyIdentities,
  type AdmissionEvidence,
  type FamilyIdentities,
} from "../../intelligence-harness/dataset-admission";

export const KTS_FAMILY_POLICY_ID = "kts-i4-k.kts-partition-family";
export const KTS_FAMILY_POLICY_VERSION = "1.0.0";

export function deriveKtsPartitionFamily(evidence: AdmissionEvidence): FamilyIdentities {
  return deriveFamilyIdentities(evidence);
}

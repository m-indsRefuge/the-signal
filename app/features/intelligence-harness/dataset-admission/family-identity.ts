import { digestCanonical, immutableCopy, requireIdentity } from "./admission-contract";
import type { AdmissionEvidence } from "./admission-request";

export type FamilyIdentities = Readonly<{
  scenarioFamilyId: string;
  episodeFamilyId?: string;
  duplicateFamilyId: string;
  partitionFamilyId: string;
  provenanceFamilyId: string;
  familyDigest: string;
}>;

export function deriveFamilyIdentities(evidence: AdmissionEvidence): FamilyIdentities {
  for (const [label, value] of [
    ["scenarioFamilyId", evidence.scenarioFamilyId],
    ["duplicateFamilyId", evidence.duplicateFamilyId],
    ["partitionFamilyId", evidence.partitionFamilyId],
    ["provenanceFamilyId", evidence.provenanceFamilyId],
  ] as const) {
    requireIdentity(value, label);
  }

  const core = {
    scenarioFamilyId: evidence.scenarioFamilyId,
    episodeFamilyId: evidence.episodeFamilyId,
    duplicateFamilyId: evidence.duplicateFamilyId,
    partitionFamilyId: evidence.partitionFamilyId,
    provenanceFamilyId: evidence.provenanceFamilyId,
  };
  return immutableCopy({
    ...core,
    familyDigest: digestCanonical(core),
  }) as FamilyIdentities;
}

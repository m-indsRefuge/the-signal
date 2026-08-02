import {
  digestCanonical,
  immutableCopy,
  requireIdentity,
  requireIsoTime,
  sortText,
} from "./evaluation-contract";

export type LicenseDecision =
  "approved_for_baseline_evaluation" | "conditionally_approved" | "rejected" | "unknown";

export type LicenseProfile = Readonly<{
  licenseId: string;
  sourceId: string;
  termsDigest: string;
  accessRequirement: string;
  redistributionConditions: readonly string[];
  derivativeWorkConditions: readonly string[];
  commercialUse: "allowed" | "restricted" | "unknown";
  attributionRequirements: readonly string[];
  acceptableUseRestrictions: readonly string[];
  reviewerId: string;
  reviewedAt: string;
  decision: LicenseDecision;
  reasonCodes: readonly string[];
  limitations: readonly string[];
  licenseDigest: string;
}>;

export function createLicenseProfile(input: Omit<LicenseProfile, "licenseDigest">): LicenseProfile {
  for (const [label, value] of [
    ["licenseId", input.licenseId],
    ["sourceId", input.sourceId],
    ["termsDigest", input.termsDigest],
    ["accessRequirement", input.accessRequirement],
    ["reviewerId", input.reviewerId],
  ] as const)
    requireIdentity(value, label);
  requireIsoTime(input.reviewedAt, "reviewedAt");
  const core = {
    ...input,
    redistributionConditions: sortText(input.redistributionConditions),
    derivativeWorkConditions: sortText(input.derivativeWorkConditions),
    attributionRequirements: sortText(input.attributionRequirements),
    acceptableUseRestrictions: sortText(input.acceptableUseRestrictions),
    reasonCodes: sortText(input.reasonCodes),
    limitations: sortText(input.limitations),
  };
  return immutableCopy({
    ...core,
    licenseDigest: digestCanonical(core),
  }) as LicenseProfile;
}

export function licenseAllowsBaseline(profile: LicenseProfile): boolean {
  return profile.decision === "approved_for_baseline_evaluation";
}

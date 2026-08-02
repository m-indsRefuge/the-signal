import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { sha256Hex, verifySha256Hex } from "../memory-fabric/digest";
import { failTraining, validateTrainingIdentity, validateTrainingTimestamp } from "./failures";

export const SOURCE_CLASSIFICATIONS = Object.freeze([
  "accepted",
  "rejected",
  "corrected",
  "abstained",
  "experimental",
  "quarantined",
] as const);
export type SourceClassification = (typeof SOURCE_CLASSIFICATIONS)[number];
export const SOURCE_ELIGIBILITY_OUTCOMES = Object.freeze([
  "eligible",
  "review_required",
  "ineligible",
  "quarantined",
] as const);
export type SourceEligibilityOutcome = (typeof SOURCE_ELIGIBILITY_OUTCOMES)[number];
export const GOVERNANCE_STATUSES = Object.freeze(["accepted", "rejected", "unknown"] as const);
export type GovernanceStatus = (typeof GOVERNANCE_STATUSES)[number];

export interface TrainingSourceRecordDraft {
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly classification: SourceClassification;
  readonly lineageFamilyId: string;
  readonly partitionGroupIds: readonly string[];
  readonly payload: JsonValue;
  readonly evidenceReferences: readonly string[];
  readonly contradictionReferences: readonly string[];
  readonly protected: boolean;
  readonly consentStatus: GovernanceStatus;
  readonly privacyStatus: GovernanceStatus;
  readonly reviewerStatus: GovernanceStatus;
  readonly recordedAt: string;
}
export interface TrainingSourceRecord extends TrainingSourceRecordDraft {
  readonly contentDigest: string;
}
export interface SourceAccessPolicy {
  readonly permittedDomains: readonly string[];
  readonly permittedClassifications: readonly SourceClassification[];
  readonly allowProtected: boolean;
  readonly requireAcceptedConsent: boolean;
  readonly requireAcceptedPrivacy: boolean;
  readonly requireAcceptedReview: boolean;
}
export interface SourceEligibilityReport {
  readonly sourceId: string;
  readonly outcome: SourceEligibilityOutcome;
  readonly reasons: readonly string[];
}
export interface ReadOnlyTrainingEvidenceSource {
  getSource(
    sourceId: string,
    sourceVersion: string,
  ): Promise<Readonly<TrainingSourceRecord> | null>;
  listSources(
    domainId: string,
    maximumRecords: number,
  ): Promise<readonly Readonly<TrainingSourceRecord>[]>;
}
export function isReadOnlyTrainingEvidenceSource(
  value: unknown,
): value is ReadOnlyTrainingEvidenceSource {
  if (typeof value !== "object" || value === null) return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.getSource === "function" &&
    typeof source.listSources === "function" &&
    [
      "putSource",
      "persistSource",
      "writeSource",
      "updateSource",
      "deleteSource",
      "archiveSource",
    ].every((name) => !(name in source))
  );
}
function normalizeSourceDraft(
  draft: Readonly<TrainingSourceRecordDraft>,
): Readonly<TrainingSourceRecordDraft> {
  for (const [label, value] of [
    ["sourceId", draft.sourceId],
    ["sourceVersion", draft.sourceVersion],
    ["domainId", draft.domainId],
    ["domainVersion", draft.domainVersion],
    ["schemaId", draft.schemaId],
    ["lineageFamilyId", draft.lineageFamilyId],
  ] as const)
    validateTrainingIdentity(value, label);
  if (
    !Number.isSafeInteger(draft.schemaVersion) ||
    draft.schemaVersion < 1 ||
    !SOURCE_CLASSIFICATIONS.includes(draft.classification) ||
    !GOVERNANCE_STATUSES.includes(draft.consentStatus) ||
    !GOVERNANCE_STATUSES.includes(draft.privacyStatus) ||
    !GOVERNANCE_STATUSES.includes(draft.reviewerStatus) ||
    draft.partitionGroupIds.length === 0
  ) {
    failTraining("invalid_training_source", "source", "Training source classification is invalid.");
  }
  validateTrainingTimestamp(draft.recordedAt, "invalid_training_source", "source");
  return deepFreezeJson(
    canonicalizeJson({
      ...draft,
      partitionGroupIds: [...new Set(draft.partitionGroupIds)].sort(),
      evidenceReferences: [...new Set(draft.evidenceReferences)].sort(),
      contradictionReferences: [...new Set(draft.contradictionReferences)].sort(),
    }),
  ) as unknown as Readonly<TrainingSourceRecordDraft>;
}
export async function createTrainingSource(
  draft: Readonly<TrainingSourceRecordDraft>,
): Promise<Readonly<TrainingSourceRecord>> {
  const normalized = normalizeSourceDraft(draft);
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  }) as unknown as Readonly<TrainingSourceRecord>;
}
export async function validateTrainingSource(
  source: Readonly<TrainingSourceRecord>,
): Promise<void> {
  const { contentDigest, ...draft } = source;
  normalizeSourceDraft(draft);
  if (!(await verifySha256Hex(canonicalStringify(draft), contentDigest))) {
    failTraining("source_digest_mismatch", "source", "Training source digest mismatch.", {
      sourceId: source.sourceId,
    });
  }
}
export function evaluateSourceEligibility(
  source: Readonly<TrainingSourceRecord>,
  policy: Readonly<SourceAccessPolicy>,
): Readonly<SourceEligibilityReport> {
  const reasons: string[] = [];
  if (!policy.permittedDomains.includes(source.domainId)) reasons.push("domain_not_permitted");
  if (!policy.permittedClassifications.includes(source.classification))
    reasons.push("classification_not_permitted");
  if (source.protected && !policy.allowProtected) reasons.push("protected_evidence_prohibited");
  if (policy.requireAcceptedConsent && source.consentStatus !== "accepted")
    reasons.push("consent_not_accepted");
  if (policy.requireAcceptedPrivacy && source.privacyStatus !== "accepted")
    reasons.push("privacy_not_accepted");
  if (policy.requireAcceptedReview && source.reviewerStatus !== "accepted")
    reasons.push("review_not_accepted");
  const unknown =
    source.consentStatus === "unknown" ||
    source.privacyStatus === "unknown" ||
    source.reviewerStatus === "unknown";
  const outcome: SourceEligibilityOutcome =
    reasons.length === 0
      ? "eligible"
      : unknown
        ? "review_required"
        : source.classification === "quarantined"
          ? "quarantined"
          : "ineligible";
  return Object.freeze({
    sourceId: source.sourceId,
    outcome,
    reasons: Object.freeze(reasons.sort()),
  });
}

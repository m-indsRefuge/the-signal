import type { DemonstrationEvidenceRecord } from "./evidence-record";
import { evidenceDigest, freezeDeep } from "./evidence-digest";

export const DUPLICATE_CLASSIFICATIONS = [
  "unique",
  "exact_duplicate",
  "structural_duplicate",
  "conflicting_duplicate",
] as const;
export type DuplicateClassification = (typeof DUPLICATE_CLASSIFICATIONS)[number];

export interface DuplicateFingerprint {
  readonly recordId: string;
  readonly recordDigest: string;
  readonly duplicateFamilyId: string;
  readonly structuralDigest: string;
}

export interface DuplicateAnalysis {
  readonly classification: DuplicateClassification;
  readonly candidate: DuplicateFingerprint;
  readonly matchedRecordIds: readonly string[];
  readonly analysisDigest: string;
}

export function createDuplicateFingerprint(
  record: DemonstrationEvidenceRecord,
): DuplicateFingerprint {
  return freezeDeep({
    recordId: record.recordId,
    recordDigest: record.recordDigest,
    duplicateFamilyId: record.duplicateFamilyId,
    structuralDigest: evidenceDigest({
      scenarioFamilyId: record.sourceLineage.scenarioFamilyId,
      outcome: record.outcome,
      actionIds: record.selectedPlan?.orderedActionIds ?? [],
      proposalSchemaId: record.proposal?.proposalSchemaId ?? null,
      validatorDecision: record.validator?.decision ?? null,
    }),
  });
}

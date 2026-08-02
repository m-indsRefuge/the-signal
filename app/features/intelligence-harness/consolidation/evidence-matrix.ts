import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
} from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import {
  failConsolidation,
  validateConsolidationIdentity,
  validateConsolidationTimestamp,
} from "./failures";

export const MATRIX_EVIDENCE_CLASSES = Object.freeze([
  "support",
  "contradiction",
  "counterexample",
  "unseen",
  "competing_explanation",
  "domain_invariant",
  "version_boundary",
  "reproducibility",
] as const);
export type MatrixEvidenceClass = (typeof MATRIX_EVIDENCE_CLASSES)[number];

export const MATRIX_OUTCOMES = Object.freeze([
  "supports",
  "weakly_supports",
  "neutral",
  "weakly_refutes",
  "refutes",
  "unknown",
  "not_applicable",
] as const);
export type MatrixOutcome = (typeof MATRIX_OUTCOMES)[number];

export interface EvidenceMatrixEntryDraft {
  readonly entryId: string;
  readonly candidateId: string;
  readonly candidateVersion: string;
  readonly evidenceClass: MatrixEvidenceClass;
  readonly referenceId: string;
  readonly evaluatorId: string;
  readonly evaluatorVersion: string;
  readonly outcome: MatrixOutcome;
  readonly weightBasis: number | "not_applicable";
  readonly explanationCode: string;
  readonly publicNote?: string;
  readonly limitations: readonly string[];
  readonly recordedAt: string;
}

export interface EvidenceMatrixEntry extends EvidenceMatrixEntryDraft {
  readonly canonicalContent: string;
}

export interface EvidenceMatrixDraft {
  readonly matrixId: string;
  readonly matrixVersion: string;
  readonly candidateId: string;
  readonly candidateVersion: string;
  readonly entries: readonly Readonly<EvidenceMatrixEntry>[];
}

export interface EvidenceMatrix extends EvidenceMatrixDraft {
  readonly contentDigest: string;
}

export function createEvidenceMatrixEntry(
  draft: Readonly<EvidenceMatrixEntryDraft>,
): Readonly<EvidenceMatrixEntry> {
  for (const [label, value] of [
    ["entryId", draft.entryId],
    ["candidateId", draft.candidateId],
    ["candidateVersion", draft.candidateVersion],
    ["referenceId", draft.referenceId],
    ["evaluatorId", draft.evaluatorId],
    ["evaluatorVersion", draft.evaluatorVersion],
    ["explanationCode", draft.explanationCode],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_evidence_matrix", "evidence_matrix");
  }
  validateConsolidationTimestamp(draft.recordedAt, "invalid_evidence_matrix", "evidence_matrix");
  if (
    !MATRIX_EVIDENCE_CLASSES.includes(draft.evidenceClass) ||
    !MATRIX_OUTCOMES.includes(draft.outcome)
  ) {
    failConsolidation(
      "invalid_evidence_matrix",
      "evidence_matrix",
      "Evidence matrix classification is unsupported.",
    );
  }
  if (
    draft.weightBasis !== "not_applicable" &&
    (!Number.isFinite(draft.weightBasis) ||
      draft.weightBasis < -10_000 ||
      draft.weightBasis > 10_000)
  ) {
    failConsolidation(
      "invalid_evidence_matrix",
      "evidence_matrix",
      "Evidence weight basis is invalid.",
    );
  }
  const normalized = canonicalizeJson({
    ...draft,
    limitations: [...new Set(draft.limitations)].sort(),
  }) as unknown as Omit<EvidenceMatrixEntry, "canonicalContent">;
  return deepFreezeJson({
    ...normalized,
    canonicalContent: canonicalStringify(normalized),
  } as unknown as JsonObject) as unknown as Readonly<EvidenceMatrixEntry>;
}

export async function createEvidenceMatrix(
  draft: Readonly<EvidenceMatrixDraft>,
): Promise<Readonly<EvidenceMatrix>> {
  for (const [label, value] of [
    ["matrixId", draft.matrixId],
    ["matrixVersion", draft.matrixVersion],
    ["candidateId", draft.candidateId],
    ["candidateVersion", draft.candidateVersion],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_evidence_matrix", "evidence_matrix");
  }
  const ids = draft.entries.map((entry) => entry.entryId);
  if (
    new Set(ids).size !== ids.length ||
    draft.entries.some(
      (entry) =>
        entry.candidateId !== draft.candidateId ||
        entry.candidateVersion !== draft.candidateVersion,
    )
  ) {
    failConsolidation(
      "invalid_evidence_matrix",
      "evidence_matrix",
      "Evidence matrix lineage is inconsistent.",
    );
  }
  const normalized = canonicalizeJson({
    ...draft,
    entries: [...draft.entries].sort((a, b) =>
      a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0,
    ),
  }) as unknown as Omit<EvidenceMatrix, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonObject) as unknown as Readonly<EvidenceMatrix>;
}

export function matrixEntriesByClass(
  matrix: Readonly<EvidenceMatrix>,
  evidenceClass: MatrixEvidenceClass,
): readonly Readonly<EvidenceMatrixEntry>[] {
  return Object.freeze(matrix.entries.filter((entry) => entry.evidenceClass === evidenceClass));
}

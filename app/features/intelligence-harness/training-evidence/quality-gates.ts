import { canonicalStringify, deepFreezeJson } from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failTraining } from "./failures";
import type { DuplicateAuditReport } from "./duplicate-auditor";
import type { LeakageAuditReport } from "./leakage-auditor";
import type { TrainingExample, QualityOutcome } from "./training-example-contract";
export const REQUIRED_QUALITY_GATES = Object.freeze([
  "schema_validity",
  "digest_integrity",
  "source_existence",
  "source_eligibility",
  "lineage_completeness",
  "target_support",
  "legal_compatibility",
  "grounding_completeness",
  "contradiction_preservation",
  "protected_evidence_policy",
  "consent_privacy",
  "review_requirement",
  "partition_validity",
  "exact_duplicate_audit",
  "structural_duplicate_audit",
  "leakage_audit",
  "class_balance",
  "uncertainty_report",
  "version_compatibility",
  "deterministic_reconstruction",
] as const);
export interface DatasetQualityGate {
  readonly gateId: (typeof REQUIRED_QUALITY_GATES)[number];
  readonly outcome: QualityOutcome;
  readonly blocking: boolean;
  readonly reasons: readonly string[];
}
export interface DatasetQualityReport {
  readonly gates: readonly DatasetQualityGate[];
  readonly eligible: boolean;
  readonly reportDigest: string;
}
export async function evaluateDatasetQuality(
  examples: readonly Readonly<TrainingExample>[],
  duplicates: Readonly<DuplicateAuditReport>,
  leakage: Readonly<LeakageAuditReport>,
): Promise<Readonly<DatasetQualityReport>> {
  const gates: DatasetQualityGate[] = [];
  const add = (
    gateId: DatasetQualityGate["gateId"],
    outcome: QualityOutcome,
    blocking: boolean,
    reasons: string[] = [],
  ) => gates.push({ gateId, outcome, blocking, reasons: Object.freeze(reasons.sort()) });
  const exampleFailure = examples.some((e) =>
    e.qualityGates.some((g) => g.blocking && g.outcome === "fail"),
  );
  for (const gateId of REQUIRED_QUALITY_GATES) {
    let outcome: QualityOutcome = "pass",
      reasons: string[] = [];
    if (
      [
        "schema_validity",
        "digest_integrity",
        "source_existence",
        "source_eligibility",
        "lineage_completeness",
        "target_support",
        "legal_compatibility",
        "grounding_completeness",
        "contradiction_preservation",
        "protected_evidence_policy",
        "consent_privacy",
        "review_requirement",
        "partition_validity",
        "version_compatibility",
        "deterministic_reconstruction",
      ].includes(gateId) &&
      exampleFailure
    ) {
      outcome = "fail";
      reasons = ["example_blocking_gate"];
    }
    if (gateId === "exact_duplicate_audit" && duplicates.conflictingDuplicateCount > 0) {
      outcome = "fail";
      reasons = ["conflicting_duplicate"];
    }
    if (gateId === "structural_duplicate_audit" && duplicates.structuralDuplicateCount > 0) {
      outcome = "warning";
      reasons = ["structural_duplicates_present"];
    }
    if (gateId === "leakage_audit" && leakage.blocking) {
      outcome = "fail";
      reasons = ["blocking_leakage"];
    }
    if (gateId === "class_balance" && examples.length === 0) {
      outcome = "warning";
      reasons = ["empty_dataset"];
    }
    add(gateId, outcome, outcome === "fail", reasons);
  }
  gates.sort((a, b) => (a.gateId < b.gateId ? -1 : 1));
  const eligible = !gates.some((g) => g.blocking && g.outcome !== "pass");
  const reportDigest = await sha256Hex(canonicalStringify(gates));
  return deepFreezeJson({
    gates,
    eligible,
    reportDigest,
  }) as unknown as Readonly<DatasetQualityReport>;
}
export function assertDatasetQuality(report: Readonly<DatasetQualityReport>): void {
  if (!report.eligible)
    failTraining("quality_gate_failed", "quality", "Dataset has blocking quality failures.");
}

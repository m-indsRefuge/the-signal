import { canonicalStringify, deepFreezeJson } from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import type { PartitionManifest } from "./partition-contract";
import type { TrainingExample } from "./training-example-contract";
export const AUDIT_OUTCOMES = Object.freeze([
  "pass",
  "warning",
  "fail",
  "unknown",
  "not_applicable",
] as const);
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];
export interface LeakageFinding {
  readonly findingId: string;
  readonly outcome: AuditOutcome;
  readonly class:
    | "lineage_overlap"
    | "group_overlap"
    | "evaluation_target_leakage"
    | "version_boundary_leakage"
    | "test_contamination";
  readonly exampleIds: readonly string[];
}
export interface LeakageAuditReport {
  readonly findings: readonly LeakageFinding[];
  readonly blocking: boolean;
  readonly reportDigest: string;
}
export async function auditLeakage(
  examples: readonly Readonly<TrainingExample>[],
  manifest: Readonly<PartitionManifest>,
): Promise<Readonly<LeakageAuditReport>> {
  const assignment = new Map(manifest.assignments.map((a) => [a.lineageFamilyId, a.partition]));
  const groups = new Map<string, { partition: string; ids: string[] }>();
  const findings: LeakageFinding[] = [];
  for (const ex of examples) {
    const partition = assignment.get(ex.lineageFamilyId) ?? "quarantine";
    for (const group of ex.partitionGroupIds) {
      const current = groups.get(group);
      if (
        current &&
        current.partition !== partition &&
        partition !== "quarantine" &&
        current.partition !== "quarantine"
      )
        findings.push({
          findingId: `group:${group}`,
          outcome: "fail",
          class: "group_overlap",
          exampleIds: Object.freeze([...current.ids, ex.exampleId].sort()),
        });
      else if (!current) groups.set(group, { partition, ids: [ex.exampleId] });
      else current.ids.push(ex.exampleId);
    }
    if (partition === "train" && ex.acceptanceLabels.includes("test_only"))
      findings.push({
        findingId: `test:${ex.exampleId}`,
        outcome: "fail",
        class: "test_contamination",
        exampleIds: Object.freeze([ex.exampleId]),
      });
    if (partition === "train" && ex.rejectionLabels.includes("evaluation_target"))
      findings.push({
        findingId: `evaluation:${ex.exampleId}`,
        outcome: "fail",
        class: "evaluation_target_leakage",
        exampleIds: Object.freeze([ex.exampleId]),
      });
  }
  const unique = [...new Map(findings.map((f) => [f.findingId, f])).values()].sort((a, b) =>
    a.findingId < b.findingId ? -1 : 1,
  );
  const blocking = unique.some((f) => f.outcome === "fail");
  const reportDigest = await sha256Hex(canonicalStringify(unique));
  return deepFreezeJson({
    findings: unique,
    blocking,
    reportDigest,
  }) as unknown as Readonly<LeakageAuditReport>;
}

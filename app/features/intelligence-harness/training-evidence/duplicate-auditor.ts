import { canonicalStringify, deepFreezeJson } from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import type { TrainingExample } from "./training-example-contract";
export const DUPLICATE_CLASSIFICATIONS = Object.freeze([
  "unique",
  "exact_duplicate",
  "conflicting_duplicate",
  "structural_duplicate",
] as const);
export type DuplicateClassification = (typeof DUPLICATE_CLASSIFICATIONS)[number];
export interface DuplicateAuditEntry {
  readonly exampleId: string;
  readonly classification: DuplicateClassification;
  readonly relatedExampleIds: readonly string[];
  readonly structuralDigest: string;
}
export interface DuplicateAuditReport {
  readonly entries: readonly DuplicateAuditEntry[];
  readonly exactDuplicateCount: number;
  readonly conflictingDuplicateCount: number;
  readonly structuralDuplicateCount: number;
  readonly relatedReferenceLimit: number;
  readonly reportDigest: string;
}
const MAX_RELATED_REFERENCES = 32;
function targetValue(example: Readonly<TrainingExample>): unknown {
  if (example.target) return example.target.value;
  return [example.preferredTarget!.value, example.dispreferredTarget!.value];
}
function structuralValue(example: Readonly<TrainingExample>): unknown {
  return {
    kind: example.exampleKind,
    domainId: example.domainId,
    domainVersion: example.domainVersion,
    input: example.input,
    target: targetValue(example),
  };
}
export async function auditDuplicates(
  examples: readonly Readonly<TrainingExample>[],
): Promise<Readonly<DuplicateAuditReport>> {
  const byContent = new Map<string, string[]>(),
    byInput = new Map<string, { id: string; target: string }[]>(),
    byStructure = new Map<string, string[]>();
  const structures = new Map<string, string>();
  for (const ex of examples) {
    const content = ex.contentDigest;
    (byContent.get(content) ?? (byContent.set(content, []), byContent.get(content)!)).push(
      ex.exampleId,
    );
    const input = await sha256Hex(canonicalStringify(ex.input));
    const target = await sha256Hex(canonicalStringify(targetValue(ex)));
    (byInput.get(input) ?? (byInput.set(input, []), byInput.get(input)!)).push({
      id: ex.exampleId,
      target,
    });
    const structural = await sha256Hex(canonicalStringify(structuralValue(ex)));
    structures.set(ex.exampleId, structural);
    (
      byStructure.get(structural) ?? (byStructure.set(structural, []), byStructure.get(structural)!)
    ).push(ex.exampleId);
  }
  const entries: DuplicateAuditEntry[] = [];
  let exact = 0,
    conflicting = 0,
    structural = 0;
  for (const ex of examples) {
    const exactBucket = byContent.get(ex.contentDigest) ?? [];
    const exactDuplicate = exactBucket.length > 1;
    const exactIds = exactBucket
      .filter((id) => id !== ex.exampleId)
      .slice(0, MAX_RELATED_REFERENCES);
    const inputDigest = await sha256Hex(canonicalStringify(ex.input));
    const targetDigest = await sha256Hex(canonicalStringify(targetValue(ex)));
    const conflictIds = (byInput.get(inputDigest) ?? [])
      .filter((x) => x.id !== ex.exampleId && x.target !== targetDigest)
      .map((x) => x.id)
      .slice(0, MAX_RELATED_REFERENCES);
    const structureIds = (byStructure.get(structures.get(ex.exampleId)!) ?? [])
      .filter((id) => id !== ex.exampleId)
      .slice(0, MAX_RELATED_REFERENCES);
    let classification: DuplicateClassification = "unique",
      related: string[] = [];
    if (conflictIds.length) {
      classification = "conflicting_duplicate";
      related = conflictIds;
      conflicting++;
    } else if (exactDuplicate) {
      classification = "exact_duplicate";
      related = exactIds;
      exact++;
    } else if (structureIds.length) {
      classification = "structural_duplicate";
      related = structureIds;
      structural++;
    }
    entries.push(
      Object.freeze({
        exampleId: ex.exampleId,
        classification,
        relatedExampleIds: Object.freeze([...new Set(related)].sort()),
        structuralDigest: structures.get(ex.exampleId)!,
      }),
    );
  }
  entries.sort((a, b) => (a.exampleId < b.exampleId ? -1 : a.exampleId > b.exampleId ? 1 : 0));
  const reportDigest = await sha256Hex(canonicalStringify(entries));
  return deepFreezeJson({
    entries,
    exactDuplicateCount: exact,
    conflictingDuplicateCount: conflicting,
    structuralDuplicateCount: structural,
    relatedReferenceLimit: MAX_RELATED_REFERENCES,
    reportDigest,
  }) as unknown as Readonly<DuplicateAuditReport>;
}

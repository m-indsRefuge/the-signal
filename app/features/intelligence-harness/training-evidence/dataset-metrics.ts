import { deepFreezeJson } from "../memory-fabric/canonical-json";
import type { TrainingExample } from "./training-example-contract";
export interface DatasetMetrics {
  readonly totalExamples: number;
  readonly byKind: Readonly<Record<string, number>>;
  readonly byLabel: Readonly<Record<string, number>>;
  readonly byPartition: Readonly<Record<string, number>>;
  readonly byDomainVersion: Readonly<Record<string, number>>;
  readonly protectedExampleCount: number;
  readonly contradictionExampleCount: number;
}
export function calculateDatasetMetrics(
  examples: readonly Readonly<TrainingExample>[],
): Readonly<DatasetMetrics> {
  const byKind: Record<string, number> = {},
    byLabel: Record<string, number> = {},
    byPartition: Record<string, number> = {},
    byDomainVersion: Record<string, number> = {};
  let protectedExampleCount = 0,
    contradictionExampleCount = 0;
  for (const e of examples) {
    byKind[e.exampleKind] = (byKind[e.exampleKind] ?? 0) + 1;
    for (const l of [...e.acceptanceLabels, ...e.rejectionLabels])
      byLabel[l] = (byLabel[l] ?? 0) + 1;
    byPartition[e.partition] = (byPartition[e.partition] ?? 0) + 1;
    const dv = `${e.domainId}:${e.domainVersion}`;
    byDomainVersion[dv] = (byDomainVersion[dv] ?? 0) + 1;
    if (e.protectedSourceReferences.length) protectedExampleCount++;
    if (e.contradictionReferences.length) contradictionExampleCount++;
  }
  return deepFreezeJson({
    totalExamples: examples.length,
    byKind,
    byLabel,
    byPartition,
    byDomainVersion,
    protectedExampleCount,
    contradictionExampleCount,
  }) as unknown as Readonly<DatasetMetrics>;
}

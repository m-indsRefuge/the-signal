import type { DatasetPartition } from "./admission-contract";

export type PartitionWeights = Readonly<Record<DatasetPartition, number>>;

export type PartitionAssignment = Readonly<{
  partition: DatasetPartition;
  partitionFamilyId: string;
  policyId: string;
  policyVersion: string;
  basisPoint: number;
  digest: string;
}>;

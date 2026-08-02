import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
} from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failTraining, validateTrainingIdentity } from "./failures";
import type { DatasetPartition, TrainingExample } from "./training-example-contract";
export interface PartitionPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly trainBasisPoints: number;
  readonly validationBasisPoints: number;
  readonly testBasisPoints: number;
  readonly salt: string;
  readonly quarantineBlocked: boolean;
}
export interface PartitionAssignment {
  readonly lineageFamilyId: string;
  readonly groupIds: readonly string[];
  readonly partition: DatasetPartition;
  readonly assignmentDigest: string;
}
export interface PartitionManifest {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly assignments: readonly PartitionAssignment[];
  readonly manifestDigest: string;
}
export function validatePartitionPolicy(policy: Readonly<PartitionPolicy>): void {
  validateTrainingIdentity(policy.policyId, "policyId", "invalid_partition_policy", "partition");
  validateTrainingIdentity(
    policy.policyVersion,
    "policyVersion",
    "invalid_partition_policy",
    "partition",
  );
  const values = [policy.trainBasisPoints, policy.validationBasisPoints, policy.testBasisPoints];
  if (
    values.some((v) => !Number.isSafeInteger(v) || v < 0) ||
    values.reduce((a, b) => a + b, 0) !== 10000 ||
    policy.salt.length < 1
  )
    failTraining(
      "invalid_partition_policy",
      "partition",
      "Partition policy weights must total 10000.",
    );
}
export async function createPartitionManifest(
  policy: Readonly<PartitionPolicy>,
  assignments: readonly PartitionAssignment[],
): Promise<Readonly<PartitionManifest>> {
  validatePartitionPolicy(policy);
  const sorted = [...assignments].sort((a, b) =>
    a.lineageFamilyId < b.lineageFamilyId ? -1 : a.lineageFamilyId > b.lineageFamilyId ? 1 : 0,
  );
  const manifestDigest = await sha256Hex(
    canonicalStringify({
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      assignments: sorted,
    }),
  );
  return deepFreezeJson(
    canonicalizeJson({
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      assignments: sorted,
      manifestDigest,
    }),
  ) as unknown as Readonly<PartitionManifest>;
}
export function collectPartitionGroups(example: Readonly<TrainingExample>): readonly string[] {
  return Object.freeze(
    [...new Set([example.lineageFamilyId, ...example.partitionGroupIds])].sort(),
  );
}

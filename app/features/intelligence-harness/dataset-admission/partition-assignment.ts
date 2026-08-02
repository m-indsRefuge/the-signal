import { digestCanonical, immutableCopy } from "./admission-contract";
import type { FamilyIdentities } from "./family-identity";
import type { PartitionAssignment } from "./partition-contract";
import { validatePartitionPolicy, type PartitionPolicy } from "./partition-policy";

export function assignPartition(
  families: FamilyIdentities,
  policy: PartitionPolicy,
): PartitionAssignment {
  validatePartitionPolicy(policy);
  const seed = digestCanonical({
    partitionFamilyId: families.partitionFamilyId,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
  });
  const basisPoint = Number.parseInt(seed.slice(0, 8), 16) % 10_000;

  let cursor = 0;
  let partition: PartitionAssignment["partition"] = "holdout";
  for (const candidate of ["train", "validation", "test", "holdout"] as const) {
    cursor += policy.weights[candidate];
    if (basisPoint < cursor) {
      partition = candidate;
      break;
    }
  }

  const core = {
    partition,
    partitionFamilyId: families.partitionFamilyId,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    basisPoint,
  };
  return immutableCopy({
    ...core,
    digest: digestCanonical(core),
  }) as PartitionAssignment;
}

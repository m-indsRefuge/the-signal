import type { PartitionPolicy } from "../../intelligence-harness/training-evidence/partition-contract";
export function createKtsPartitionPolicy(salt: string): Readonly<PartitionPolicy> {
  return Object.freeze({
    policyId: "kts-lineage-partition",
    policyVersion: "1",
    trainBasisPoints: 8000,
    validationBasisPoints: 1000,
    testBasisPoints: 1000,
    salt,
    quarantineBlocked: true,
  });
}

import { requireSafeInteger } from "./admission-contract";
import { fail } from "./failures";
import type { PartitionWeights } from "./partition-contract";

export type PartitionPolicy = Readonly<{
  policyId: string;
  policyVersion: string;
  weights: PartitionWeights;
}>;

export const DEFAULT_PARTITION_POLICY: PartitionPolicy = Object.freeze({
  policyId: "kts-i4-k.partition",
  policyVersion: "1.0.0",
  weights: Object.freeze({
    train: 7_000,
    validation: 1_500,
    test: 1_000,
    holdout: 500,
  }),
});

export function validatePartitionPolicy(policy: PartitionPolicy): PartitionPolicy {
  let total = 0;
  for (const value of Object.values(policy.weights)) {
    total += requireSafeInteger(value, "partition weight", 0);
  }
  if (total !== 10_000) {
    fail("invalid_partition_weights", "partition weights must total 10,000 basis points");
  }
  return policy;
}

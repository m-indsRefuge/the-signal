import { sha256Hex } from "../memory-fabric/digest";
import { failTraining } from "./failures";
import {
  collectPartitionGroups,
  createPartitionManifest,
  validatePartitionPolicy,
  type PartitionAssignment,
  type PartitionManifest,
  type PartitionPolicy,
} from "./partition-contract";
import {
  createTrainingExample,
  type DatasetPartition,
  type TrainingExample,
} from "./training-example-contract";
function bucketFromDigest(digest: string): number {
  return Number.parseInt(digest.slice(0, 8), 16) % 10000;
}
function partitionForBucket(bucket: number, policy: Readonly<PartitionPolicy>): DatasetPartition {
  if (bucket < policy.trainBasisPoints) return "train";
  if (bucket < policy.trainBasisPoints + policy.validationBasisPoints) return "validation";
  return "test";
}
export async function assignExamplePartitions(
  examples: readonly Readonly<TrainingExample>[],
  policy: Readonly<PartitionPolicy>,
): Promise<Readonly<PartitionManifest>> {
  validatePartitionPolicy(policy);
  const groupToPartition = new Map<string, DatasetPartition>();
  const families = new Map<string, { groups: Set<string>; blocked: boolean }>();
  for (const example of examples) {
    const entry = families.get(example.lineageFamilyId) ?? {
      groups: new Set<string>(),
      blocked: false,
    };
    for (const group of collectPartitionGroups(example)) entry.groups.add(group);
    entry.blocked ||=
      example.partition === "quarantine" ||
      example.qualityGates.some((g) => g.blocking && g.outcome === "fail");
    families.set(example.lineageFamilyId, entry);
  }
  const assignments: PartitionAssignment[] = [];
  for (const familyId of [...families.keys()].sort()) {
    const entry = families.get(familyId)!;
    let partition: DatasetPartition;
    if (entry.blocked && policy.quarantineBlocked) partition = "quarantine";
    else {
      const digest = await sha256Hex(`${policy.salt}:${familyId}`);
      partition = partitionForBucket(bucketFromDigest(digest), policy);
    }
    for (const group of entry.groups) {
      const existing = groupToPartition.get(group);
      if (existing && existing !== partition)
        failTraining(
          "partition_collision",
          "partition",
          "A partition group spans multiple partitions.",
          { group },
        );
      groupToPartition.set(group, partition);
    }
    const assignmentDigest = await sha256Hex(
      `${policy.policyId}:${policy.policyVersion}:${familyId}:${partition}:${[...entry.groups].sort().join("|")}`,
    );
    assignments.push(
      Object.freeze({
        lineageFamilyId: familyId,
        groupIds: Object.freeze([...entry.groups].sort()),
        partition,
        assignmentDigest,
      }),
    );
  }
  return createPartitionManifest(policy, assignments);
}

export async function materializePartitionAssignments(
  examples: readonly Readonly<TrainingExample>[],
  manifest: Readonly<PartitionManifest>,
): Promise<readonly Readonly<TrainingExample>[]> {
  const byFamily = new Map(
    manifest.assignments.map((assignment) => [assignment.lineageFamilyId, assignment.partition]),
  );
  const output: Readonly<TrainingExample>[] = [];
  for (const example of examples) {
    const partition = byFamily.get(example.lineageFamilyId);
    if (!partition)
      failTraining("partition_group_missing", "partition", "Partition assignment is missing.", {
        lineageFamilyId: example.lineageFamilyId,
      });
    const { contentDigest: _contentDigest, ...draft } = example;
    void _contentDigest;
    output.push(await createTrainingExample({ ...draft, partition }));
  }
  return Object.freeze(output);
}

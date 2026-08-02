import {
  buildPreferencePair,
  type ExampleBuilderBase,
} from "../../intelligence-harness/training-evidence/training-example-builder";
import type { TrainingExample } from "../../intelligence-harness/training-evidence/training-example-contract";
import type { TargetRecord } from "../../intelligence-harness/training-evidence/target-contract";
export async function buildKtsProposalPreference(
  base: Readonly<ExampleBuilderBase>,
  preferred: Readonly<TargetRecord>,
  dispreferred: Readonly<TargetRecord>,
): Promise<Readonly<TrainingExample>> {
  return buildPreferencePair(base, preferred, dispreferred);
}

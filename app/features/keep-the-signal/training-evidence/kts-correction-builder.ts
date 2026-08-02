import type { JsonValue } from "../../intelligence-harness/memory-fabric/canonical-json";
import {
  buildCorrection,
  type ExampleBuilderBase,
} from "../../intelligence-harness/training-evidence/training-example-builder";
import type { TrainingExample } from "../../intelligence-harness/training-evidence/training-example-contract";
import type { TargetRecord } from "../../intelligence-harness/training-evidence/target-contract";
export async function buildKtsCorrection(
  base: Readonly<ExampleBuilderBase>,
  original: JsonValue,
  corrected: Readonly<TargetRecord>,
): Promise<Readonly<TrainingExample>> {
  return buildCorrection(base, original, corrected);
}

import type { JsonValue } from "../memory-fabric/canonical-json";
import { failTraining } from "./failures";
import {
  createTrainingExample,
  type TrainingExample,
  type TrainingExampleDraft,
} from "./training-example-contract";
import type { TargetRecord } from "./target-contract";
export type ExampleBuilderBase = Omit<
  TrainingExampleDraft,
  "exampleKind" | "target" | "preferredTarget" | "dispreferredTarget"
>;
export async function buildSupervisedTarget(
  base: Readonly<ExampleBuilderBase>,
  target: Readonly<TargetRecord>,
): Promise<Readonly<TrainingExample>> {
  return createTrainingExample({ ...base, exampleKind: "supervised_target", target });
}
export async function buildPreferencePair(
  base: Readonly<ExampleBuilderBase>,
  preferredTarget: Readonly<TargetRecord>,
  dispreferredTarget: Readonly<TargetRecord>,
): Promise<Readonly<TrainingExample>> {
  if (JSON.stringify(preferredTarget.value) === JSON.stringify(dispreferredTarget.value))
    failTraining("preference_not_established", "example", "Preference targets must differ.");
  return createTrainingExample({
    ...base,
    exampleKind: "preference_pair",
    preferredTarget,
    dispreferredTarget,
  });
}
export async function buildCorrection(
  base: Readonly<ExampleBuilderBase>,
  original: JsonValue,
  corrected: Readonly<TargetRecord>,
): Promise<Readonly<TrainingExample>> {
  return createTrainingExample({
    ...base,
    input: { context: base.input, original },
    exampleKind: "correction",
    target: corrected,
  });
}
export async function buildAbstention(
  base: Readonly<ExampleBuilderBase>,
  target: Readonly<TargetRecord>,
): Promise<Readonly<TrainingExample>> {
  if (target.label !== "abstained")
    failTraining("invalid_target", "example", "Abstention example requires an abstained target.");
  return createTrainingExample({ ...base, exampleKind: "abstention", target });
}
export async function buildRetrievalGrounding(
  base: Readonly<ExampleBuilderBase>,
  target: Readonly<TargetRecord>,
  includedEvidence: readonly string[],
): Promise<Readonly<TrainingExample>> {
  const allowed = new Set(includedEvidence);
  if (base.evidenceReferences.some((id) => !allowed.has(id)))
    failTraining(
      "target_ungrounded",
      "example",
      "Grounding references must be included in context.",
    );
  return createTrainingExample({ ...base, exampleKind: "retrieval_grounding", target });
}
export async function buildStrategyRouting(
  base: Readonly<ExampleBuilderBase>,
  target: Readonly<TargetRecord>,
): Promise<Readonly<TrainingExample>> {
  return createTrainingExample({ ...base, exampleKind: "strategy_routing", target });
}

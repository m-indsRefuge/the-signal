export const KTS_BASELINES = Object.freeze([
  "no_adviser",
  "rule_based_adviser",
  "base_model_without_retrieval",
  "base_model_with_retrieval",
  "fine_tuned_without_retrieval",
  "fine_tuned_with_retrieval",
] as const);
export type KtsBaseline = (typeof KTS_BASELINES)[number];
export interface KtsBaselineDefinition {
  readonly baselineId: KtsBaseline;
  readonly description: string;
  readonly usesRetrieval: boolean;
  readonly usesFineTunedAdapter: boolean;
}
export function createKtsBaselineDefinitions(): readonly Readonly<KtsBaselineDefinition>[] {
  return Object.freeze(
    KTS_BASELINES.map((b) =>
      Object.freeze({
        baselineId: b,
        description: b.replaceAll("_", " "),
        usesRetrieval: b.endsWith("with_retrieval"),
        usesFineTunedAdapter: b.startsWith("fine_tuned"),
      }),
    ),
  );
}

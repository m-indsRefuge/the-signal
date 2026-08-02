import {
  digestCanonical,
  immutableCopy,
  requireFiniteNumber,
  requireSafeInteger,
  sortText,
} from "./evaluation-contract";

export type GenerationParameters = Readonly<{
  profileId: string;
  maximumContextTokens: number;
  maximumGeneratedTokens: number;
  seed: number;
  temperature: number;
  topP: number;
  topK: number;
  minimumP?: number;
  repetitionPenalty: number;
  stopSequences: readonly string[];
  batchSize: number;
  threadCount: number;
  gpuOffloadMode: string;
  flashAttention: "enabled" | "disabled" | "unknown";
  structuredOutputMode: string;
  thinkingMode: "enabled" | "disabled" | "unsupported" | "unknown";
  timeoutMilliseconds: number;
  profileDigest: string;
}>;

export function createGenerationParameters(
  input: Omit<GenerationParameters, "profileDigest">,
): GenerationParameters {
  requireSafeInteger(input.maximumContextTokens, "maximumContextTokens", 1, 1_000_000);
  requireSafeInteger(input.maximumGeneratedTokens, "maximumGeneratedTokens", 1, 1_000_000);
  requireSafeInteger(input.seed, "seed", 0);
  requireFiniteNumber(input.temperature, "temperature", 0, 10);
  requireFiniteNumber(input.topP, "topP", 0, 1);
  requireSafeInteger(input.topK, "topK", 0, 1_000_000);
  if (typeof input.minimumP === "number") {
    requireFiniteNumber(input.minimumP, "minimumP", 0, 1);
  }
  requireFiniteNumber(input.repetitionPenalty, "repetitionPenalty", 0, 10);
  requireSafeInteger(input.batchSize, "batchSize", 1, 65_536);
  requireSafeInteger(input.threadCount, "threadCount", 1, 1_024);
  requireSafeInteger(input.timeoutMilliseconds, "timeoutMilliseconds", 1, 86_400_000);
  const core = {
    ...input,
    stopSequences: sortText(input.stopSequences),
  };
  return immutableCopy({
    ...core,
    profileDigest: digestCanonical(core),
  }) as GenerationParameters;
}

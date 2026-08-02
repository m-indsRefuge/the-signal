import { digestCanonical, immutableCopy } from "./evaluation-contract";
import type { RawResponseEnvelope } from "./response-contract";

export type PerformanceMetrics = Readonly<{
  promptTokens: number | "unknown";
  generatedTokens: number | "unknown";
  totalTokens: number | "unknown";
  timeToFirstTokenMilliseconds: number | "unknown";
  totalDurationMilliseconds: number | "unknown";
  tokensPerSecond: number | "unknown";
  peakGpuMemoryMiB: number | "unknown";
  peakSystemMemoryMiB: number | "unknown";
  metricDigest: string;
}>;

export function calculatePerformanceMetrics(response: RawResponseEnvelope): PerformanceMetrics {
  const promptTokens = response.promptTokens ?? "unknown";
  const generatedTokens = response.generatedTokens ?? "unknown";
  const totalTokens =
    typeof promptTokens === "number" && typeof generatedTokens === "number"
      ? promptTokens + generatedTokens
      : "unknown";
  const totalDurationMilliseconds = response.totalDurationMilliseconds ?? "unknown";
  const tokensPerSecond =
    typeof generatedTokens === "number" &&
    typeof totalDurationMilliseconds === "number" &&
    totalDurationMilliseconds > 0
      ? generatedTokens / (totalDurationMilliseconds / 1_000)
      : "unknown";
  const core = {
    promptTokens,
    generatedTokens,
    totalTokens,
    timeToFirstTokenMilliseconds: response.timeToFirstTokenMilliseconds ?? "unknown",
    totalDurationMilliseconds,
    tokensPerSecond,
    peakGpuMemoryMiB: response.peakGpuMemoryMiB ?? "unknown",
    peakSystemMemoryMiB: response.peakSystemMemoryMiB ?? "unknown",
  };
  return immutableCopy({
    ...core,
    metricDigest: digestCanonical(core),
  }) as PerformanceMetrics;
}

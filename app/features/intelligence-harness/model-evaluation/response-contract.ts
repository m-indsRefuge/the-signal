import {
  ABSENT_EVALUATION_AUTHORITY,
  digestCanonical,
  immutableCopy,
  requireIdentity,
  requireSafeInteger,
  serializedLength,
  sortText,
} from "./evaluation-contract";
import { fail } from "./failures";

export const MAX_RAW_RESPONSE_CHARACTERS = 1_048_576;

export type FinishReason =
  "stop" | "length" | "cancelled" | "timeout" | "runtime_error" | "unknown";

export type RawResponseEnvelope = Readonly<{
  responseId: string;
  invocationId: string;
  candidateIdentity: string;
  artifactId: string;
  runtimeId: string;
  rawText: string;
  rawDigest: string;
  responseProtocolId: string;
  finishReason: FinishReason;
  promptTokens?: number;
  generatedTokens?: number;
  totalDurationMilliseconds?: number;
  timeToFirstTokenMilliseconds?: number;
  peakGpuMemoryMiB?: number;
  peakSystemMemoryMiB?: number;
  runtimeWarnings: readonly string[];
  truncated: boolean;
  cancelled: boolean;
  timedOut: boolean;
  limitations: readonly string[];
  authority: typeof ABSENT_EVALUATION_AUTHORITY;
  envelopeDigest: string;
}>;

export function createRawResponseEnvelope(
  input: Omit<RawResponseEnvelope, "rawDigest" | "authority" | "envelopeDigest">,
): RawResponseEnvelope {
  for (const [label, value] of [
    ["responseId", input.responseId],
    ["invocationId", input.invocationId],
    ["candidateIdentity", input.candidateIdentity],
    ["artifactId", input.artifactId],
    ["runtimeId", input.runtimeId],
    ["responseProtocolId", input.responseProtocolId],
  ] as const)
    requireIdentity(value, label);
  if (input.rawText.length > MAX_RAW_RESPONSE_CHARACTERS) {
    fail("raw_response_budget_exceeded", "raw response budget exceeded");
  }
  for (const [label, value] of [
    ["promptTokens", input.promptTokens],
    ["generatedTokens", input.generatedTokens],
    ["totalDurationMilliseconds", input.totalDurationMilliseconds],
    ["timeToFirstTokenMilliseconds", input.timeToFirstTokenMilliseconds],
    ["peakGpuMemoryMiB", input.peakGpuMemoryMiB],
    ["peakSystemMemoryMiB", input.peakSystemMemoryMiB],
  ] as const) {
    if (typeof value === "number") requireSafeInteger(value, label);
  }
  const core = {
    ...input,
    rawDigest: digestCanonical(input.rawText),
    runtimeWarnings: sortText(input.runtimeWarnings),
    limitations: sortText(input.limitations),
    authority: ABSENT_EVALUATION_AUTHORITY,
  };
  if (serializedLength(core) > 2_097_152) {
    fail("serialized_size_exceeded", "response envelope budget exceeded");
  }
  return immutableCopy({
    ...core,
    envelopeDigest: digestCanonical(core),
  }) as RawResponseEnvelope;
}

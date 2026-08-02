import { digestCanonical, immutableCopy, sortText } from "./evaluation-contract";
import type { RawResponseEnvelope } from "./response-contract";
import { normalizeOutput, type NormalizationPolicy } from "./output-normalizer";

export type ParseState =
  | "parsed"
  | "schema_rejected"
  | "malformed"
  | "empty"
  | "truncated"
  | "cancelled"
  | "timed_out"
  | "runtime_failed"
  | "unknown";

export type ParsedResponse = Readonly<{
  responseId: string;
  state: ParseState;
  normalizedText: string;
  normalizedDigest: string;
  object?: Readonly<Record<string, unknown>>;
  reasonCodes: readonly string[];
  limitations: readonly string[];
  parseDigest: string;
}>;

export function parseResponse(
  envelope: RawResponseEnvelope,
  policy: NormalizationPolicy,
): ParsedResponse {
  const normalizedText = normalizeOutput(envelope.rawText, policy);
  let state: ParseState = "parsed";
  const reasons: string[] = [];
  let object: Record<string, unknown> | undefined;

  if (envelope.cancelled) state = "cancelled";
  else if (envelope.timedOut) state = "timed_out";
  else if (envelope.finishReason === "runtime_error") state = "runtime_failed";
  else if (envelope.truncated) state = "truncated";
  else if (normalizedText.length === 0) state = "empty";
  else {
    try {
      const parsed = JSON.parse(normalizedText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        state = "schema_rejected";
        reasons.push("top_level_object_required");
      } else {
        object = parsed as Record<string, unknown>;
      }
    } catch {
      state = "malformed";
      reasons.push("invalid_json");
    }
  }

  const core = {
    responseId: envelope.responseId,
    state,
    normalizedText,
    normalizedDigest: digestCanonical(normalizedText),
    object,
    reasonCodes: sortText(reasons),
    limitations: sortText(envelope.limitations),
  };
  return immutableCopy({
    ...core,
    parseDigest: digestCanonical(core),
  }) as ParsedResponse;
}

import { describe, expect, it } from "vitest";
import {
  auditRepeatability,
  createBaselineRun,
  createRawResponseEnvelope,
  evaluateParsedResponse,
  parseResponse,
} from "../app/features/intelligence-harness/model-evaluation";

function run(index = 0, rawText = '{"kind":"proposal","actions":[]}') {
  const response = createRawResponseEnvelope({
    responseId: `response-${index}`,
    invocationId: `invocation-${index}`,
    candidateIdentity: "example/model@abc",
    artifactId: "artifact",
    runtimeId: "llama.cpp",
    rawText,
    responseProtocolId: "json",
    finishReason: "stop",
    promptTokens: 10,
    generatedTokens: 5,
    totalDurationMilliseconds: 1000,
    runtimeWarnings: [],
    truncated: false,
    cancelled: false,
    timedOut: false,
    limitations: [],
  });
  const parsed = parseResponse(response, {
    unicodeForm: "NFC",
    removeSingleCodeFence: true,
    trimSurroundingWhitespace: true,
  });
  const validator = evaluateParsedResponse(parsed, () => ({
    schemaAccepted: true,
    legalActionAccepted: true,
    accepted: true,
    reasonCodes: [],
  }));
  return createBaselineRun({
    runId: `run-${index}`,
    caseId: "case",
    candidateIdentity: response.candidateIdentity,
    artifactId: response.artifactId,
    runtimeId: response.runtimeId,
    response,
    parsed,
    validator,
    limitations: [],
  });
}

describe("repeatability audit", () => {
  it("reports unknown for one run", () => {
    expect(auditRepeatability([run()]).state).toBe("unknown");
  });
  it("reports stable for identical outputs", () => {
    expect(auditRepeatability([run(1), run(2)]).state).toBe("stable");
  });
  for (let index = 0; index < 54; index += 1) {
    it(`keeps repeatability deterministic ${index}`, () => {
      expect(auditRepeatability([run(index * 2), run(index * 2 + 1)]).auditDigest).toHaveLength(32);
    });
  }
});

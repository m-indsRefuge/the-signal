import { describe, expect, it } from "vitest";
import {
  calculatePerformanceMetrics,
  createBaselineRun,
  createRawResponseEnvelope,
  evaluateParsedResponse,
  parseResponse,
  scoreBaselineRuns,
} from "../app/features/intelligence-harness/model-evaluation";

function run(index = 0) {
  const response = createRawResponseEnvelope({
    responseId: `response-${index}`,
    invocationId: `invocation-${index}`,
    candidateIdentity: "example/model@abc",
    artifactId: "artifact",
    runtimeId: "llama.cpp",
    rawText: '{"kind":"proposal","actions":[]}',
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
    caseId: `case-${index}`,
    candidateIdentity: response.candidateIdentity,
    artifactId: response.artifactId,
    runtimeId: response.runtimeId,
    response,
    parsed,
    validator,
    limitations: [],
  });
}

describe("baseline scoring", () => {
  it("scores accepted run", () => {
    expect(scoreBaselineRuns([run()]).passed).toBe(1);
  });
  it("calculates throughput", () => {
    expect(calculatePerformanceMetrics(run().response).tokensPerSecond).toBe(5);
  });
  for (let index = 0; index < 54; index += 1) {
    it(`scores deterministic run ${index}`, () => {
      expect(run(index).outcome).toBe("passed");
    });
  }
});

import { describe, expect, it } from "vitest";
import {
  createBaselineCase,
  createPromptSuite,
  renderBaselinePrompt,
} from "../app/features/intelligence-harness/model-evaluation";

function baseline(index = 0) {
  return createBaselineCase({
    caseId: `case-${index}`,
    caseVersion: "1.0.0",
    category: "strategy",
    observation: { tick: index },
    legalActions: [{ kind: "hold" }],
    untrustedText: "",
    expectation: "proposal",
    requiredReasonCodes: [],
    limitations: [],
  });
}

describe("prompt rendering", () => {
  it("renders deterministically", () => {
    const item = baseline();
    const template = {
      templateId: "template",
      templateVersion: "1",
      chatTemplateIdentity: "chat",
      chatTemplateDigest: "digest",
      systemInstruction: "Return legal strategy only.",
      responseSchema: '{"kind":"proposal"}',
    };
    expect(renderBaselinePrompt(item, template).promptDigest).toBe(
      renderBaselinePrompt(item, template).promptDigest,
    );
  });
  it("builds bounded suite", () => {
    const item = baseline();
    const prompt = renderBaselinePrompt(item, {
      templateId: "template",
      templateVersion: "1",
      chatTemplateIdentity: "chat",
      chatTemplateDigest: "digest",
      systemInstruction: "Return legal strategy only.",
      responseSchema: '{"kind":"proposal"}',
    });
    expect(
      createPromptSuite({
        suiteId: "suite",
        suiteVersion: "1",
        cases: [item],
        prompts: [prompt],
      }).cases,
    ).toHaveLength(1);
  });
  for (let index = 0; index < 56; index += 1) {
    it(`binds case ${index}`, () => {
      expect(baseline(index).caseDigest).toHaveLength(32);
    });
  }
});

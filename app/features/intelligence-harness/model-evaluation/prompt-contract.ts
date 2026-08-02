import {
  digestCanonical,
  immutableCopy,
  requireIdentity,
  serializedLength,
} from "./evaluation-contract";
import { fail } from "./failures";
import type { BaselineCase } from "./baseline-case";

export const MAX_PROMPT_CHARACTERS = 1_048_576;

export type PromptMessage = Readonly<{
  role: "system" | "user" | "assistant";
  content: string;
}>;

export type RenderedPrompt = Readonly<{
  promptId: string;
  templateId: string;
  templateVersion: string;
  chatTemplateIdentity: string;
  chatTemplateDigest: string;
  caseId: string;
  caseDigest: string;
  systemInstruction: string;
  observationProjection: unknown;
  legalActionSet: readonly unknown[];
  requestedResponseSchema: string;
  abstentionInstruction: string;
  noExecutionInstruction: string;
  messages: readonly PromptMessage[];
  renderedText?: string;
  suppliedTokenCount?: number;
  limitations: readonly string[];
  promptDigest: string;
}>;

export function createRenderedPrompt(input: Omit<RenderedPrompt, "promptDigest">): RenderedPrompt {
  for (const [label, value] of [
    ["promptId", input.promptId],
    ["templateId", input.templateId],
    ["templateVersion", input.templateVersion],
    ["chatTemplateIdentity", input.chatTemplateIdentity],
    ["chatTemplateDigest", input.chatTemplateDigest],
    ["caseId", input.caseId],
    ["caseDigest", input.caseDigest],
    ["systemInstruction", input.systemInstruction],
    ["requestedResponseSchema", input.requestedResponseSchema],
    ["abstentionInstruction", input.abstentionInstruction],
    ["noExecutionInstruction", input.noExecutionInstruction],
  ] as const)
    requireIdentity(value, label);
  const core = {
    ...input,
    legalActionSet: [...input.legalActionSet],
    messages: [...input.messages],
    limitations: [...input.limitations].sort(),
  };
  if (serializedLength(core) > MAX_PROMPT_CHARACTERS) {
    fail("prompt_budget_exceeded", "prompt budget exceeded");
  }
  return immutableCopy({
    ...core,
    promptDigest: digestCanonical(core),
  }) as RenderedPrompt;
}

export function renderBaselinePrompt(
  baselineCase: BaselineCase,
  template: Readonly<{
    templateId: string;
    templateVersion: string;
    chatTemplateIdentity: string;
    chatTemplateDigest: string;
    systemInstruction: string;
    responseSchema: string;
  }>,
): RenderedPrompt {
  const userContent = JSON.stringify({
    observation: baselineCase.observation,
    legalActions: baselineCase.legalActions,
    untrustedText: baselineCase.untrustedText,
  });
  return createRenderedPrompt({
    promptId: `${template.templateId}:${baselineCase.caseId}`,
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    chatTemplateIdentity: template.chatTemplateIdentity,
    chatTemplateDigest: template.chatTemplateDigest,
    caseId: baselineCase.caseId,
    caseDigest: baselineCase.caseDigest,
    systemInstruction: template.systemInstruction,
    observationProjection: baselineCase.observation,
    legalActionSet: baselineCase.legalActions,
    requestedResponseSchema: template.responseSchema,
    abstentionInstruction: "Return an explicit abstention when evidence is insufficient.",
    noExecutionInstruction: "Do not execute, queue, or claim authority to execute actions.",
    messages: [
      { role: "system", content: template.systemInstruction },
      { role: "user", content: userContent },
    ],
    renderedText: `${template.systemInstruction}\n${userContent}`,
    limitations: [],
  });
}

import { digestCanonical, immutableCopy, requireIdentity } from "./evaluation-contract";
import type { BaselineCase } from "./baseline-case";
import type { RenderedPrompt } from "./prompt-contract";

export type PromptSuite = Readonly<{
  suiteId: string;
  suiteVersion: string;
  cases: readonly BaselineCase[];
  prompts: readonly RenderedPrompt[];
  suiteDigest: string;
}>;

export function createPromptSuite(input: Omit<PromptSuite, "suiteDigest">): PromptSuite {
  requireIdentity(input.suiteId, "suiteId");
  requireIdentity(input.suiteVersion, "suiteVersion");
  if (input.cases.length > 1_000) throw new Error("baseline case budget exceeded");
  const core = {
    ...input,
    cases: [...input.cases].sort((a, b) =>
      a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0,
    ),
    prompts: [...input.prompts].sort((a, b) =>
      a.promptId < b.promptId ? -1 : a.promptId > b.promptId ? 1 : 0,
    ),
  };
  return immutableCopy({
    ...core,
    suiteDigest: digestCanonical(core),
  }) as PromptSuite;
}

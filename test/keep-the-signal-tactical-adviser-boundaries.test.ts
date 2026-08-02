import adviserContractSource from "../app/features/intelligence-harness/tactical-adviser/adviser-contract.ts?raw";
import adviserCoordinatorSource from "../app/features/intelligence-harness/tactical-adviser/adviser-coordinator.ts?raw";
import contextBuilderSource from "../app/features/intelligence-harness/tactical-adviser/context-builder.ts?raw";
import contextContractSource from "../app/features/intelligence-harness/tactical-adviser/context-contract.ts?raw";
import evaluationAggregatorSource from "../app/features/intelligence-harness/tactical-adviser/evaluation-aggregator.ts?raw";
import evaluationContractSource from "../app/features/intelligence-harness/tactical-adviser/evaluation-contract.ts?raw";
import failuresSource from "../app/features/intelligence-harness/tactical-adviser/failures.ts?raw";
import coreIndexSource from "../app/features/intelligence-harness/tactical-adviser/index.ts?raw";
import proposalContractSource from "../app/features/intelligence-harness/tactical-adviser/proposal-contract.ts?raw";
import strategyContractSource from "../app/features/intelligence-harness/tactical-adviser/strategy-contract.ts?raw";
import strategyPortfolioSource from "../app/features/intelligence-harness/tactical-adviser/strategy-portfolio.ts?raw";
import ktsAdviserAdapterSource from "../app/features/keep-the-signal/tactical-adviser/kts-adviser-adapter.ts?raw";
import ktsAdviserEvidenceSource from "../app/features/keep-the-signal/tactical-adviser/kts-adviser-evidence.ts?raw";
import ktsIndexSource from "../app/features/keep-the-signal/tactical-adviser/index.ts?raw";
import ktsModelContextSource from "../app/features/keep-the-signal/tactical-adviser/kts-model-context.ts?raw";
import ktsProposalContractSource from "../app/features/keep-the-signal/tactical-adviser/kts-proposal-contract.ts?raw";
import ktsProposalValidatorSource from "../app/features/keep-the-signal/tactical-adviser/kts-proposal-validator.ts?raw";
import ktsRuleBasedAdviserSource from "../app/features/keep-the-signal/tactical-adviser/kts-rule-based-adviser.ts?raw";
import ktsStrategyPortfolioSource from "../app/features/keep-the-signal/tactical-adviser/kts-strategy-portfolio.ts?raw";

import { describe, expect, it } from "vitest";

import {
  ADVISER_RESULT_CLASSIFICATIONS,
  SIGNAL_OFFICER_ADVISER_ROLE,
  StrategyPortfolio,
} from "../app/features/intelligence-harness/tactical-adviser";
import {
  KTS_BASELINE_STRATEGY_IDS,
  KTS_TACTICAL_PROPOSAL_SCHEMA_ID,
  KtsRuleBasedAdviser,
  KtsTacticalAdviser,
} from "../app/features/keep-the-signal/tactical-adviser";

const genericSources = Object.freeze([
  adviserContractSource,
  proposalContractSource,
  strategyContractSource,
  strategyPortfolioSource,
  contextContractSource,
  contextBuilderSource,
  adviserCoordinatorSource,
  evaluationContractSource,
  evaluationAggregatorSource,
  failuresSource,
  coreIndexSource,
] as const);

const ktsSources = Object.freeze([
  ktsProposalContractSource,
  ktsProposalValidatorSource,
  ktsStrategyPortfolioSource,
  ktsRuleBasedAdviserSource,
  ktsModelContextSource,
  ktsAdviserEvidenceSource,
  ktsAdviserAdapterSource,
  ktsIndexSource,
] as const);

const productionSources = Object.freeze([...genericSources, ...ktsSources] as const);

function productionText(): string {
  return productionSources.join("\n");
}

describe("KTS-I4-E tactical adviser static and repository boundaries", () => {
  it("keeps the transferable production file set exact", () => {
    expect(genericSources).toHaveLength(11);
  });

  it("keeps the KTS production file set exact", () => {
    expect(ktsSources).toHaveLength(8);
  });

  it("keeps the complete production file set at nineteen modules", () => {
    expect(productionSources).toHaveLength(19);
  });

  it("keeps the generic core independent of Keep the Signal", () => {
    expect(genericSources.join("\n")).not.toMatch(/features\/keep-the-signal|keep-the-signal\//);
  });

  it("uses only the accepted observation adapter from the KTS domain boundary", () => {
    expect(ktsSources.join("\n")).not.toMatch(/from\s+["'][^"']*\/engine(?:[/"'])/);
    expect(ktsSources.join("\n")).toContain("intelligence-adapter");
  });

  it("contains no React import", () => {
    expect(productionText()).not.toMatch(/from\s+["']react(?:-dom)?["']/);
  });

  it("contains no runtime import", () => {
    expect(productionText()).not.toMatch(/keep-the-signal\/runtime/);
  });

  it("contains no presentation import", () => {
    expect(productionText()).not.toMatch(/keep-the-signal\/presentation/);
  });

  it("contains no player import", () => {
    expect(productionText()).not.toMatch(/keep-the-signal\/player/);
  });

  it("contains no route or home import", () => {
    expect(productionText()).not.toMatch(/app\/routes|\/routes\/|\/home(?:[/"'])/);
  });

  it("contains no UI rendering API", () => {
    expect(productionText()).not.toMatch(/React\.createElement|\bcreateRoot\s*\(|\bdocument\./);
  });

  it("contains no package or tool-configuration dependency", () => {
    expect(productionText()).not.toMatch(
      /from\s+["'][^"']*(?:package\.json|wrangler|vite\.config|vitest\.config|tsconfig|worker-configuration)/,
    );
  });

  it("contains no direct gameplay step", () => {
    expect(productionText()).not.toMatch(/\bstepGame\s*\(|\brunSimulation\s*\(/);
  });

  it("contains no action-dispatch or player-control call", () => {
    expect(productionText()).not.toMatch(/\bdispatchAction\s*\(|\bapplyPlayerAction\s*\(/);
  });

  it.each([
    ["fetch", /\bfetch\s*\(/],
    ["XMLHttpRequest", /\bXMLHttpRequest\b/],
    ["WebSocket", /\bWebSocket\b/],
    ["EventSource", /\bEventSource\b/],
  ] as const)("contains no direct %s network API", (_name, pattern) => {
    expect(productionText()).not.toMatch(pattern);
  });

  it.each([
    ["localStorage", /\blocalStorage\b/],
    ["sessionStorage", /\bsessionStorage\b/],
    ["indexedDB", /\bindexedDB\b/],
    ["CacheStorage", /\bcaches\.(?:open|delete|match)\s*\(/],
  ] as const)("contains no direct %s persistence API", (_name, pattern) => {
    expect(productionText()).not.toMatch(pattern);
  });

  it.each([
    ["process environment", /\bprocess\.env\b/],
    ["Deno environment", /\bDeno\.env\b/],
    ["Bun environment", /\bBun\.env\b/],
    ["Cloudflare environment binding", /\benv\.(?:DB|AI|VECTORIZE|KV)\b/],
  ] as const)("contains no %s access", (_name, pattern) => {
    expect(productionText()).not.toMatch(pattern);
  });

  it.each([
    ["wall clock", /\bDate\.now\s*\(|\bperformance\.now\s*\(/],
    ["randomness", /\bMath\.random\s*\(|\bcrypto\.getRandomValues\s*\(/],
    ["dynamic evaluation", /\beval\s*\(|new\s+Function\s*\(/],
    ["console payload logging", /\bconsole\.(?:log|debug|info|warn|error)\s*\(/],
  ] as const)("contains no prohibited %s API", (_name, pattern) => {
    expect(productionText()).not.toMatch(pattern);
  });

  it("contains no provider SDK import", () => {
    expect(productionText()).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai\/sdk|@google\/generative-ai|ollama|@huggingface\/inference)["']/,
    );
  });

  it("contains no credential or endpoint literal", () => {
    expect(productionText()).not.toMatch(
      /(?:API_KEY|ACCESS_TOKEN|SECRET_KEY|Bearer\s+[A-Za-z0-9])/,
    );
    expect(productionText()).not.toMatch(/https?:\/\//);
  });

  it("contains no model installation or download command", () => {
    expect(productionText()).not.toMatch(/\b(?:pullModel|downloadModel|installModel)\s*\(/);
  });

  it("contains no analytics telemetry or background scheduling", () => {
    expect(productionText()).not.toMatch(
      /\b(?:trackAnalytics|sendTelemetry|setInterval|queueMicrotask)\s*\(/,
    );
  });

  it("contains no direct D1 query preparation", () => {
    expect(productionText()).not.toMatch(
      /\bD1Database\b|\.prepare\s*\(\s*["'`](?:SELECT|INSERT|UPDATE|DELETE)/i,
    );
  });

  it("contains no evidence repository write", () => {
    expect(productionText()).not.toMatch(/\.(?:writeEvidence|insertEvidence|persistEvidence)\s*\(/);
  });

  it("contains no memory update or delete API", () => {
    expect(productionText()).not.toMatch(
      /\.(?:writeMemory|updateMemory|deleteMemory|forgetMemory|consolidateMemory)\s*\(/,
    );
  });

  it("contains no strategy-promotion API", () => {
    expect(productionText()).not.toMatch(
      /\.(?:promoteStrategy|activateStrategy|setProductionStrategy)\s*\(/,
    );
  });

  it("contains no training or fine-tuning invocation", () => {
    expect(productionText()).not.toMatch(/\.(?:train|fineTune|createTrainingJob)\s*\(/);
  });

  it("invokes models only through the accepted bridge coordinator", () => {
    expect(adviserCoordinatorSource).toContain("ModelInvocationCoordinator");
    expect(adviserCoordinatorSource).toMatch(/this\.#bridge\.invoke\s*\(/);
    expect(productionText()).not.toMatch(/\bprovider\.(?:invoke|complete|generate)\s*\(/);
  });

  it("does not expose a strategy-promotion method on the portfolio", () => {
    expect(StrategyPortfolio.prototype).not.toHaveProperty("promoteStrategy");
    expect(StrategyPortfolio.prototype).not.toHaveProperty("activateStrategy");
  });

  it("exports the advisory Signal Officer role", () => {
    expect(SIGNAL_OFFICER_ADVISER_ROLE).toMatchObject({
      roleId: "signal_officer_tactical_adviser",
      supportsAbstention: true,
      requiresTypedSupport: true,
    });
    expect(SIGNAL_OFFICER_ADVISER_ROLE.prohibitedBehaviors).toContain("action_execution");
  });

  it("exports all result classifications through the generic boundary", () => {
    expect(ADVISER_RESULT_CLASSIFICATIONS).toEqual([
      "proposal",
      "abstention",
      "rejected",
      "failed",
      "cancelled",
      "deadline_exceeded",
    ]);
  });

  it("exports the exact eight initial KTS baseline strategies", () => {
    expect(KTS_BASELINE_STRATEGY_IDS).toHaveLength(8);
  });

  it("exports the strict KTS tactical proposal schema", () => {
    expect(KTS_TACTICAL_PROPOSAL_SCHEMA_ID).toBe("kts.tactical-proposal");
  });

  it("exports both deterministic and model adviser adapters", () => {
    expect(KtsRuleBasedAdviser).toBeTypeOf("function");
    expect(KtsTacticalAdviser).toBeTypeOf("function");
  });
});

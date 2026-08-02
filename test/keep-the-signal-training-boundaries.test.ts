import core0 from "../app/features/intelligence-harness/training-evidence/curriculum-contract.ts?raw";
import core1 from "../app/features/intelligence-harness/training-evidence/curriculum-planner.ts?raw";
import core2 from "../app/features/intelligence-harness/training-evidence/dataset-compiler.ts?raw";
import core3 from "../app/features/intelligence-harness/training-evidence/dataset-contract.ts?raw";
import core4 from "../app/features/intelligence-harness/training-evidence/dataset-metrics.ts?raw";
import core5 from "../app/features/intelligence-harness/training-evidence/distillation-contract.ts?raw";
import core6 from "../app/features/intelligence-harness/training-evidence/distillation-planner.ts?raw";
import core7 from "../app/features/intelligence-harness/training-evidence/duplicate-auditor.ts?raw";
import core8 from "../app/features/intelligence-harness/training-evidence/export-contract.ts?raw";
import core9 from "../app/features/intelligence-harness/training-evidence/failures.ts?raw";
import core10 from "../app/features/intelligence-harness/training-evidence/index.ts?raw";
import core11 from "../app/features/intelligence-harness/training-evidence/leakage-auditor.ts?raw";
import core12 from "../app/features/intelligence-harness/training-evidence/partition-contract.ts?raw";
import core13 from "../app/features/intelligence-harness/training-evidence/partitioner.ts?raw";
import core14 from "../app/features/intelligence-harness/training-evidence/quality-gates.ts?raw";
import core15 from "../app/features/intelligence-harness/training-evidence/source-contract.ts?raw";
import core16 from "../app/features/intelligence-harness/training-evidence/target-contract.ts?raw";
import core17 from "../app/features/intelligence-harness/training-evidence/training-example-builder.ts?raw";
import core18 from "../app/features/intelligence-harness/training-evidence/training-example-contract.ts?raw";
import kts0 from "../app/features/keep-the-signal/training-evidence/index.ts?raw";
import kts1 from "../app/features/keep-the-signal/training-evidence/kts-correction-builder.ts?raw";
import kts2 from "../app/features/keep-the-signal/training-evidence/kts-distillation-plan.ts?raw";
import kts3 from "../app/features/keep-the-signal/training-evidence/kts-example-contract.ts?raw";
import kts4 from "../app/features/keep-the-signal/training-evidence/kts-example-projector.ts?raw";
import kts5 from "../app/features/keep-the-signal/training-evidence/kts-partition-policy.ts?raw";
import kts6 from "../app/features/keep-the-signal/training-evidence/kts-preference-builder.ts?raw";
import { describe, expect, it } from "vitest";
const coreSources = Object.freeze([
  core0,
  core1,
  core2,
  core3,
  core4,
  core5,
  core6,
  core7,
  core8,
  core9,
  core10,
  core11,
  core12,
  core13,
  core14,
  core15,
  core16,
  core17,
  core18,
] as const);
const ktsSources = Object.freeze([kts0, kts1, kts2, kts3, kts4, kts5, kts6] as const);
const productionSources = Object.freeze([...coreSources, ...ktsSources] as const);
const text = () => productionSources.join("\n");
const focusedTests = Object.freeze([
  "intelligence-training-curriculum.test.ts",
  "intelligence-training-dataset-compiler.test.ts",
  "intelligence-training-distillation.test.ts",
  "intelligence-training-example-builder.test.ts",
  "intelligence-training-example-contract.test.ts",
  "intelligence-training-leakage-auditor.test.ts",
  "intelligence-training-partitioner.test.ts",
  "intelligence-training-quality-gates.test.ts",
  "keep-the-signal-training-evidence.test.ts",
  "keep-the-signal-training-boundaries.test.ts",
] as const);
describe("KTS-I4-G source boundaries", () => {
  it("has exactly 19 transferable modules", () => expect(coreSources).toHaveLength(19));
  it("has exactly 7 KTS modules", () => expect(ktsSources).toHaveLength(7));
  it("has exactly 26 production modules", () => expect(productionSources).toHaveLength(26));
  it("has exactly ten focused tests", () => expect(focusedTests).toHaveLength(10));
  it("keeps transferable core independent of KTS", () =>
    expect(coreSources.join("\n")).not.toMatch(/keep-the-signal/));
  it("contains no prohibited pattern \\bfetch\\s*\\(", () =>
    expect(text()).not.toMatch(/\bfetch\s*\(/));
  it("contains no prohibited pattern \\bXMLHttpRequest\\b", () =>
    expect(text()).not.toMatch(/\bXMLHttpRequest\b/));
  it("contains no prohibited pattern \\bWebSocket\\b", () =>
    expect(text()).not.toMatch(/\bWebSocket\b/));
  it("contains no prohibited pattern \\blocalStorage\\b", () =>
    expect(text()).not.toMatch(/\blocalStorage\b/));
  it("contains no prohibited pattern \\bsessionStorage\\b", () =>
    expect(text()).not.toMatch(/\bsessionStorage\b/));
  it("contains no prohibited pattern \\bindexedDB\\b", () =>
    expect(text()).not.toMatch(/\bindexedDB\b/));
  it("contains no prohibited pattern \\bprocess\\.env\\b", () =>
    expect(text()).not.toMatch(/\bprocess\.env\b/));
  it("contains no prohibited pattern \\bDeno\\.env\\b", () =>
    expect(text()).not.toMatch(/\bDeno\.env\b/));
  it("contains no prohibited pattern \\bBun\\.env\\b", () =>
    expect(text()).not.toMatch(/\bBun\.env\b/));
  it("contains no prohibited pattern \\beval\\s*\\(", () =>
    expect(text()).not.toMatch(/\beval\s*\(/));
  it("contains no prohibited pattern \\bnew\\s+Function\\b", () =>
    expect(text()).not.toMatch(/\bnew\s+Function\b/));
  it("contains no prohibited pattern \\bDate\\.now\\s*\\(", () =>
    expect(text()).not.toMatch(/\bDate\.now\s*\(/));
  it("contains no prohibited pattern \\bperformance\\.now\\s*\\(", () =>
    expect(text()).not.toMatch(/\bperformance\.now\s*\(/));
  it("contains no prohibited pattern \\bMath\\.random\\s*\\(", () =>
    expect(text()).not.toMatch(/\bMath\.random\s*\(/));
  it("contains no prohibited pattern \\bcrypto\\.getRandomValues\\s*\\(", () =>
    expect(text()).not.toMatch(/\bcrypto\.getRandomValues\s*\(/));
  it("contains no prohibited pattern node:fs", () => expect(text()).not.toMatch(/node:fs/));
  it("contains no prohibited pattern node:path", () => expect(text()).not.toMatch(/node:path/));
  it("contains no prohibited pattern child_process", () =>
    expect(text()).not.toMatch(/child_process/));
  it("contains no provider SDK", () =>
    expect(text()).not.toMatch(
      /from\s+["'](?:openai|@anthropic-ai|@google|ollama|transformers|torch|tensorflow)/,
    ));
  it("contains no endpoint literal", () => expect(text()).not.toMatch(/https?:\/\//));
  it("contains no D1 access", () => expect(text()).not.toMatch(/\bD1Database\b|\.prepare\s*\(/));
  it("contains no dataset write", () =>
    expect(text()).not.toMatch(/\b(?:writeDataset|uploadDataset|persistExample)\s*\(/));
  it("contains no training execution", () =>
    expect(text()).not.toMatch(
      /export\s+(?:async\s+)?function\s+(?:train|fineTune|fit|optimize|backpropagate)/,
    ));
  it("contains no model invocation", () =>
    expect(text()).not.toMatch(/\b(?:invokeTeacher|invokeStudent|provider\.invoke)\s*\(/));
  it("contains no promotion", () =>
    expect(text()).not.toMatch(/\b(?:promoteDataset|promoteModel|deployAdapter)\s*\(/));
  it("contains no runtime imports", () =>
    expect(text()).not.toMatch(/\/runtime\/|\/engine\/|\/presentation\/|\/player\/|\/routes\//));
  it("contains no React import", () => expect(text()).not.toMatch(/from\s+["']react/));
  it("source contract exposes read operations only", () => {
    const s = core15;
    expect(s).toContain("getSource(");
    expect(s).toContain("listSources(");
    expect(s).not.toContain("putSource(");
  });
  it("result remains candidate terminology", () => {
    expect(text()).toContain("validation_candidate");
    expect(text()).not.toContain("training_complete");
  });
});

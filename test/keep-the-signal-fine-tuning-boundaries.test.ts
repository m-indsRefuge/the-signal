import { describe, expect, it } from "vitest";
import source0 from "../app/features/intelligence-harness/fine-tuning/failures.ts?raw";
import source1 from "../app/features/intelligence-harness/fine-tuning/experiment-contract.ts?raw";
import source2 from "../app/features/intelligence-harness/fine-tuning/base-model-contract.ts?raw";
import source3 from "../app/features/intelligence-harness/fine-tuning/dataset-approval-contract.ts?raw";
import source4 from "../app/features/intelligence-harness/fine-tuning/training-method-contract.ts?raw";
import source5 from "../app/features/intelligence-harness/fine-tuning/hyperparameter-contract.ts?raw";
import source6 from "../app/features/intelligence-harness/fine-tuning/environment-contract.ts?raw";
import source7 from "../app/features/intelligence-harness/fine-tuning/resource-budget.ts?raw";
import source8 from "../app/features/intelligence-harness/fine-tuning/training-plan.ts?raw";
import source9 from "../app/features/intelligence-harness/fine-tuning/lineage-contract.ts?raw";
import source10 from "../app/features/intelligence-harness/fine-tuning/run-contract.ts?raw";
import source11 from "../app/features/intelligence-harness/fine-tuning/checkpoint-contract.ts?raw";
import source12 from "../app/features/intelligence-harness/fine-tuning/adapter-contract.ts?raw";
import source13 from "../app/features/intelligence-harness/fine-tuning/metrics-contract.ts?raw";
import source14 from "../app/features/intelligence-harness/fine-tuning/evaluation-plan.ts?raw";
import source15 from "../app/features/intelligence-harness/fine-tuning/baseline-comparison.ts?raw";
import source16 from "../app/features/intelligence-harness/fine-tuning/regression-gates.ts?raw";
import source17 from "../app/features/intelligence-harness/fine-tuning/promotion-gates.ts?raw";
import source18 from "../app/features/intelligence-harness/fine-tuning/experiment-controller.ts?raw";
import source19 from "../app/features/intelligence-harness/fine-tuning/index.ts?raw";
import source20 from "../app/features/keep-the-signal/fine-tuning/kts-training-plan.ts?raw";
import source21 from "../app/features/keep-the-signal/fine-tuning/kts-evaluation-suite.ts?raw";
import source22 from "../app/features/keep-the-signal/fine-tuning/kts-baseline-contract.ts?raw";
import source23 from "../app/features/keep-the-signal/fine-tuning/kts-adapter-candidate.ts?raw";
import source24 from "../app/features/keep-the-signal/fine-tuning/kts-metric-projection.ts?raw";
import source25 from "../app/features/keep-the-signal/fine-tuning/index.ts?raw";
const sources = [
  { path: "app/features/intelligence-harness/fine-tuning/failures.ts", text: source0 },
  { path: "app/features/intelligence-harness/fine-tuning/experiment-contract.ts", text: source1 },
  { path: "app/features/intelligence-harness/fine-tuning/base-model-contract.ts", text: source2 },
  {
    path: "app/features/intelligence-harness/fine-tuning/dataset-approval-contract.ts",
    text: source3,
  },
  {
    path: "app/features/intelligence-harness/fine-tuning/training-method-contract.ts",
    text: source4,
  },
  {
    path: "app/features/intelligence-harness/fine-tuning/hyperparameter-contract.ts",
    text: source5,
  },
  { path: "app/features/intelligence-harness/fine-tuning/environment-contract.ts", text: source6 },
  { path: "app/features/intelligence-harness/fine-tuning/resource-budget.ts", text: source7 },
  { path: "app/features/intelligence-harness/fine-tuning/training-plan.ts", text: source8 },
  { path: "app/features/intelligence-harness/fine-tuning/lineage-contract.ts", text: source9 },
  { path: "app/features/intelligence-harness/fine-tuning/run-contract.ts", text: source10 },
  { path: "app/features/intelligence-harness/fine-tuning/checkpoint-contract.ts", text: source11 },
  { path: "app/features/intelligence-harness/fine-tuning/adapter-contract.ts", text: source12 },
  { path: "app/features/intelligence-harness/fine-tuning/metrics-contract.ts", text: source13 },
  { path: "app/features/intelligence-harness/fine-tuning/evaluation-plan.ts", text: source14 },
  { path: "app/features/intelligence-harness/fine-tuning/baseline-comparison.ts", text: source15 },
  { path: "app/features/intelligence-harness/fine-tuning/regression-gates.ts", text: source16 },
  { path: "app/features/intelligence-harness/fine-tuning/promotion-gates.ts", text: source17 },
  {
    path: "app/features/intelligence-harness/fine-tuning/experiment-controller.ts",
    text: source18,
  },
  { path: "app/features/intelligence-harness/fine-tuning/index.ts", text: source19 },
  { path: "app/features/keep-the-signal/fine-tuning/kts-training-plan.ts", text: source20 },
  { path: "app/features/keep-the-signal/fine-tuning/kts-evaluation-suite.ts", text: source21 },
  { path: "app/features/keep-the-signal/fine-tuning/kts-baseline-contract.ts", text: source22 },
  { path: "app/features/keep-the-signal/fine-tuning/kts-adapter-candidate.ts", text: source23 },
  { path: "app/features/keep-the-signal/fine-tuning/kts-metric-projection.ts", text: source24 },
  { path: "app/features/keep-the-signal/fine-tuning/index.ts", text: source25 },
];
const transferable = sources.filter((s) => s.path.includes("intelligence-harness"));
const kts = sources.filter((s) => s.path.includes("keep-the-signal"));
describe("KTS-I4-H source boundaries", () => {
  it("has exactly 20 transferable modules", () => expect(transferable).toHaveLength(20));
  it("has exactly 6 KTS modules", () => expect(kts).toHaveLength(6));
  it("has exactly 26 production modules", () => expect(sources).toHaveLength(26));
  const patterns = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bindexedDB\b/,
    /\bprocess\.env\b/,
    /\bDeno\.env\b/,
    /\bBun\.env\b/,
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
    /\bDate\.now\s*\(/,
    /\bperformance\.now\s*\(/,
    /\bMath\.random\s*\(/,
    /\bcrypto\.getRandomValues\s*\(/,
    /node:fs/,
    /node:path/,
    /child_process/,
  ];
  for (const pattern of patterns)
    it(`contains no prohibited pattern ${pattern.source}`, () =>
      expect(sources.some((s) => pattern.test(s.text))).toBe(false));
  for (const fragment of [
    "huggingface",
    "transformers",
    "torch",
    "tensorflow",
    "wrangler",
    "react",
    "D1Database",
  ])
    it(`contains no prohibited dependency ${fragment}`, () =>
      expect(sources.some((s) => s.text.includes(`from "${fragment}`))).toBe(false));
  for (const capability of [
    "downloadModel(",
    "uploadModel(",
    "uploadDataset(",
    "invokeModel(",
    "deployAdapter(",
    "promoteAdapter(",
    "executeProposal(",
  ])
    it(`contains no executable capability ${capability}`, () =>
      expect(sources.some((s) => s.text.includes(capability))).toBe(false));
  it("controller contains no training execution method", () =>
    expect(sources.find((s) => s.path.endsWith("experiment-controller.ts"))?.text).not.toMatch(
      /\b(?:train|fineTune|fit|backpropagate)\s*\(/,
    ));
  it("result terminology remains experimental", () =>
    expect(sources.some((s) => /production_model|deployed_model/.test(s.text))).toBe(false));
});

import { describe, expect, it } from "vitest";
import source0 from "../app/features/intelligence-harness/planning/failures.ts?raw";
import source1 from "../app/features/intelligence-harness/planning/planner-contract.ts?raw";
import source2 from "../app/features/intelligence-harness/planning/planning-request.ts?raw";
import source3 from "../app/features/intelligence-harness/planning/search-budget.ts?raw";
import source4 from "../app/features/intelligence-harness/planning/legal-action-port.ts?raw";
import source5 from "../app/features/intelligence-harness/planning/simulation-port.ts?raw";
import source6 from "../app/features/intelligence-harness/planning/candidate-contract.ts?raw";
import source7 from "../app/features/intelligence-harness/planning/candidate-digest.ts?raw";
import source8 from "../app/features/intelligence-harness/planning/score-contract.ts?raw";
import source9 from "../app/features/intelligence-harness/planning/score-policy.ts?raw";
import source10 from "../app/features/intelligence-harness/planning/risk-policy.ts?raw";
import source11 from "../app/features/intelligence-harness/planning/beam-contract.ts?raw";
import source12 from "../app/features/intelligence-harness/planning/beam-search.ts?raw";
import source13 from "../app/features/intelligence-harness/planning/tie-break-policy.ts?raw";
import source14 from "../app/features/intelligence-harness/planning/plan-contract.ts?raw";
import source15 from "../app/features/intelligence-harness/planning/planner-result.ts?raw";
import source16 from "../app/features/intelligence-harness/planning/planner-metrics.ts?raw";
import source17 from "../app/features/intelligence-harness/planning/planner-evaluation.ts?raw";
import source18 from "../app/features/intelligence-harness/planning/planner-controller.ts?raw";
import source19 from "../app/features/intelligence-harness/planning/index.ts?raw";
import source20 from "../app/features/keep-the-signal/planning/kts-planning-observation.ts?raw";
import source21 from "../app/features/keep-the-signal/planning/kts-legal-action-projection.ts?raw";
import source22 from "../app/features/keep-the-signal/planning/kts-simulation-contract.ts?raw";
import source23 from "../app/features/keep-the-signal/planning/kts-score-policy.ts?raw";
import source24 from "../app/features/keep-the-signal/planning/kts-proposal-projector.ts?raw";
import source25 from "../app/features/keep-the-signal/planning/index.ts?raw";

const transferableSources = [
  source0,
  source1,
  source2,
  source3,
  source4,
  source5,
  source6,
  source7,
  source8,
  source9,
  source10,
  source11,
  source12,
  source13,
  source14,
  source15,
  source16,
  source17,
  source18,
  source19,
] as const;

const ktsSources = [source20, source21, source22, source23, source24, source25] as const;

const productionSources = [...transferableSources, ...ktsSources] as const;
const source = productionSources.join("\n");

describe("KTS-I4-I planning boundaries", () => {
  it("has exactly 20 transferable modules", () => expect(transferableSources).toHaveLength(20));

  it("has exactly 6 KTS modules", () => expect(ktsSources).toHaveLength(6));

  it("has exactly 26 production modules", () => expect(productionSources).toHaveLength(26));

  const prohibited = [
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
    /setTimeout\s*\(/,
    /setInterval\s*\(/,
    /huggingface/i,
    /transformers/i,
    /torch/i,
    /tensorflow/i,
    /wrangler/i,
    /from\s+["']react["']/,
    /D1Database/,
  ];

  for (const pattern of prohibited) {
    it(`contains no prohibited pattern ${pattern.source}`, () =>
      expect(source).not.toMatch(pattern));
  }

  const executable = [
    "executeAction(",
    "applyAction(",
    "mutateState(",
    "runGame(",
    "train(",
    "fineTune(",
    "invokeModel(",
    "downloadModel(",
    "uploadDataset(",
    "deployPlanner(",
    "promotePlanner(",
  ];

  for (const capability of executable) {
    it(`contains no executable capability ${capability}`, () =>
      expect(source).not.toContain(capability));
  }

  it("contains no runtime activation terminology", () =>
    expect(source).not.toContain("runtime_active"));

  it("contains no training-data writer", () =>
    expect(source).not.toContain("writeTrainingDataset"));

  it("proposal projector requires validation", () =>
    expect(source).toContain("requiresProposalValidation"));

  it("planner result declares no execution", () => expect(source).toContain("noExecution"));
});

import source0 from "../app/features/intelligence-harness/demonstrations/failures.ts?raw";
import source1 from "../app/features/intelligence-harness/demonstrations/demonstration-contract.ts?raw";
import source2 from "../app/features/intelligence-harness/demonstrations/evidence-digest.ts?raw";
import source3 from "../app/features/intelligence-harness/demonstrations/source-lineage.ts?raw";
import source4 from "../app/features/intelligence-harness/demonstrations/evidence-target.ts?raw";
import source5 from "../app/features/intelligence-harness/demonstrations/evidence-input.ts?raw";
import source6 from "../app/features/intelligence-harness/demonstrations/quality-policy.ts?raw";
import source7 from "../app/features/intelligence-harness/demonstrations/risk-classification.ts?raw";
import source8 from "../app/features/intelligence-harness/demonstrations/evidence-record.ts?raw";
import source9 from "../app/features/intelligence-harness/demonstrations/reconstruction-contract.ts?raw";
import source10 from "../app/features/intelligence-harness/demonstrations/reconstruction-evaluator.ts?raw";
import source11 from "../app/features/intelligence-harness/demonstrations/duplicate-contract.ts?raw";
import source12 from "../app/features/intelligence-harness/demonstrations/duplicate-detector.ts?raw";
import source13 from "../app/features/intelligence-harness/demonstrations/review-contract.ts?raw";
import source14 from "../app/features/intelligence-harness/demonstrations/review-record.ts?raw";
import source15 from "../app/features/intelligence-harness/demonstrations/quarantine-contract.ts?raw";
import source16 from "../app/features/intelligence-harness/demonstrations/quarantine-ledger.ts?raw";
import source17 from "../app/features/intelligence-harness/demonstrations/admission-boundary.ts?raw";
import source18 from "../app/features/intelligence-harness/demonstrations/batch-contract.ts?raw";
import source19 from "../app/features/intelligence-harness/demonstrations/evidence-metrics.ts?raw";
import source20 from "../app/features/intelligence-harness/demonstrations/batch-builder.ts?raw";
import source21 from "../app/features/intelligence-harness/demonstrations/evidence-controller.ts?raw";
import source22 from "../app/features/intelligence-harness/demonstrations/index.ts?raw";
import source23 from "../app/features/keep-the-signal/demonstrations/kts-demonstration-source.ts?raw";
import source24 from "../app/features/keep-the-signal/demonstrations/kts-plan-evidence-projector.ts?raw";
import source25 from "../app/features/keep-the-signal/demonstrations/kts-validator-evidence.ts?raw";
import source26 from "../app/features/keep-the-signal/demonstrations/kts-quality-policy.ts?raw";
import source27 from "../app/features/keep-the-signal/demonstrations/kts-reconstruction-adapter.ts?raw";
import source28 from "../app/features/keep-the-signal/demonstrations/kts-demonstration-controller.ts?raw";
import source29 from "../app/features/keep-the-signal/demonstrations/index.ts?raw";
import { describe, expect, it } from "vitest";

const productionSources = [
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
  source20,
  source21,
  source22,
  source23,
  source24,
  source25,
  source26,
  source27,
  source28,
  source29,
] as const;
const source = productionSources.join("\n");

describe("KTS-I4-J capability boundaries", () => {
  const prohibited = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
    /node:fs/,
    /node:path/,
    /\bprocess\.env\b/,
    /\bDate\.now\s*\(/,
    /\bMath\.random\s*\(/,
    /\bcrypto\.getRandomValues\s*\(/,
    /\blocaleCompare\s*\(/,
    /\bsetTimeout\s*\(/,
    /\bsetInterval\s*\(/,
    /D1Database/,
    /indexedDB/,
    /localStorage/,
    /sessionStorage/,
    /huggingface/i,
    /transformers/i,
    /tensorflow/i,
    /\btorch\b/i,
    /from\s+["']react["']/,
    /wrangler/i,
  ];
  for (const [index, pattern] of prohibited.entries()) {
    it(`omits prohibited capability ${index}`, () => expect(source).not.toMatch(pattern));
  }
  const executableCapabilities = [
    "executeAction(",
    "applyAction(",
    "mutateState(",
    "runGame(",
    "invokeModel(",
    "downloadModel(",
    "trainModel(",
    "fineTune(",
    "persistEvidence(",
    "exportDataset(",
    "admitDataset(",
    "deploy(",
  ];
  for (const capability of executableCapabilities) {
    it(`omits executable capability ${capability}`, () => expect(source).not.toContain(capability));
  }
  for (let index = 0; index < 15; index += 1) {
    it(`preserves advisory boundary ${index}`, () => {
      expect(source).toContain("actionExecuted: false");
      expect(source).toContain("trainingAdmission");
      expect(source).toContain("datasetAdmission");
    });
  }
  it("has exact production module count", () => expect(productionSources).toHaveLength(30));
});

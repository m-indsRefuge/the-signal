import { describe, expect, it } from "vitest";
import source0 from "../app/features/intelligence-harness/dataset-admission/admission-contract.ts?raw";
import source1 from "../app/features/intelligence-harness/dataset-admission/admission-controller.ts?raw";
import source2 from "../app/features/intelligence-harness/dataset-admission/admission-decision.ts?raw";
import source3 from "../app/features/intelligence-harness/dataset-admission/admission-metrics.ts?raw";
import source4 from "../app/features/intelligence-harness/dataset-admission/admission-request.ts?raw";
import source5 from "../app/features/intelligence-harness/dataset-admission/audit-contract.ts?raw";
import source6 from "../app/features/intelligence-harness/dataset-admission/decision-digest.ts?raw";
import source7 from "../app/features/intelligence-harness/dataset-admission/deduplication-policy.ts?raw";
import source8 from "../app/features/intelligence-harness/dataset-admission/eligibility-policy.ts?raw";
import source9 from "../app/features/intelligence-harness/dataset-admission/evidence-eligibility.ts?raw";
import source10 from "../app/features/intelligence-harness/dataset-admission/failures.ts?raw";
import source11 from "../app/features/intelligence-harness/dataset-admission/family-identity.ts?raw";
import source12 from "../app/features/intelligence-harness/dataset-admission/index.ts?raw";
import source13 from "../app/features/intelligence-harness/dataset-admission/leakage-contract.ts?raw";
import source14 from "../app/features/intelligence-harness/dataset-admission/leakage-detector.ts?raw";
import source15 from "../app/features/intelligence-harness/dataset-admission/manifest-builder.ts?raw";
import source16 from "../app/features/intelligence-harness/dataset-admission/manifest-contract.ts?raw";
import source17 from "../app/features/intelligence-harness/dataset-admission/manifest-digest.ts?raw";
import source18 from "../app/features/intelligence-harness/dataset-admission/partition-assignment.ts?raw";
import source19 from "../app/features/intelligence-harness/dataset-admission/partition-contract.ts?raw";
import source20 from "../app/features/intelligence-harness/dataset-admission/partition-policy.ts?raw";
import source21 from "../app/features/intelligence-harness/dataset-admission/sample-contract.ts?raw";
import source22 from "../app/features/intelligence-harness/dataset-admission/sample-digest.ts?raw";
import source23 from "../app/features/intelligence-harness/dataset-admission/sample-projector.ts?raw";
import source24 from "../app/features/intelligence-harness/dataset-admission/sample-role.ts?raw";
import source25 from "../app/features/keep-the-signal/dataset-admission/index.ts?raw";
import source26 from "../app/features/keep-the-signal/dataset-admission/kts-admission-controller.ts?raw";
import source27 from "../app/features/keep-the-signal/dataset-admission/kts-admission-source.ts?raw";
import source28 from "../app/features/keep-the-signal/dataset-admission/kts-leakage-policy.ts?raw";
import source29 from "../app/features/keep-the-signal/dataset-admission/kts-partition-family.ts?raw";
import source30 from "../app/features/keep-the-signal/dataset-admission/kts-sample-projector.ts?raw";
import source31 from "../app/features/keep-the-signal/dataset-admission/kts-sample-role-policy.ts?raw";

const sources = [
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
  source30,
  source31,
];
const combined = sources.join("\n");

describe("KTS-I4-K static boundaries", () => {
  it("loads exactly 32 production modules", () => {
    expect(sources).toHaveLength(32);
  });
  it("retains export authority boundary", () => {
    expect(combined).toContain("exportAuthorization");
  });
  it("retains training authority boundary", () => {
    expect(combined).toContain("trainingAuthorization");
  });
  it("retains no framework binding", () => {
    expect(combined).toContain("frameworkBinding");
  });
  const prohibited = [
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "node:fs",
    "process.env",
    "Date.now(",
    "Math.random(",
    "setTimeout(",
    "setInterval(",
    "localeCompare(",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "D1Database",
    "R2Bucket",
    "KVNamespace",
    "invokeModel(",
    "downloadModel(",
    "trainModel(",
    "fineTune(",
    "exportDataset(",
    "persistDataset(",
    "tokenize(",
    "deploy(",
    "executeAction(",
    "applyAction(",
    "mutateState(",
    "runGame(",
    'from "react"',
    "from 'react'",
    "tensorflow",
    "torch",
    "transformers",
    "huggingface",
    "wrangler",
    "child_process",
    "new Function",
    "eval(",
    "crypto.getRandomValues(",
    "performance.now(",
    "Bun.env",
    "Deno.env",
    "JSONL",
  ];
  for (const pattern of prohibited) {
    it(`excludes ${pattern}`, () => {
      expect(combined).not.toContain(pattern);
    });
  }
});

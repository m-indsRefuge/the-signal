import { describe, expect, it } from "vitest";
import source0 from "../app/features/intelligence-harness/model-evaluation/artifact-contract.ts?raw";
import source1 from "../app/features/intelligence-harness/model-evaluation/baseline-case.ts?raw";
import source2 from "../app/features/intelligence-harness/model-evaluation/baseline-run.ts?raw";
import source3 from "../app/features/intelligence-harness/model-evaluation/baseline-score.ts?raw";
import source4 from "../app/features/intelligence-harness/model-evaluation/candidate-ranking.ts?raw";
import source5 from "../app/features/intelligence-harness/model-evaluation/comparison-contract.ts?raw";
import source6 from "../app/features/intelligence-harness/model-evaluation/determinism-audit.ts?raw";
import source7 from "../app/features/intelligence-harness/model-evaluation/evaluation-contract.ts?raw";
import source8 from "../app/features/intelligence-harness/model-evaluation/evaluation-controller.ts?raw";
import source9 from "../app/features/intelligence-harness/model-evaluation/failures.ts?raw";
import source10 from "../app/features/intelligence-harness/model-evaluation/generation-parameters.ts?raw";
import source11 from "../app/features/intelligence-harness/model-evaluation/hardware-policy.ts?raw";
import source12 from "../app/features/intelligence-harness/model-evaluation/hardware-snapshot.ts?raw";
import source13 from "../app/features/intelligence-harness/model-evaluation/index.ts?raw";
import source14 from "../app/features/intelligence-harness/model-evaluation/invocation-contract.ts?raw";
import source15 from "../app/features/intelligence-harness/model-evaluation/license-contract.ts?raw";
import source16 from "../app/features/intelligence-harness/model-evaluation/model-candidate-contract.ts?raw";
import source17 from "../app/features/intelligence-harness/model-evaluation/model-identity.ts?raw";
import source18 from "../app/features/intelligence-harness/model-evaluation/output-normalizer.ts?raw";
import source19 from "../app/features/intelligence-harness/model-evaluation/output-parser.ts?raw";
import source20 from "../app/features/intelligence-harness/model-evaluation/performance-metrics.ts?raw";
import source21 from "../app/features/intelligence-harness/model-evaluation/prompt-contract.ts?raw";
import source22 from "../app/features/intelligence-harness/model-evaluation/prompt-suite.ts?raw";
import source23 from "../app/features/intelligence-harness/model-evaluation/response-contract.ts?raw";
import source24 from "../app/features/intelligence-harness/model-evaluation/runtime-capability.ts?raw";
import source25 from "../app/features/intelligence-harness/model-evaluation/runtime-contract.ts?raw";
import source26 from "../app/features/intelligence-harness/model-evaluation/validator-bridge.ts?raw";
import source27 from "../app/features/keep-the-signal/model-evaluation/index.ts?raw";
import source28 from "../app/features/keep-the-signal/model-evaluation/kts-candidate-register.ts?raw";
import source29 from "../app/features/keep-the-signal/model-evaluation/kts-hardware-profile.ts?raw";
import source30 from "../app/features/keep-the-signal/model-evaluation/kts-observation-projector.ts?raw";
import source31 from "../app/features/keep-the-signal/model-evaluation/kts-prompt-suite.ts?raw";
import source32 from "../app/features/keep-the-signal/model-evaluation/kts-ranking-policy.ts?raw";
import source33 from "../app/features/keep-the-signal/model-evaluation/kts-response-parser.ts?raw";
import source34 from "../app/features/keep-the-signal/model-evaluation/kts-validator-bridge.ts?raw";

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
  source32,
  source33,
  source34,
];
const combined = sources.join("\n");

describe("KTS-I4-L static boundaries", () => {
  it("loads exactly 35 production modules", () => {
    expect(sources).toHaveLength(35);
  });
  it("retains absent model invocation authority", () => {
    expect(combined).toContain('modelInvocationAuthorization: "absent"');
  });
  it("retains absent training authority", () => {
    expect(combined).toContain('trainingAuthorization: "absent"');
  });
  it("retains no persistence", () => {
    expect(combined).toContain('persistence: "none"');
  });
  it("retains false action execution", () => {
    expect(combined).toContain("actionExecution: false");
  });
  const prohibited = [
    "fetch(",
    "XMLHttpRequest",
    "WebSocket",
    "EventSource",
    "node:fs",
    "node:child_process",
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
    "exec(",
    "spawn(",
    "nvidia-smi",
    "Get-CimInstance",
    "Get-WmiObject",
    "ollama run",
    "llama-cli",
    "llama-server",
    "downloadModel(",
    "invokeModel(",
    "installRuntime(",
    "exportDataset(",
    "persistDataset(",
    "trainModel(",
    "fineTune(",
    "tokenizeTrainingData(",
    "deploy(",
    "executeAction(",
    "applyAction(",
    'from "react"',
    "from 'react'",
    "tensorflow",
    "torch",
    "transformers",
    "wrangler",
    "crypto.getRandomValues(",
  ];
  for (const pattern of prohibited) {
    it(`excludes ${pattern}`, () => {
      expect(combined).not.toContain(pattern);
    });
  }

  const authorityMarkers = [
    'hostInspectionAuthorization: "absent"',
    'runtimeInstallationAuthorization: "absent"',
    'artifactAcquisitionAuthorization: "absent"',
    'modelInvocationAuthorization: "absent"',
    'modelSelectionAuthorization: "absent"',
    'datasetExportAuthorization: "absent"',
    'trainingAuthorization: "absent"',
  ];
  for (const marker of authorityMarkers) {
    it(`contains authority marker ${marker}`, () => {
      expect(combined).toContain(marker);
    });
  }
  const governanceTerms = [
    "selectionState",
    "licenseDigest",
    "artifactDigest",
    "runtimeDigest",
    "promptDigest",
    "validatorDigest",
    "recommendationDigest",
  ];
  for (const term of governanceTerms) {
    it(`contains governance term ${term}`, () => {
      expect(combined).toContain(term);
    });
  }
});

import abstractionContractSource from "../app/features/intelligence-harness/consolidation/abstraction-contract.ts?raw";
import clusterContractSource from "../app/features/intelligence-harness/consolidation/cluster-contract.ts?raw";
import consolidationCoordinatorSource from "../app/features/intelligence-harness/consolidation/consolidation-coordinator.ts?raw";
import consolidationValidatorSource from "../app/features/intelligence-harness/consolidation/consolidation-validator.ts?raw";
import deterministicClustererSource from "../app/features/intelligence-harness/consolidation/deterministic-clusterer.ts?raw";
import episodeSnapshotSource from "../app/features/intelligence-harness/consolidation/episode-snapshot.ts?raw";
import evidenceMatrixSource from "../app/features/intelligence-harness/consolidation/evidence-matrix.ts?raw";
import failuresSource from "../app/features/intelligence-harness/consolidation/failures.ts?raw";
import forgettingContractSource from "../app/features/intelligence-harness/consolidation/forgetting-contract.ts?raw";
import forgettingEvaluatorSource from "../app/features/intelligence-harness/consolidation/forgetting-evaluator.ts?raw";
import coreIndexSource from "../app/features/intelligence-harness/consolidation/index.ts?raw";
import preservationContractSource from "../app/features/intelligence-harness/consolidation/preservation-contract.ts?raw";
import retentionPolicySource from "../app/features/intelligence-harness/consolidation/retention-policy.ts?raw";
import selectionContractSource from "../app/features/intelligence-harness/consolidation/selection-contract.ts?raw";
import sourceContractSource from "../app/features/intelligence-harness/consolidation/source-contract.ts?raw";
import tombstoneContractSource from "../app/features/intelligence-harness/consolidation/tombstone-contract.ts?raw";
import ktsConsolidationAdapterSource from "../app/features/keep-the-signal/consolidation/kts-consolidation-adapter.ts?raw";
import ktsConsolidationFeaturesSource from "../app/features/keep-the-signal/consolidation/kts-consolidation-features.ts?raw";
import ktsConsolidationPolicySource from "../app/features/keep-the-signal/consolidation/kts-consolidation-policy.ts?raw";
import ktsForgettingProbesSource from "../app/features/keep-the-signal/consolidation/kts-forgetting-probes.ts?raw";
import ktsIndexSource from "../app/features/keep-the-signal/consolidation/index.ts?raw";
import clusteringTestSource from "./intelligence-consolidation-clustering.test.ts?raw";
import contractTestSource from "./intelligence-consolidation-contract.test.ts?raw";
import coordinatorTestSource from "./intelligence-consolidation-coordinator.test.ts?raw";
import evidenceMatrixTestSource from "./intelligence-consolidation-evidence-matrix.test.ts?raw";
import selectionTestSource from "./intelligence-consolidation-selection.test.ts?raw";
import validatorTestSource from "./intelligence-consolidation-validator.test.ts?raw";
import forgettingEvaluatorTestSource from "./intelligence-forgetting-evaluator.test.ts?raw";
import forgettingPolicyTestSource from "./intelligence-forgetting-policy.test.ts?raw";
import ktsAdapterTestSource from "./keep-the-signal-consolidation-adapter.test.ts?raw";

import { describe, expect, it } from "vitest";

const transferableSources = Object.freeze([
  ["app/features/intelligence-harness/consolidation/failures.ts", failuresSource],
  ["app/features/intelligence-harness/consolidation/source-contract.ts", sourceContractSource],
  ["app/features/intelligence-harness/consolidation/episode-snapshot.ts", episodeSnapshotSource],
  [
    "app/features/intelligence-harness/consolidation/selection-contract.ts",
    selectionContractSource,
  ],
  ["app/features/intelligence-harness/consolidation/cluster-contract.ts", clusterContractSource],
  [
    "app/features/intelligence-harness/consolidation/deterministic-clusterer.ts",
    deterministicClustererSource,
  ],
  [
    "app/features/intelligence-harness/consolidation/abstraction-contract.ts",
    abstractionContractSource,
  ],
  ["app/features/intelligence-harness/consolidation/evidence-matrix.ts", evidenceMatrixSource],
  [
    "app/features/intelligence-harness/consolidation/consolidation-validator.ts",
    consolidationValidatorSource,
  ],
  [
    "app/features/intelligence-harness/consolidation/preservation-contract.ts",
    preservationContractSource,
  ],
  ["app/features/intelligence-harness/consolidation/retention-policy.ts", retentionPolicySource],
  [
    "app/features/intelligence-harness/consolidation/forgetting-contract.ts",
    forgettingContractSource,
  ],
  [
    "app/features/intelligence-harness/consolidation/forgetting-evaluator.ts",
    forgettingEvaluatorSource,
  ],
  [
    "app/features/intelligence-harness/consolidation/tombstone-contract.ts",
    tombstoneContractSource,
  ],
  [
    "app/features/intelligence-harness/consolidation/consolidation-coordinator.ts",
    consolidationCoordinatorSource,
  ],
  ["app/features/intelligence-harness/consolidation/index.ts", coreIndexSource],
] as const);

const ktsSources = Object.freeze([
  [
    "app/features/keep-the-signal/consolidation/kts-consolidation-features.ts",
    ktsConsolidationFeaturesSource,
  ],
  [
    "app/features/keep-the-signal/consolidation/kts-consolidation-policy.ts",
    ktsConsolidationPolicySource,
  ],
  [
    "app/features/keep-the-signal/consolidation/kts-forgetting-probes.ts",
    ktsForgettingProbesSource,
  ],
  [
    "app/features/keep-the-signal/consolidation/kts-consolidation-adapter.ts",
    ktsConsolidationAdapterSource,
  ],
  ["app/features/keep-the-signal/consolidation/index.ts", ktsIndexSource],
] as const);

const productionSources = Object.freeze([...transferableSources, ...ktsSources] as const);

const focusedTests = Object.freeze([
  ["test/intelligence-consolidation-contract.test.ts", contractTestSource],
  ["test/intelligence-consolidation-selection.test.ts", selectionTestSource],
  ["test/intelligence-consolidation-clustering.test.ts", clusteringTestSource],
  ["test/intelligence-consolidation-evidence-matrix.test.ts", evidenceMatrixTestSource],
  ["test/intelligence-consolidation-validator.test.ts", validatorTestSource],
  ["test/intelligence-forgetting-policy.test.ts", forgettingPolicyTestSource],
  ["test/intelligence-forgetting-evaluator.test.ts", forgettingEvaluatorTestSource],
  ["test/intelligence-consolidation-coordinator.test.ts", coordinatorTestSource],
  ["test/keep-the-signal-consolidation-adapter.test.ts", ktsAdapterTestSource],
  ["test/keep-the-signal-consolidation-boundaries.test.ts", "executing-current-test"],
] as const);

function sourceText(entries: ReadonlyArray<readonly [string, string]>): string {
  return entries.map(([, source]) => source).join("\n");
}

function productionText(): string {
  return sourceText(productionSources);
}

describe("KTS-I4-F source boundaries", () => {
  it("has exactly 21 production files", () => {
    expect(productionSources).toHaveLength(21);
  });

  it("has exactly ten focused test files", () => {
    expect(focusedTests).toHaveLength(10);
  });

  it("matches the exact transferable production file set", () => {
    expect(transferableSources.map(([path]) => path).sort()).toEqual([
      "app/features/intelligence-harness/consolidation/abstraction-contract.ts",
      "app/features/intelligence-harness/consolidation/cluster-contract.ts",
      "app/features/intelligence-harness/consolidation/consolidation-coordinator.ts",
      "app/features/intelligence-harness/consolidation/consolidation-validator.ts",
      "app/features/intelligence-harness/consolidation/deterministic-clusterer.ts",
      "app/features/intelligence-harness/consolidation/episode-snapshot.ts",
      "app/features/intelligence-harness/consolidation/evidence-matrix.ts",
      "app/features/intelligence-harness/consolidation/failures.ts",
      "app/features/intelligence-harness/consolidation/forgetting-contract.ts",
      "app/features/intelligence-harness/consolidation/forgetting-evaluator.ts",
      "app/features/intelligence-harness/consolidation/index.ts",
      "app/features/intelligence-harness/consolidation/preservation-contract.ts",
      "app/features/intelligence-harness/consolidation/retention-policy.ts",
      "app/features/intelligence-harness/consolidation/selection-contract.ts",
      "app/features/intelligence-harness/consolidation/source-contract.ts",
      "app/features/intelligence-harness/consolidation/tombstone-contract.ts",
    ]);
  });

  it("matches the exact KTS production file set", () => {
    expect(ktsSources.map(([path]) => path).sort()).toEqual([
      "app/features/keep-the-signal/consolidation/index.ts",
      "app/features/keep-the-signal/consolidation/kts-consolidation-adapter.ts",
      "app/features/keep-the-signal/consolidation/kts-consolidation-features.ts",
      "app/features/keep-the-signal/consolidation/kts-consolidation-policy.ts",
      "app/features/keep-the-signal/consolidation/kts-forgetting-probes.ts",
    ]);
  });

  it("contains every focused test path", () => {
    expect(focusedTests.map(([path]) => path)).toEqual([
      "test/intelligence-consolidation-contract.test.ts",
      "test/intelligence-consolidation-selection.test.ts",
      "test/intelligence-consolidation-clustering.test.ts",
      "test/intelligence-consolidation-evidence-matrix.test.ts",
      "test/intelligence-consolidation-validator.test.ts",
      "test/intelligence-forgetting-policy.test.ts",
      "test/intelligence-forgetting-evaluator.test.ts",
      "test/intelligence-consolidation-coordinator.test.ts",
      "test/keep-the-signal-consolidation-adapter.test.ts",
      "test/keep-the-signal-consolidation-boundaries.test.ts",
    ]);
    for (const [, source] of focusedTests) expect(source.length).toBeGreaterThan(0);
  });

  const prohibitedExecutablePatterns = [
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
  ] as const;

  for (const pattern of prohibitedExecutablePatterns) {
    it(`contains no prohibited executable pattern ${pattern.source}`, () => {
      for (const [, source] of productionSources) expect(source).not.toMatch(pattern);
    });
  }

  const prohibitedImportFragments = [
    "/engine/",
    "/runtime/",
    "/presentation/",
    "/player/",
    "/routes/",
    "react",
    "wrangler",
    "d1-memory",
    "model-bridge",
  ] as const;

  for (const fragment of prohibitedImportFragments) {
    it(`contains no prohibited import fragment ${fragment}`, () => {
      for (const [, source] of productionSources) {
        const imports = source
          .split(/\r?\n/)
          .filter((line) => /^\s*import\b/.test(line))
          .join("\n")
          .toLowerCase();
        expect(imports).not.toContain(fragment);
      }
    });
  }

  it("the source contract exposes only read operations", () => {
    const interfaceBlock =
      sourceContractSource.match(
        /export interface ReadOnlyConsolidationSource \{([\s\S]*?)\n\}/,
      )?.[1] ?? "";
    expect(interfaceBlock).toContain("getEvidence(");
    expect(interfaceBlock).toContain("queryMemory(");
    expect(interfaceBlock).toContain("getMemoryAttachments(");
    expect(interfaceBlock).not.toContain("putEvidence(");
    expect(interfaceBlock).not.toContain("putMemory(");
    expect(interfaceBlock).not.toContain("attachEvidence(");
  });

  it("contains no repository write invocation", () => {
    expect(productionText()).not.toMatch(
      /\.\s*put(?:Evidence|EvidenceRelation|Memory|MemoryRelation|EpisodeBundle)\s*\(/,
    );
    expect(productionText()).not.toMatch(/\.\s*attachEvidence\s*\(/);
  });

  it("contains no mutation executor API", () => {
    expect(productionText()).not.toMatch(
      /export\s+(?:async\s+)?function\s+(?:executeArchive|executeDeletion|applyTombstone|purgeMemory)/,
    );
  });

  it("contains no strategy or memory promotion API", () => {
    expect(productionText()).not.toMatch(
      /export\s+(?:async\s+)?function\s+(?:promoteStrategy|promoteMemory|activateSemantic|activateProcedural)/,
    );
  });

  it("contains no provider SDK or endpoint literals", () => {
    const joined = productionText().toLowerCase();
    for (const token of ["openai", "anthropic", "gemini", "https://", "http://"]) {
      expect(joined).not.toContain(token);
    }
  });

  it("contains no embedding or vector capability", () => {
    const joined = productionText().toLowerCase();
    expect(joined).not.toMatch(/\bembedding(?:s)?\b/);
    expect(joined).not.toMatch(/\bvector(?:s|_database)?\b/);
  });

  it("contains no filesystem access in production", () => {
    expect(productionText()).not.toMatch(/node:fs|from\s+["']fs["']|require\(["']fs["']\)/);
  });

  it("contains no background scheduling", () => {
    expect(productionText()).not.toMatch(
      /\bsetInterval\s*\(|\bsetTimeout\s*\(|\bqueueMicrotask\s*\(/,
    );
  });

  it("contains no training or fine-tuning implementation", () => {
    expect(productionText()).not.toMatch(/\btrain(?:Model|Adapter|Weights)\s*\(/);
    expect(productionText()).not.toMatch(/\bfineTune\s*\(/);
  });

  it("contains no package or configuration dependency", () => {
    for (const [, source] of productionSources) {
      const imports = [...source.matchAll(/import[\s\S]*?from\s+["']([^"']+)["'];/g)].map(
        (match) => match[1] ?? "",
      );
      expect(
        imports.every((specifier) => specifier.startsWith("../") || specifier.startsWith("./")),
      ).toBe(true);
    }
  });

  it("the KTS adapter imports no engine execution", () => {
    for (const [, source] of ktsSources) {
      expect(source).not.toContain("stepGame");
      expect(source).not.toContain("runSimulation");
    }
  });

  it("the result is planning and evaluation only", () => {
    expect(consolidationCoordinatorSource).toContain("retentionDecisions");
    expect(consolidationCoordinatorSource).toContain("forgettingReport");
    expect(consolidationCoordinatorSource).not.toContain("executeDeletion");
  });
});

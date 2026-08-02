import { describe, expect, it } from "vitest";
import type { ConsolidationSnapshot } from "../app/features/intelligence-harness/consolidation/episode-snapshot";
import { createKtsConsolidationBuilders } from "../app/features/keep-the-signal/consolidation/kts-consolidation-adapter";
import {
  KTS_CONSOLIDATION_FEATURE_SCHEMA_ID,
  projectKtsConsolidationFeatures,
} from "../app/features/keep-the-signal/consolidation/kts-consolidation-features";
import {
  buildKtsRetentionContext,
  createKtsReferenceRetentionPolicy,
  evaluateKtsRetention,
} from "../app/features/keep-the-signal/consolidation/kts-consolidation-policy";
import {
  buildKtsLineageProbes,
  buildKtsReconstructionProbes,
  buildKtsReproducibilityProbes,
  buildKtsRetrievalQualityProbes,
} from "../app/features/keep-the-signal/consolidation/kts-forgetting-probes";
import { clusterDeterministically } from "../app/features/intelligence-harness/consolidation/deterministic-clusterer";

const digest = "a".repeat(64);
const recordedAt = "2026-08-02T08:00:00.000Z";

describe("KTS-I4-F Keep the Signal consolidation adapter", () => {
  it("projects accepted keep-the-signal episodes", async () => {
    const features = await projectKtsConsolidationFeatures(snapshot());
    expect(features).toHaveLength(1);
    expect(features[0]?.featureSchemaId).toBe(KTS_CONSOLIDATION_FEATURE_SCHEMA_ID);
  });

  it("rejects a wrong snapshot domain", async () => {
    await expect(
      projectKtsConsolidationFeatures({
        ...snapshot(),
        domainId: "another-domain",
      }),
    ).rejects.toMatchObject({ code: "invalid_feature_record" });
  });

  it("rejects a wrong memory domain", async () => {
    const source = snapshot();
    await expect(
      projectKtsConsolidationFeatures({
        ...source,
        memories: [{ ...source.memories[0]!, domainId: "another-domain" }],
      }),
    ).rejects.toMatchObject({ code: "invalid_feature_record" });
  });

  const expectedFeatures = [
    ["engineVersion", "engine:1"],
    ["rulesetVersion", "rules:1"],
    ["observationSchemaId", "kts.observation"],
    ["observationLevel", 1],
    ["seed", 42],
    ["tickFrom", 10],
    ["tickTo", 20],
    ["terminal", true],
    ["outcome", "completed"],
    ["score", 100],
    ["wave", 3],
    ["encounterId", "encounter:1"],
    ["signal", 80],
    ["defence", 70],
    ["weapons", 60],
    ["coherence", 90],
    ["recovery", "ready"],
    ["adviserClassification", "rule_based"],
    ["proposalValidation", "advisory_valid"],
    ["benchmark", true],
    ["truncation", false],
  ] as const;

  for (const [key, value] of expectedFeatures) {
    it(`preserves KTS feature ${key}`, async () => {
      const features = await projectKtsConsolidationFeatures(snapshot());
      expect(features[0]?.features[key]).toEqual(value);
    });
  }

  it("keeps unavailable facts explicitly missing", async () => {
    const source = snapshot();
    const features = await projectKtsConsolidationFeatures({
      ...source,
      memories: [{ ...source.memories[0]!, summary: {} }],
      evidence: [],
      attachments: [],
    });
    expect(features[0]?.missingFeatures).toContain("seed");
    expect(features[0]?.features.seed).toBeUndefined();
  });

  it("preserves evidence references", async () => {
    const features = await projectKtsConsolidationFeatures(snapshot());
    expect(features[0]?.sourceEvidenceReferences).toContain("evidence:outcome");
  });

  it("preserves attachment references", async () => {
    const features = await projectKtsConsolidationFeatures(snapshot());
    expect(features[0]?.sourceAttachmentReferences).toContain("attachment:outcome");
  });

  it("preserves relation references", async () => {
    const features = await projectKtsConsolidationFeatures(snapshot());
    expect(features[0]?.sourceRelationReferences).toContain("relation:memory");
  });

  it("creates the KTS reference retention policy", () => {
    const policy = createKtsReferenceRetentionPolicy();
    expect(policy.policyId).toBe("kts.reference_retention");
    expect(policy.minimumSupportCardinality).toBe(2);
  });

  it("protects benchmark KTS episodes", () => {
    const source = snapshot();
    const context = buildKtsRetentionContext({
      memory: { ...source.memories[0]!, significance: "benchmark" },
      attachments: source.attachments,
      evidence: source.evidence,
      relations: source.memoryRelations,
      validationClassification: "candidate_validated",
      supportCardinality: 10,
      higherLevelTargetAvailable: true,
      legalStatus: "known_permitted",
      consentStatus: "known_permitted",
      auditStatus: "complete",
    });
    expect(evaluateKtsRetention({ context }).decision).toBe("protected");
  });

  it("protects human corrections", () => {
    const source = snapshot();
    const context = buildKtsRetentionContext({
      memory: source.memories[0]!,
      attachments: [{ ...source.attachments[0]!, role: "correction" }],
      evidence: source.evidence,
      relations: source.memoryRelations,
      validationClassification: "candidate_validated",
      supportCardinality: 10,
      higherLevelTargetAvailable: true,
      legalStatus: "known_permitted",
      consentStatus: "known_permitted",
      auditStatus: "complete",
    });
    expect(evaluateKtsRetention({ context }).protectedReasons).toContain("human_correction");
  });

  it("protects contradictions", () => {
    const source = snapshot();
    const context = buildKtsRetentionContext({
      memory: source.memories[0]!,
      attachments: [{ ...source.attachments[0]!, role: "contradiction" }],
      evidence: source.evidence,
      relations: source.memoryRelations,
      validationClassification: "candidate_validated",
      supportCardinality: 10,
      higherLevelTargetAvailable: true,
      legalStatus: "known_permitted",
      consentStatus: "known_permitted",
      auditStatus: "complete",
    });
    expect(evaluateKtsRetention({ context }).protectedReasons).toContain("contradiction");
  });

  it("protects adviser validation failures", () => {
    const source = snapshot();
    const context = buildKtsRetentionContext({
      memory: source.memories[0]!,
      attachments: source.attachments,
      evidence: [{ ...source.evidence[0]!, payload: { safety: "failure" } }],
      relations: source.memoryRelations,
      validationClassification: "candidate_validated",
      supportCardinality: 10,
      higherLevelTargetAvailable: true,
      legalStatus: "known_permitted",
      consentStatus: "known_permitted",
      auditStatus: "complete",
    });
    expect(evaluateKtsRetention({ context }).protectedReasons).toContain("safety_failure");
  });

  it("builds replay reconstruction probes", () => {
    const probes = buildKtsReconstructionProbes(snapshot(), ["target:1"]);
    expect(probes[0]?.requiredInformationUnitIds).toContain("seed");
    expect(probes[0]?.requiredInformationUnitIds).toContain("source_state_digest");
  });

  it("builds retrieval quality probes", () => {
    const probes = buildKtsRetrievalQualityProbes(snapshot(), ["episode:a"]);
    expect(probes[0]?.requiredResultIds).toEqual(["episode:a"]);
    expect(probes[0]?.contradictionPreservationRequired).toBe(true);
  });

  for (const outcome of ["pass", "fail", "unknown", "not_applicable"] as const) {
    it(`builds lineage probe outcome ${outcome}`, () => {
      expect(buildKtsLineageProbes(snapshot(), outcome)[0]?.suppliedOutcome).toBe(outcome);
    });

    it(`builds reproducibility probe outcome ${outcome}`, () => {
      expect(buildKtsReproducibilityProbes(snapshot(), outcome)[0]?.suppliedOutcome).toBe(outcome);
    });
  }

  it("creates complete KTS builders", () => {
    const builders = createKtsConsolidationBuilders();
    expect(typeof builders.projectFeatures).toBe("function");
    expect(typeof builders.buildCandidates).toBe("function");
    expect(typeof builders.buildEvidenceMatrix).toBe("function");
    expect(typeof builders.buildRetentionDecisions).toBe("function");
  });

  it("builds deterministic KTS candidates", async () => {
    const builders = createKtsConsolidationBuilders();
    const source = snapshot();
    const features = await builders.projectFeatures(source);
    const clusters = await clusterDeterministically(features, {
      policyId: "policy:kts",
      policyVersion: "1",
      mode: "exact_feature_match",
      featureKeys: ["wave"],
      missingValueTreatment: "shared_unknown",
      maximumClusters: 10,
      maximumMembersPerCluster: 10,
      overflowBehaviour: "truncate",
      minimumClusterSize: 1,
      singletonTreatment: "retain",
    });
    const candidates = await builders.buildCandidates(source, clusters.clusters);
    expect(candidates[0]?.candidateKind).toBe("pattern_candidate");
    expect(candidates[0]?.status).toBe("experimental_candidate");
  });

  it("builds KTS evidence matrices", async () => {
    const builders = createKtsConsolidationBuilders();
    const source = snapshot();
    const features = await builders.projectFeatures(source);
    const clusters = await clusterDeterministically(features, {
      policyId: "policy:kts",
      policyVersion: "1",
      mode: "exact_feature_match",
      featureKeys: ["wave"],
      missingValueTreatment: "shared_unknown",
      maximumClusters: 10,
      maximumMembersPerCluster: 10,
      overflowBehaviour: "truncate",
      minimumClusterSize: 1,
      singletonTreatment: "retain",
    });
    const candidate = (await builders.buildCandidates(source, clusters.clusters))[0]!;
    const matrix = await builders.buildEvidenceMatrix(candidate, source);
    expect(matrix.entries[0]?.evidenceClass).toBe("support");
  });

  it("does not invent unknown gameplay facts", async () => {
    const source = snapshot();
    const feature = (
      await projectKtsConsolidationFeatures({
        ...source,
        memories: [{ ...source.memories[0]!, summary: { seed: 42 } }],
        evidence: [],
        attachments: [],
      })
    )[0]!;
    expect(feature.features.seed).toBe(42);
    expect(feature.features.score).toBeUndefined();
  });

  it("is deterministic across equivalent snapshots", async () => {
    const first = await projectKtsConsolidationFeatures(snapshot());
    const second = await projectKtsConsolidationFeatures(snapshot());
    expect(first).toEqual(second);
  });
});

function snapshot(): Readonly<ConsolidationSnapshot> {
  return Object.freeze({
    snapshotId: "snapshot:kts",
    snapshotSchemaId: "construct.consolidation.snapshot",
    snapshotSchemaVersion: 1,
    requestId: "request:kts",
    domainId: "keep-the-signal",
    domainVersion: "1",
    memories: [
      Object.freeze({
        memoryId: "episode:a",
        memoryKind: "episodic",
        memorySchemaId: "construct.memory",
        memorySchemaVersion: 1,
        domainId: "keep-the-signal",
        domainVersion: "1",
        significance: "routine",
        summary: {
          engineVersion: "engine:1",
          rulesetVersion: "rules:1",
          observationSchemaId: "kts.observation",
          observationLevel: 1,
          seed: 42,
          tickFrom: 10,
          tickTo: 20,
          terminal: true,
          outcome: "completed",
          score: 100,
          wave: 3,
          encounterId: "encounter:1",
          signal: 80,
          defence: 70,
          weapons: 60,
          coherence: 90,
          recovery: "ready",
          adviserClassification: "rule_based",
          proposalValidation: "advisory_valid",
          benchmark: true,
          truncation: false,
        },
        acceptanceState: "accepted",
        classification: "internal",
        retentionClass: "standard",
        tags: [],
        recordedAt,
        contentDigest: digest,
      }),
    ],
    attachments: [
      Object.freeze({
        attachmentId: "attachment:outcome",
        attachmentSchemaVersion: 1,
        memoryId: "episode:a",
        evidenceId: "evidence:outcome",
        role: "outcome",
        sequence: 0,
        metadata: {},
        canonicalContent: "{}",
      }),
    ],
    evidence: [
      Object.freeze({
        evidenceId: "evidence:outcome",
        evidenceSchemaId: "construct.evidence",
        evidenceSchemaVersion: 1,
        domainId: "keep-the-signal",
        domainVersion: "1",
        sourceType: "outcome",
        sourceSchemaId: "kts.outcome",
        sourceSchemaVersion: 1,
        sourceIdentity: "outcome:a",
        authoritativePosition: { tick: 20 },
        payload: { outcome: "completed" },
        acceptanceState: "accepted",
        classification: "internal",
        retentionClass: "standard",
        tags: [],
        recordedAt,
        contentDigest: digest,
      }),
    ],
    memoryRelations: [
      Object.freeze({
        relationId: "relation:memory",
        relationSchemaVersion: 1,
        relationType: "continues",
        sourceMemoryId: "episode:a",
        targetMemoryId: "episode:b",
        metadata: {},
        recordedAt,
        canonicalContent: "{}",
      }),
    ],
    evidenceRelations: [],
    retrievalReports: [],
    accessPolicy: {
      allowedDomains: ["keep-the-signal"] as const,
      allowedClassifications: ["internal"] as const,
      acceptedRetentionClasses: ["standard"] as const,
    },
    omittedReferences: [],
    truncatedReferences: [],
    serializedCharacters: 1_000,
    contentDigest: digest,
    recordedAt,
    actorId: "actor:test",
  });
}

import {
  canonicalizeJson,
  type JsonObject,
  type JsonValue,
} from "../../intelligence-harness/memory-fabric/canonical-json";
import type { EvidenceRecord } from "../../intelligence-harness/memory-fabric/evidence-contract";
import type { EpisodicMemoryRecord } from "../../intelligence-harness/memory-fabric/memory-contract";
import {
  createFeatureRecord,
  type FeatureRecord,
} from "../../intelligence-harness/consolidation/cluster-contract";
import type { ConsolidationSnapshot } from "../../intelligence-harness/consolidation/episode-snapshot";
import { failConsolidation } from "../../intelligence-harness/consolidation/failures";

export const KTS_CONSOLIDATION_FEATURE_SCHEMA_ID = "kts.consolidation.features" as const;
export const KTS_CONSOLIDATION_FEATURE_SCHEMA_VERSION = 1 as const;
export const KTS_CONSOLIDATION_EXTRACTION_METHOD_ID = "kts.explicit_episode_projection" as const;
export const KTS_CONSOLIDATION_EXTRACTION_METHOD_VERSION = "1" as const;

const KNOWN_FEATURE_PATHS = Object.freeze({
  engineVersion: ["engineVersion", "engine_version"],
  rulesetVersion: ["rulesetVersion", "ruleset_version"],
  observationSchemaId: ["observationSchemaId", "observation_schema_id"],
  observationLevel: ["observationLevel", "observation_level", "level"],
  seed: ["seed"],
  tickFrom: ["tickFrom", "tick_from", "startTick"],
  tickTo: ["tickTo", "tick_to", "endTick", "tick"],
  terminal: ["terminal", "isTerminal"],
  outcome: ["outcome", "terminalOutcome"],
  score: ["score"],
  wave: ["wave", "waveId"],
  encounterId: ["encounterId", "encounter_id"],
  signal: ["signal", "signalIntegrity", "signal_integrity"],
  defence: ["defence", "defense"],
  weapons: ["weapons", "weaponPower"],
  coherence: ["coherence"],
  recovery: ["recovery", "recoveryStatus"],
  adviserClassification: ["adviserClassification", "adviser_classification"],
  proposalValidation: ["proposalValidation", "proposal_validation"],
  benchmark: ["benchmark", "benchmarkStatus"],
  truncation: ["truncated", "omitted", "truncation"],
} as const);

function findValue(value: JsonValue, names: readonly string[]): JsonValue | undefined {
  if (value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, names);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = value as JsonObject;
  for (const name of names) {
    if (name in record) return record[name];
  }
  for (const nested of Object.values(record)) {
    const found = findValue(nested, names);
    if (found !== undefined) return found;
  }
  return undefined;
}

function evidenceForMemory(
  snapshot: Readonly<ConsolidationSnapshot>,
  memoryId: string,
): readonly Readonly<EvidenceRecord>[] {
  const evidenceIds = new Set(
    snapshot.attachments
      .filter((attachment) => attachment.memoryId === memoryId)
      .map((attachment) => attachment.evidenceId),
  );
  return snapshot.evidence.filter((record) => evidenceIds.has(record.evidenceId));
}

function featureSources(
  memory: Readonly<EpisodicMemoryRecord>,
  evidence: readonly Readonly<EvidenceRecord>[],
): readonly JsonValue[] {
  return [memory.summary, ...evidence.map((record) => record.payload)];
}

export async function projectKtsConsolidationFeatures(
  snapshot: Readonly<ConsolidationSnapshot>,
): Promise<readonly Readonly<FeatureRecord>[]> {
  if (
    snapshot.domainId !== "keep-the-signal" ||
    snapshot.memories.some((memory) => memory.domainId !== "keep-the-signal")
  ) {
    failConsolidation(
      "invalid_feature_record",
      "feature_projection",
      "KTS feature projection accepts only keep-the-signal records.",
      {
        snapshotId: snapshot.snapshotId,
      },
    );
  }

  const results: Readonly<FeatureRecord>[] = [];
  for (const memory of snapshot.memories) {
    const relatedEvidence = evidenceForMemory(snapshot, memory.memoryId);
    const sources = featureSources(memory, relatedEvidence);
    const features: Record<string, JsonValue> = {
      significance: memory.significance,
      acceptanceState: memory.acceptanceState,
      classification: memory.classification,
      retentionClass: memory.retentionClass,
      tags: [...memory.tags],
    };
    const missing: string[] = [];
    for (const [featureName, paths] of Object.entries(KNOWN_FEATURE_PATHS)) {
      let found: JsonValue | undefined;
      for (const source of sources) {
        found = findValue(source, paths);
        if (found !== undefined) break;
      }
      if (found === undefined) missing.push(featureName);
      else features[featureName] = found;
    }
    const attachments = snapshot.attachments.filter(
      (attachment) => attachment.memoryId === memory.memoryId,
    );
    const relationIds = snapshot.memoryRelations
      .filter(
        (relation) =>
          relation.sourceMemoryId === memory.memoryId ||
          relation.targetMemoryId === memory.memoryId,
      )
      .map((relation) => relation.relationId);
    results.push(
      await createFeatureRecord({
        featureRecordId: `feature:${memory.memoryId}`,
        featureRecordVersion: "1",
        sourceEpisodeId: memory.memoryId,
        sourceEpisodeDigest: memory.contentDigest,
        domainId: memory.domainId,
        domainVersion: memory.domainVersion,
        featureSchemaId: KTS_CONSOLIDATION_FEATURE_SCHEMA_ID,
        featureSchemaVersion: KTS_CONSOLIDATION_FEATURE_SCHEMA_VERSION,
        features: canonicalizeJson(features) as JsonObject,
        missingFeatures: missing,
        extractionMethodId: KTS_CONSOLIDATION_EXTRACTION_METHOD_ID,
        extractionMethodVersion: KTS_CONSOLIDATION_EXTRACTION_METHOD_VERSION,
        sourceEvidenceReferences: relatedEvidence.map((record) => record.evidenceId),
        sourceAttachmentReferences: attachments.map((attachment) => attachment.attachmentId),
        sourceRelationReferences: relationIds,
        projectionLimitations:
          missing.length === 0 ? [] : ["Unavailable gameplay facts remain explicitly missing."],
      }),
    );
  }
  return Object.freeze(results);
}

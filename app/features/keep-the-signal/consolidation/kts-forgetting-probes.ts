import type {
  BooleanVerificationProbe,
  ReconstructionProbe,
  RetrievalQualityProbe,
} from "../../intelligence-harness/consolidation/forgetting-contract";
import type { ConsolidationSnapshot } from "../../intelligence-harness/consolidation/episode-snapshot";

export function buildKtsReconstructionProbes(
  snapshot: Readonly<ConsolidationSnapshot>,
  preservationTargetIds: readonly string[],
): readonly Readonly<ReconstructionProbe>[] {
  const units = Object.freeze([
    "seed",
    "engine_version",
    "ruleset_version",
    "observation_digest",
    "source_state_digest",
    "outcome",
    "strategy_provenance",
    "contradiction_lineage",
  ]);
  return Object.freeze([
    Object.freeze({
      probeId: `probe:reconstruction:${snapshot.snapshotId}`,
      probeVersion: "1",
      requiredInformationUnitIds: units,
      allowedPreservationTargetIds: [...preservationTargetIds],
      allowedRetainedMemoryIds: snapshot.memories.map((memory) => memory.memoryId),
      allowedRetainedEvidenceIds: snapshot.evidence.map((record) => record.evidenceId),
      reconstructionMethodId: "kts.typed_path_reconstruction",
      maximumOperations: 10_000,
      maximumSerializedCharacters: Math.max(snapshot.serializedCharacters, 1),
      blocking: true,
    }),
  ]);
}

export function buildKtsRetrievalQualityProbes(
  snapshot: Readonly<ConsolidationSnapshot>,
  requiredFailureAndCorrectionIds: readonly string[],
): readonly Readonly<RetrievalQualityProbe>[] {
  return Object.freeze([
    Object.freeze({
      probeId: `probe:retrieval:${snapshot.snapshotId}`,
      probeVersion: "1",
      requiredResultIds: [...requiredFailureAndCorrectionIds],
      prohibitedResultIds: [],
      expectedOrdering: [...requiredFailureAndCorrectionIds],
      maximumResultLoss: Math.max(
        snapshot.memories.length - requiredFailureAndCorrectionIds.length,
        0,
      ),
      maximumCharacterDifference: snapshot.serializedCharacters,
      contradictionPreservationRequired: true,
      blocking: true,
    }),
  ]);
}

export function buildKtsLineageProbes(
  snapshot: Readonly<ConsolidationSnapshot>,
  outcome: "pass" | "fail" | "unknown" | "not_applicable",
): readonly Readonly<BooleanVerificationProbe>[] {
  return Object.freeze([
    Object.freeze({
      probeId: `probe:lineage:${snapshot.snapshotId}`,
      probeVersion: "1",
      kind: "lineage" as const,
      suppliedOutcome: outcome,
      blocking: true,
      referenceIds: [
        ...snapshot.memories.map((memory) => memory.memoryId),
        ...snapshot.evidence.map((record) => record.evidenceId),
      ],
    }),
  ]);
}

export function buildKtsReproducibilityProbes(
  snapshot: Readonly<ConsolidationSnapshot>,
  outcome: "pass" | "fail" | "unknown" | "not_applicable",
): readonly Readonly<BooleanVerificationProbe>[] {
  return Object.freeze([
    Object.freeze({
      probeId: `probe:reproducibility:${snapshot.snapshotId}`,
      probeVersion: "1",
      kind: "reproducibility" as const,
      suppliedOutcome: outcome,
      blocking: true,
      referenceIds: [
        ...snapshot.evidence
          .filter(
            (record) =>
              record.retentionClass === "benchmark" || record.tags.includes("reproducibility"),
          )
          .map((record) => record.evidenceId),
      ],
    }),
  ]);
}

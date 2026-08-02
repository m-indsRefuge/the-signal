import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isSha256Hex, sha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export interface ArtifactLineageDraft {
  readonly lineageId: string;
  readonly artifactKind: "checkpoint" | "adapter" | "evaluation_bundle";
  readonly baseModelDigest: string;
  readonly tokenizerDigest: string;
  readonly datasetApprovalDigest: string;
  readonly trainingPlanDigest: string;
  readonly sourceCheckpointDigest?: string;
  readonly sourceCodeCheckpoint: string;
  readonly environmentDigest: string;
}
export interface ArtifactLineage extends ArtifactLineageDraft {
  readonly lineageDigest: string;
}
export async function createArtifactLineage(
  draft: Readonly<ArtifactLineageDraft>,
): Promise<Readonly<ArtifactLineage>> {
  validateFineTuningIdentity(draft.lineageId, "lineageId", "adapter_lineage_incomplete");
  validateFineTuningIdentity(
    draft.sourceCodeCheckpoint,
    "sourceCodeCheckpoint",
    "adapter_lineage_incomplete",
  );
  const ds = [
    draft.baseModelDigest,
    draft.tokenizerDigest,
    draft.datasetApprovalDigest,
    draft.trainingPlanDigest,
    draft.environmentDigest,
    ...(draft.sourceCheckpointDigest ? [draft.sourceCheckpointDigest] : []),
  ];
  if (ds.some((d) => !isSha256Hex(d)))
    failFineTuning("adapter_lineage_incomplete", "lineage", "Artifact lineage is incomplete.");
  const normalized = canonicalizeJson(draft) as unknown as ArtifactLineageDraft;
  const lineageDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    lineageDigest,
  } as unknown as JsonValue) as unknown as Readonly<ArtifactLineage>;
}

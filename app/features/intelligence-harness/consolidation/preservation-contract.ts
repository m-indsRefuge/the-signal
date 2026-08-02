import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonObject,
} from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import {
  failConsolidation,
  validateConsolidationIdentity,
  validateConsolidationTimestamp,
} from "./failures";

export const PRESERVATION_TARGET_TYPES = Object.freeze([
  "accepted_strategy",
  "accepted_semantic_claim",
  "accepted_procedural_skill",
  "accepted_result",
  "governed_archive",
] as const);
export type PreservationTargetType = (typeof PRESERVATION_TARGET_TYPES)[number];

export interface RepresentedInformationUnit {
  readonly informationUnitId: string;
  readonly destinationPath: string;
  readonly representationKind: string;
}

export interface PreservationTargetDraft {
  readonly targetId: string;
  readonly targetVersion: string;
  readonly targetType: PreservationTargetType;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly acceptanceClassification: "accepted_external_reference";
  readonly acceptanceEvidenceId: string;
  readonly acceptanceDecisionId: string;
  readonly targetDigest: string;
  readonly representedInformation: readonly RepresentedInformationUnit[];
  readonly sourceLineageReferences: readonly string[];
  readonly applicabilityBoundaries: readonly JsonObject[];
  readonly versionBoundaries: readonly JsonObject[];
  readonly actorId: string;
  readonly recordedAt: string;
}

export interface PreservationTarget extends PreservationTargetDraft {
  readonly canonicalContent: string;
}

export interface InformationPreservationMapDraft {
  readonly mapId: string;
  readonly mapVersion: string;
  readonly sourceMemoryId: string;
  readonly sourceMemoryDigest: string;
  readonly essentialInformationUnitIds: readonly string[];
  readonly destinationTargetIds: readonly string[];
  readonly destinationPaths: readonly string[];
  readonly transformationMethodId: string;
  readonly reconstructionMethodId: string;
  readonly residualInformationUnitIds: readonly string[];
  readonly uniqueEvidenceIds: readonly string[];
  readonly contradictionReferences: readonly string[];
  readonly correctionReferences: readonly string[];
  readonly versionConstraints: readonly JsonObject[];
  readonly scopeConstraints: readonly JsonObject[];
  readonly evaluatorId: string;
  readonly evaluatorVersion: string;
}

export interface InformationPreservationMap extends InformationPreservationMapDraft {
  readonly contentDigest: string;
}

export function createPreservationTarget(
  draft: Readonly<PreservationTargetDraft>,
): Readonly<PreservationTarget> {
  for (const [label, value] of [
    ["targetId", draft.targetId],
    ["targetVersion", draft.targetVersion],
    ["domainId", draft.domainId],
    ["domainVersion", draft.domainVersion],
    ["acceptanceEvidenceId", draft.acceptanceEvidenceId],
    ["acceptanceDecisionId", draft.acceptanceDecisionId],
    ["actorId", draft.actorId],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_preservation_target", "preservation");
  }
  validateConsolidationTimestamp(draft.recordedAt, "invalid_preservation_target", "preservation");
  if (
    !PRESERVATION_TARGET_TYPES.includes(draft.targetType) ||
    draft.acceptanceClassification !== "accepted_external_reference" ||
    !/^[a-f0-9]{64}$/.test(draft.targetDigest) ||
    draft.representedInformation.length === 0
  ) {
    failConsolidation(
      "invalid_preservation_target",
      "preservation",
      "Preservation target is invalid.",
    );
  }
  const normalized = canonicalizeJson({
    ...draft,
    representedInformation: [...draft.representedInformation].sort((a, b) =>
      a.informationUnitId < b.informationUnitId
        ? -1
        : a.informationUnitId > b.informationUnitId
          ? 1
          : 0,
    ),
    sourceLineageReferences: [...new Set(draft.sourceLineageReferences)].sort(),
  }) as unknown as Omit<PreservationTarget, "canonicalContent">;
  return deepFreezeJson({
    ...normalized,
    canonicalContent: canonicalStringify(normalized),
  } as unknown as JsonObject) as unknown as Readonly<PreservationTarget>;
}

export async function createInformationPreservationMap(
  draft: Readonly<InformationPreservationMapDraft>,
): Promise<Readonly<InformationPreservationMap>> {
  for (const [label, value] of [
    ["mapId", draft.mapId],
    ["mapVersion", draft.mapVersion],
    ["sourceMemoryId", draft.sourceMemoryId],
    ["transformationMethodId", draft.transformationMethodId],
    ["reconstructionMethodId", draft.reconstructionMethodId],
    ["evaluatorId", draft.evaluatorId],
    ["evaluatorVersion", draft.evaluatorVersion],
  ] as const) {
    validateConsolidationIdentity(value, label, "invalid_preservation_map", "preservation", {
      memoryId: draft.sourceMemoryId,
    });
  }
  if (
    !/^[a-f0-9]{64}$/.test(draft.sourceMemoryDigest) ||
    draft.essentialInformationUnitIds.length === 0 ||
    draft.destinationTargetIds.length === 0 ||
    draft.destinationPaths.length === 0
  ) {
    failConsolidation(
      "invalid_preservation_map",
      "preservation",
      "Preservation map is incomplete.",
    );
  }
  const normalized = canonicalizeJson({
    ...draft,
    essentialInformationUnitIds: [...new Set(draft.essentialInformationUnitIds)].sort(),
    destinationTargetIds: [...new Set(draft.destinationTargetIds)].sort(),
    destinationPaths: [...new Set(draft.destinationPaths)].sort(),
    residualInformationUnitIds: [...new Set(draft.residualInformationUnitIds)].sort(),
    uniqueEvidenceIds: [...new Set(draft.uniqueEvidenceIds)].sort(),
    contradictionReferences: [...new Set(draft.contradictionReferences)].sort(),
    correctionReferences: [...new Set(draft.correctionReferences)].sort(),
  }) as unknown as Omit<InformationPreservationMap, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonObject) as unknown as Readonly<InformationPreservationMap>;
}

export function informationIsPreserved(
  map: Readonly<InformationPreservationMap>,
  targets: readonly Readonly<PreservationTarget>[],
): boolean {
  const targetIds = new Set(targets.map((target) => target.targetId));
  if (!map.destinationTargetIds.every((targetId) => targetIds.has(targetId))) return false;
  const represented = new Set(
    targets.flatMap((target) =>
      target.representedInformation.map((unit) => unit.informationUnitId),
    ),
  );
  return (
    map.residualInformationUnitIds.length === 0 &&
    map.uniqueEvidenceIds.length === 0 &&
    map.essentialInformationUnitIds.every((unit) => represented.has(unit))
  );
}

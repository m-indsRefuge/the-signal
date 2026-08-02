import {
  canonicalStringify,
  deepFreezeJson,
  type JsonObject,
} from "../memory-fabric/canonical-json";
import type {
  AcceptanceState,
  EvidenceRecord,
  EvidenceRelationRecord,
} from "../memory-fabric/evidence-contract";
import type {
  EpisodeSignificance,
  EpisodicMemoryRecord,
  MemoryEvidenceAttachment,
  MemoryEvidenceRole,
  MemoryRelationRecord,
} from "../memory-fabric/memory-contract";
import {
  validateAccessPolicy,
  validateRetrievalBudget,
  type RecordAccessPolicy,
  type RetrievalBudget,
  type RetrievalMetadata,
} from "../memory-fabric/retrieval-contract";
import {
  failConsolidation,
  mapUnknownConsolidationFailure,
  validateConsolidationIdentity,
  validateConsolidationTimestamp,
} from "./failures";
import type { ReadOnlyConsolidationSource } from "./source-contract";

export const SELECTION_ORDERINGS = Object.freeze([
  "canonical_identity",
  "recorded_at_ascending",
  "recorded_at_descending",
  "source_order",
] as const);
export type SelectionOrdering = (typeof SELECTION_ORDERINGS)[number];

export interface EpisodeSelectionPolicy extends RecordAccessPolicy {
  readonly acceptedMemoryStates: readonly AcceptanceState[];
  readonly acceptedSignificance: readonly EpisodeSignificance[];
  readonly exactEpisodeIds?: readonly string[];
  readonly tags?: readonly string[];
  readonly recordedAtFrom?: string;
  readonly recordedAtTo?: string;
  readonly authoritativeTickFrom?: number;
  readonly authoritativeTickTo?: number;
  readonly requiredEvidenceRoles?: readonly MemoryEvidenceRole[];
  readonly ordering: SelectionOrdering;
  readonly budget: RetrievalBudget;
  readonly evidenceBudget: RetrievalBudget;
}

export interface EpisodeSelectionRequest {
  readonly requestId: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly policy: EpisodeSelectionPolicy;
}

export interface EpisodeSelectionResult {
  readonly requestId: string;
  readonly memories: readonly Readonly<EpisodicMemoryRecord>[];
  readonly attachments: readonly Readonly<MemoryEvidenceAttachment>[];
  readonly evidence: readonly Readonly<EvidenceRecord>[];
  readonly memoryRelations: readonly Readonly<MemoryRelationRecord>[];
  readonly evidenceRelations: readonly Readonly<EvidenceRelationRecord>[];
  readonly metadata: Readonly<RetrievalMetadata>;
  readonly omittedMemoryIds: readonly string[];
  readonly truncatedEvidenceIds: readonly string[];
  readonly serializedCharacters: number;
}

export function validateSelectionPolicy(policy: Readonly<EpisodeSelectionPolicy>): void {
  try {
    validateAccessPolicy(policy);
    validateRetrievalBudget(policy.budget);
    validateRetrievalBudget(policy.evidenceBudget);
  } catch {
    failConsolidation(
      "source_not_authorized",
      "selection",
      "Selection access or budget is invalid.",
    );
  }
  if (!SELECTION_ORDERINGS.includes(policy.ordering)) {
    failConsolidation(
      "invalid_consolidation_request",
      "selection",
      "Selection ordering is unsupported.",
    );
  }
  if (policy.acceptedMemoryStates.length === 0 || policy.acceptedSignificance.length === 0) {
    failConsolidation(
      "invalid_consolidation_request",
      "selection",
      "Selection filters must be explicit.",
    );
  }
  for (const id of policy.exactEpisodeIds ?? [])
    validateConsolidationIdentity(id, "episodeId", "invalid_consolidation_request", "selection");
  for (const tag of policy.tags ?? [])
    validateConsolidationIdentity(tag, "tag", "invalid_consolidation_request", "selection");
  if (policy.recordedAtFrom !== undefined)
    validateConsolidationTimestamp(
      policy.recordedAtFrom,
      "invalid_consolidation_request",
      "selection",
    );
  if (policy.recordedAtTo !== undefined)
    validateConsolidationTimestamp(
      policy.recordedAtTo,
      "invalid_consolidation_request",
      "selection",
    );
  for (const tick of [policy.authoritativeTickFrom, policy.authoritativeTickTo]) {
    if (tick !== undefined && (!Number.isSafeInteger(tick) || tick < 0)) {
      failConsolidation(
        "invalid_consolidation_request",
        "selection",
        "Authoritative tick filter is invalid.",
      );
    }
  }
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function orderMemories(
  records: readonly Readonly<EpisodicMemoryRecord>[],
  ordering: SelectionOrdering,
): Readonly<EpisodicMemoryRecord>[] {
  if (ordering === "source_order") return [...records];
  return [...records].sort((left, right) => {
    if (ordering === "recorded_at_ascending" || ordering === "recorded_at_descending") {
      const comparison = compareCodeUnits(left.recordedAt, right.recordedAt);
      if (comparison !== 0) return ordering === "recorded_at_ascending" ? comparison : -comparison;
    }
    return compareCodeUnits(left.memoryId, right.memoryId);
  });
}

function tickOfEvidence(record: Readonly<EvidenceRecord>): number | null {
  const value = record.authoritativePosition.tick;
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

export async function selectEpisodes(
  source: ReadOnlyConsolidationSource,
  request: Readonly<EpisodeSelectionRequest>,
): Promise<Readonly<EpisodeSelectionResult>> {
  validateConsolidationIdentity(
    request.requestId,
    "requestId",
    "invalid_consolidation_request",
    "selection",
  );
  validateConsolidationIdentity(
    request.domainId,
    "domainId",
    "invalid_consolidation_request",
    "selection",
  );
  validateConsolidationIdentity(
    request.domainVersion,
    "domainVersion",
    "invalid_consolidation_request",
    "selection",
  );
  validateSelectionPolicy(request.policy);
  if (!request.policy.allowedDomains.includes(request.domainId)) {
    failConsolidation("source_not_authorized", "selection", "Requested domain is not authorized.", {
      requestId: request.requestId,
    });
  }

  try {
    const queried = await source.queryMemory({
      requestId: request.policy.requestId,
      allowedDomains: request.policy.allowedDomains,
      allowedClassifications: request.policy.allowedClassifications,
      acceptedRetentionClasses: request.policy.acceptedRetentionClasses,
      budget: request.policy.budget,
      memoryIds: request.policy.exactEpisodeIds,
      memoryKinds: ["episodic"],
      acceptanceStates: request.policy.acceptedMemoryStates,
      tags: request.policy.tags,
      recordedAtFrom: request.policy.recordedAtFrom,
      recordedAtTo: request.policy.recordedAtTo,
    });

    const significanceFiltered = queried.records.filter(
      (record) =>
        record.domainId === request.domainId &&
        record.domainVersion === request.domainVersion &&
        request.policy.acceptedSignificance.includes(record.significance),
    );
    const ordered = orderMemories(significanceFiltered, request.policy.ordering);

    const selected: Readonly<EpisodicMemoryRecord>[] = [];
    const attachments: Readonly<MemoryEvidenceAttachment>[] = [];
    const evidenceById = new Map<string, Readonly<EvidenceRecord>>();
    const memoryRelations: Readonly<MemoryRelationRecord>[] = [];
    const evidenceRelationsById = new Map<string, Readonly<EvidenceRelationRecord>>();
    const omittedMemoryIds: string[] = [];
    const truncatedEvidenceIds: string[] = [];
    let serializedCharacters = 0;

    for (const memory of ordered) {
      const attachmentResult = await source.getMemoryAttachments({
        requestId: `${request.requestId}:attachments:${memory.memoryId}`,
        memoryId: memory.memoryId,
        access: request.policy,
        budget: request.policy.evidenceBudget,
      });
      const roles = new Set(attachmentResult.records.map((attachment) => attachment.role));
      const requiredRoles = request.policy.requiredEvidenceRoles ?? [];
      if (requiredRoles.some((role) => !roles.has(role))) {
        omittedMemoryIds.push(memory.memoryId);
        continue;
      }

      const localEvidence: Readonly<EvidenceRecord>[] = [];
      let tickAccepted =
        request.policy.authoritativeTickFrom === undefined &&
        request.policy.authoritativeTickTo === undefined;
      for (const attachment of attachmentResult.records) {
        const record = await source.getEvidence(attachment.evidenceId, request.policy);
        if (record === null) {
          truncatedEvidenceIds.push(attachment.evidenceId);
          continue;
        }
        const tick = tickOfEvidence(record);
        if (
          tick !== null &&
          (request.policy.authoritativeTickFrom === undefined ||
            tick >= request.policy.authoritativeTickFrom) &&
          (request.policy.authoritativeTickTo === undefined ||
            tick <= request.policy.authoritativeTickTo)
        ) {
          tickAccepted = true;
        }
        localEvidence.push(record);
      }
      if (!tickAccepted) {
        omittedMemoryIds.push(memory.memoryId);
        continue;
      }

      const memoryCharacters = canonicalStringify(memory).length;
      const attachmentCharacters = canonicalStringify(attachmentResult.records).length;
      const evidenceCharacters = canonicalStringify(localEvidence).length;
      if (
        selected.length >= request.policy.budget.resultLimit ||
        serializedCharacters + memoryCharacters + attachmentCharacters + evidenceCharacters >
          request.policy.budget.maximumSerializedCharacters
      ) {
        omittedMemoryIds.push(memory.memoryId);
        continue;
      }

      selected.push(memory);
      attachments.push(...attachmentResult.records);
      for (const evidence of localEvidence) evidenceById.set(evidence.evidenceId, evidence);
      serializedCharacters += memoryCharacters + attachmentCharacters + evidenceCharacters;
      memoryRelations.push(...(await source.getMemoryRelations(memory.memoryId, request.policy)));
      for (const evidence of localEvidence) {
        const relations = await source.getEvidenceRelations(evidence.evidenceId, request.policy);
        for (const relation of relations) evidenceRelationsById.set(relation.relationId, relation);
      }
    }

    const result: EpisodeSelectionResult = {
      requestId: request.requestId,
      memories: selected,
      attachments,
      evidence: [...evidenceById.values()].sort((a, b) =>
        compareCodeUnits(a.evidenceId, b.evidenceId),
      ),
      memoryRelations: memoryRelations.sort((a, b) => compareCodeUnits(a.relationId, b.relationId)),
      evidenceRelations: [...evidenceRelationsById.values()].sort((a, b) =>
        compareCodeUnits(a.relationId, b.relationId),
      ),
      metadata: {
        ...queried.metadata,
        returnedCount: selected.length,
        omittedCount: omittedMemoryIds.length,
        truncated:
          queried.metadata.truncated ||
          omittedMemoryIds.length > 0 ||
          truncatedEvidenceIds.length > 0,
        serializedCharacters,
        orderingPolicy: request.policy.ordering,
        appliedFilters: Object.freeze([
          ...queried.metadata.appliedFilters,
          "domainVersion",
          "significance",
          ...(request.policy.requiredEvidenceRoles?.length ? ["evidenceRoles"] : []),
          ...(request.policy.authoritativeTickFrom !== undefined ||
          request.policy.authoritativeTickTo !== undefined
            ? ["authoritativeTick"]
            : []),
        ]),
      },
      omittedMemoryIds: omittedMemoryIds.sort(compareCodeUnits),
      truncatedEvidenceIds: [...new Set(truncatedEvidenceIds)].sort(compareCodeUnits),
      serializedCharacters,
    };
    return deepFreezeJson(
      result as unknown as JsonObject,
    ) as unknown as Readonly<EpisodeSelectionResult>;
  } catch (error) {
    throw mapUnknownConsolidationFailure(error, "selection", { requestId: request.requestId });
  }
}

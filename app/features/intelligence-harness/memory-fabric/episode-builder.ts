import { deepFreezeJson, type JsonObject, type JsonValue } from "./canonical-json";
import type { AcceptanceState, DataClassification, RetentionClass } from "./evidence-contract";
import { validatePublicIdentity } from "./evidence-contract";
import { failMemory } from "./failures";
import {
  createEpisodicMemoryRecord,
  createMemoryEvidenceAttachment,
  type EpisodeSignificance,
  type EpisodicMemoryRecord,
  type MemoryEvidenceAttachment,
  type MemoryEvidenceRole,
} from "./memory-contract";
import type { EpisodeBundle } from "./repository-contract";

export interface EpisodeEvidenceReference {
  readonly attachmentId: string;
  readonly evidenceId: string;
  readonly role: MemoryEvidenceRole;
  readonly sequence: number;
  readonly metadata?: JsonObject;
}

export interface EpisodeFinalizationRequest {
  readonly memoryId: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly significance: EpisodeSignificance;
  readonly summary: JsonValue;
  readonly acceptanceState: AcceptanceState;
  readonly classification: DataClassification;
  readonly retentionClass: RetentionClass;
  readonly tags: readonly string[];
  readonly recordedAt: string;
  readonly sessionId?: string;
  readonly actorId?: string;
  readonly operationId?: string;
  readonly evidence: readonly EpisodeEvidenceReference[];
  readonly knownEvidenceIds: ReadonlySet<string>;
}

export async function finalizeEpisode(
  request: Readonly<EpisodeFinalizationRequest>,
): Promise<Readonly<EpisodeBundle>> {
  validatePublicIdentity(request.memoryId, "memoryId");
  if (request.evidence.length === 0 || !request.evidence.some((item) => item.role === "outcome")) {
    failMemory("missing_evidence", "episode", "A finalized episode requires outcome evidence.");
  }
  const attachmentIds = new Set<string>();
  const evidenceRolePairs = new Set<string>();
  for (const item of request.evidence) {
    if (!request.knownEvidenceIds.has(item.evidenceId)) {
      failMemory("missing_evidence", "episode", "Episode references unknown evidence.", {
        diagnostics: { evidenceId: item.evidenceId },
      });
    }
    if (attachmentIds.has(item.attachmentId))
      failMemory("invalid_memory", "episode", "Attachment IDs must be unique.");
    attachmentIds.add(item.attachmentId);
    const pair = `${item.role}:${item.evidenceId}`;
    if (evidenceRolePairs.has(pair))
      failMemory(
        "invalid_memory",
        "episode",
        "Duplicate evidence role references are not allowed.",
      );
    evidenceRolePairs.add(pair);
  }
  const memory = await createEpisodicMemoryRecord({
    memoryId: request.memoryId,
    memoryKind: "episodic",
    domainId: request.domainId,
    domainVersion: request.domainVersion,
    significance: request.significance,
    summary: request.summary,
    acceptanceState: request.acceptanceState,
    classification: request.classification,
    retentionClass: request.retentionClass,
    tags: request.tags,
    recordedAt: request.recordedAt,
    ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId }),
    ...(request.actorId === undefined ? {} : { actorId: request.actorId }),
    ...(request.operationId === undefined ? {} : { operationId: request.operationId }),
  });
  const attachments = request.evidence
    .map((item) => createMemoryEvidenceAttachment({ ...item, memoryId: request.memoryId }))
    .sort((a, b) => a.sequence - b.sequence || a.attachmentId.localeCompare(b.attachmentId));
  return deepFreezeJson({ memory, attachments }) as Readonly<{
    memory: Readonly<EpisodicMemoryRecord>;
    attachments: readonly Readonly<MemoryEvidenceAttachment>[];
  }>;
}

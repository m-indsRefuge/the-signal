import {
  KTS_OBSERVATION_ADAPTER_ID,
  KTS_OBSERVATION_ADAPTER_VERSION,
  KTS_OBSERVATION_SCHEMA_ID,
  KTS_OBSERVATION_SCHEMA_VERSION,
  isKtsObservationId,
  type KtsObservationPacket,
} from "../intelligence-adapter";
import { canonicalizeJson } from "../../intelligence-harness/memory-fabric/canonical-json";
import {
  createEvidenceRecord,
  type AcceptanceState,
  type DataClassification,
  type EvidenceRecord,
  type RetentionClass,
} from "../../intelligence-harness/memory-fabric/evidence-contract";
import { failMemory } from "../../intelligence-harness/memory-fabric/failures";

export interface KtsObservationEvidenceGovernance {
  readonly evidenceId: string;
  readonly recordedAt: string;
  readonly acceptanceState: AcceptanceState;
  readonly classification: DataClassification;
  readonly retentionClass: RetentionClass;
  readonly tags: readonly string[];
  readonly actorId?: string;
  readonly operationId?: string;
}

export async function createKtsObservationEvidence(
  observation: Readonly<KtsObservationPacket>,
  governance: Readonly<KtsObservationEvidenceGovernance>,
): Promise<Readonly<EvidenceRecord>> {
  if (
    observation.metadata.observationSchemaId !== KTS_OBSERVATION_SCHEMA_ID ||
    observation.metadata.observationSchemaVersion !== KTS_OBSERVATION_SCHEMA_VERSION ||
    observation.metadata.adapterId !== KTS_OBSERVATION_ADAPTER_ID ||
    observation.metadata.adapterVersion !== KTS_OBSERVATION_ADAPTER_VERSION ||
    !isKtsObservationId(observation.metadata.observationId) ||
    (observation.level !== 0 && observation.level !== 1)
  ) {
    failMemory("invalid_evidence", "kts_adapter", "KTS observation identity is unsupported.", {
      operationId: governance.operationId,
    });
  }

  return createEvidenceRecord({
    evidenceId: governance.evidenceId,
    domainId: "keep-the-signal",
    domainVersion: `${observation.metadata.engineVersion}:${observation.metadata.rulesetVersion}`,
    sourceType: "observation",
    sourceSchemaId: KTS_OBSERVATION_SCHEMA_ID,
    sourceSchemaVersion: KTS_OBSERVATION_SCHEMA_VERSION,
    sourceIdentity: observation.metadata.observationId,
    authoritativePosition: {
      seed: observation.metadata.seed,
      tick: observation.metadata.tick,
      sourceStateDigest: observation.metadata.sourceStateDigest,
      engineVersion: observation.metadata.engineVersion,
      rulesetVersion: observation.metadata.rulesetVersion,
      observationLevel: observation.level,
      observationId: observation.metadata.observationId,
    },
    payload: canonicalizeJson(observation),
    acceptanceState: governance.acceptanceState,
    classification: governance.classification,
    retentionClass: governance.retentionClass,
    tags: governance.tags,
    recordedAt: governance.recordedAt,
    ...(governance.actorId === undefined ? {} : { actorId: governance.actorId }),
    ...(governance.operationId === undefined ? {} : { operationId: governance.operationId }),
  });
}

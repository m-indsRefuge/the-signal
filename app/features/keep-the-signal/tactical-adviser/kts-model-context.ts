import {
  canonicalizeJson,
  type JsonValue,
} from "../../intelligence-harness/memory-fabric/canonical-json";
import type { AdviserRequest } from "../../intelligence-harness/tactical-adviser/adviser-contract";
import { failAdviser } from "../../intelligence-harness/tactical-adviser/failures";
import {
  KTS_OBSERVATION_ADAPTER_ID,
  KTS_OBSERVATION_ADAPTER_VERSION,
  KTS_OBSERVATION_SCHEMA_ID,
  KTS_OBSERVATION_SCHEMA_VERSION,
  type KtsObservationPacket,
} from "../intelligence-adapter";

export function canonicalizeKtsObservationForAdviser(
  request: Readonly<AdviserRequest>,
  observation: Readonly<KtsObservationPacket>,
): Readonly<KtsObservationPacket> & JsonValue {
  if (
    request.domainId !== "keep-the-signal" ||
    request.observation.observationId !== observation.metadata.observationId ||
    request.observation.observationSchemaId !== KTS_OBSERVATION_SCHEMA_ID ||
    request.observation.observationSchemaVersion !== KTS_OBSERVATION_SCHEMA_VERSION ||
    request.observation.observationLevel !== observation.level ||
    request.observation.sourceStateDigest !== observation.metadata.sourceStateDigest ||
    observation.metadata.observationSchemaId !== KTS_OBSERVATION_SCHEMA_ID ||
    observation.metadata.observationSchemaVersion !== KTS_OBSERVATION_SCHEMA_VERSION ||
    observation.metadata.requestedLevel !== observation.level ||
    observation.metadata.adapterId !== KTS_OBSERVATION_ADAPTER_ID ||
    observation.metadata.adapterVersion !== KTS_OBSERVATION_ADAPTER_VERSION
  ) {
    failAdviser(
      "invalid_adviser_request",
      "request_validation",
      "Adviser request does not match the accepted KTS observation.",
      {
        adviserRequestId: request.adviserRequestId,
        invocationId: request.invocationId,
        observationId: observation.metadata.observationId,
      },
    );
  }
  return canonicalizeJson(observation) as unknown as Readonly<KtsObservationPacket> & JsonValue;
}

export function createKtsModelUserRequest(request: Readonly<AdviserRequest>): JsonValue {
  return canonicalizeJson({
    adviserRequestId: request.adviserRequestId,
    proposalId: request.proposalId,
    observationId: request.observation.observationId,
    proposalSchemaId: request.proposalSchemaId,
    proposalSchemaVersion: request.proposalSchemaVersion,
    requestedRole: {
      roleId: request.roleId,
      roleVersion: request.roleVersion,
    },
    instruction: "Return one bounded advisory proposal or an explicit abstention.",
  });
}

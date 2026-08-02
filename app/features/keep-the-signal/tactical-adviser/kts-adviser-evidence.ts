import {
  canonicalizeJson,
  type JsonValue,
} from "../../intelligence-harness/memory-fabric/canonical-json";
import {
  createEvidenceRecord,
  isPublicIdentity,
  type AcceptanceState,
  type DataClassification,
  type EvidenceRecord,
  type RetentionClass,
} from "../../intelligence-harness/memory-fabric/evidence-contract";
import {
  createEvaluationCase,
  type AdviserEvaluationCase,
} from "../../intelligence-harness/tactical-adviser/evaluation-contract";
import { failAdviser } from "../../intelligence-harness/tactical-adviser/failures";
import type { ProposalEnvelope } from "../../intelligence-harness/tactical-adviser/proposal-contract";
import type { KtsObservationPacket } from "../intelligence-adapter";
import type { KtsTacticalProposal } from "./kts-proposal-contract";

export interface KtsAdviserEvidenceGovernance {
  readonly evidenceId: string;
  readonly recordedAt: string;
  readonly acceptanceState: AcceptanceState;
  readonly classification: DataClassification;
  readonly retentionClass: RetentionClass;
  readonly tags: readonly string[];
  readonly actorId?: string;
  readonly operationId?: string;
}

export interface KtsProposalEvidenceInput {
  readonly governance: Readonly<KtsAdviserEvidenceGovernance>;
  readonly observation: Readonly<KtsObservationPacket>;
  readonly proposal: Readonly<ProposalEnvelope<KtsTacticalProposal>>;
  readonly observationEvidenceId?: string;
  readonly providerAndModelProvenance?: JsonValue;
  readonly retrievedMemoryIds: readonly string[];
  readonly retrievedEvidenceIds: readonly string[];
  readonly contradictionEvidenceIds: readonly string[];
}

export interface KtsEvaluationEvidenceInput {
  readonly governance: Readonly<KtsAdviserEvidenceGovernance>;
  readonly evaluationCase: Readonly<AdviserEvaluationCase>;
  readonly proposalEvidenceId: string;
  readonly limitations: readonly string[];
}

export async function draftKtsProposalEvidence(
  input: Readonly<KtsProposalEvidenceInput>,
): Promise<Readonly<EvidenceRecord>> {
  const proposal = input.proposal;
  if (
    proposal.domainId !== "keep-the-signal" ||
    proposal.observationId !== input.observation.metadata.observationId ||
    proposal.observationSourceStateDigest !== input.observation.metadata.sourceStateDigest ||
    (input.observationEvidenceId !== undefined && !isPublicIdentity(input.observationEvidenceId)) ||
    !validReferences(input.retrievedMemoryIds) ||
    !validReferences(input.retrievedEvidenceIds) ||
    !validReferences(input.contradictionEvidenceIds)
  ) {
    failAdviser(
      "invalid_proposal_identity",
      "evidence",
      "Proposal evidence lineage or references are invalid.",
    );
  }
  return createEvidenceRecord({
    evidenceId: input.governance.evidenceId,
    domainId: "keep-the-signal",
    domainVersion: proposal.domainVersion,
    sourceType: "proposal",
    sourceSchemaId: proposal.proposalSchemaId,
    sourceSchemaVersion: Number(proposal.proposalSchemaVersion),
    sourceIdentity: proposal.proposalId,
    authoritativePosition: {
      seed: input.observation.metadata.seed,
      tick: input.observation.metadata.tick,
      observationId: input.observation.metadata.observationId,
      sourceStateDigest: input.observation.metadata.sourceStateDigest,
    },
    payload: canonicalizeJson({
      adviserRequestId: proposal.adviserRequestId,
      invocationId: proposal.invocationId,
      observationEvidenceId: input.observationEvidenceId ?? null,
      proposerKind: proposal.proposerKind,
      proposerIdentity: proposal.proposerIdentity,
      providerAndModelProvenance: input.providerAndModelProvenance ?? null,
      selectedStrategy: proposal.selectedStrategy ?? null,
      strategyReferences: proposal.strategyReferences,
      retrievedMemoryIds: input.retrievedMemoryIds,
      retrievedEvidenceIds: input.retrievedEvidenceIds,
      contradictionEvidenceIds: input.contradictionEvidenceIds,
      proposal: proposal.payload,
      validationClassification: proposal.validationClassification,
      confidenceBasisPoints: proposal.confidenceBasisPoints,
      uncertainty: proposal.uncertainty,
      abstention: proposal.abstention,
      persistencePerformed: false,
    }),
    acceptanceState: input.governance.acceptanceState,
    classification: input.governance.classification,
    retentionClass: input.governance.retentionClass,
    tags: input.governance.tags,
    recordedAt: input.governance.recordedAt,
    ...(input.governance.actorId === undefined ? {} : { actorId: input.governance.actorId }),
    ...(input.governance.operationId === undefined
      ? {}
      : { operationId: input.governance.operationId }),
  });
}

export async function draftKtsEvaluationEvidence(
  input: Readonly<KtsEvaluationEvidenceInput>,
): Promise<Readonly<EvidenceRecord>> {
  const evaluationCase = createEvaluationCase(input.evaluationCase);
  if (
    !isPublicIdentity(input.proposalEvidenceId) ||
    !Array.isArray(input.limitations) ||
    input.limitations.some(
      (limitation) => typeof limitation !== "string" || limitation.trim().length === 0,
    ) ||
    new Set(input.limitations).size !== input.limitations.length
  ) {
    failAdviser(
      "evaluation_invalid",
      "evidence",
      "Evaluation evidence references or limitations are invalid.",
    );
  }
  return createEvidenceRecord({
    evidenceId: input.governance.evidenceId,
    domainId: "keep-the-signal",
    domainVersion: `${evaluationCase.match.engineVersion}:${evaluationCase.match.rulesetVersion}`,
    sourceType: "evaluation",
    sourceSchemaId: "kts.adviser-evaluation",
    sourceSchemaVersion: 1,
    sourceIdentity: evaluationCase.caseId,
    authoritativePosition: {
      seedOrEpisodeFamily: evaluationCase.match.seedOrEpisodeFamily,
      observationId: evaluationCase.observationId,
      decisionPoint: evaluationCase.match.decisionPoint,
      partitionId: evaluationCase.match.partitionId,
    },
    payload: canonicalizeJson({
      evaluationCase,
      proposalEvidenceId: input.proposalEvidenceId,
      adviserClassification: evaluationCase.adviserClassification,
      proposalValidation: evaluationCase.proposalValidation,
      metricValues: evaluationCase.metricValues,
      evaluatorId: evaluationCase.evaluatorId,
      evaluatorVersion: evaluationCase.evaluatorVersion,
      limitations: input.limitations,
      persistencePerformed: false,
    }),
    acceptanceState: input.governance.acceptanceState,
    classification: input.governance.classification,
    retentionClass: input.governance.retentionClass,
    tags: input.governance.tags,
    recordedAt: input.governance.recordedAt,
    ...(input.governance.actorId === undefined ? {} : { actorId: input.governance.actorId }),
    ...(input.governance.operationId === undefined
      ? {}
      : { operationId: input.governance.operationId }),
  });
}

function validReferences(values: readonly string[]): boolean {
  return (
    Array.isArray(values) &&
    values.every(isPublicIdentity) &&
    new Set(values).size === values.length
  );
}

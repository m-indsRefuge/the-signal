import type { EvidenceRecord } from "../../intelligence-harness/memory-fabric/evidence-contract";
import type { MemoryRepository } from "../../intelligence-harness/memory-fabric/repository-contract";
import type { JsonValue } from "../../intelligence-harness/memory-fabric/canonical-json";
import { ModelInvocationCoordinator } from "../../intelligence-harness/model-bridge";
import {
  SIGNAL_OFFICER_ADVISER_ROLE,
  type AdviserRequest,
} from "../../intelligence-harness/tactical-adviser/adviser-contract";
import {
  TacticalAdviserCoordinator,
  type AdviserCoordinationResult,
} from "../../intelligence-harness/tactical-adviser/adviser-coordinator";
import {
  createProposalEnvelope,
  type ProposalEnvelope,
} from "../../intelligence-harness/tactical-adviser/proposal-contract";
import { StrategyPortfolio } from "../../intelligence-harness/tactical-adviser/strategy-portfolio";
import type { KtsObservationPacket } from "../intelligence-adapter";
import {
  draftKtsProposalEvidence,
  type KtsAdviserEvidenceGovernance,
} from "./kts-adviser-evidence";
import {
  canonicalizeKtsObservationForAdviser,
  createKtsModelUserRequest,
} from "./kts-model-context";
import { KTS_TACTICAL_PROPOSAL_OUTPUT, type KtsTacticalProposal } from "./kts-proposal-contract";
import { validateKtsTacticalProposal } from "./kts-proposal-validator";
import { evaluateKtsStrategyApplicability } from "./kts-strategy-portfolio";

export interface KtsModelAdviserInput {
  readonly request: Readonly<AdviserRequest>;
  readonly observation: Readonly<KtsObservationPacket>;
  readonly strategyPortfolio: StrategyPortfolio;
  readonly userRequest?: JsonValue;
  readonly evidenceGovernance?: Readonly<KtsAdviserEvidenceGovernance>;
  readonly observationEvidenceId?: string;
}

export interface KtsModelAdviserResult {
  readonly coordination: Readonly<AdviserCoordinationResult<KtsTacticalProposal>>;
  readonly proposalEnvelope?: Readonly<ProposalEnvelope<KtsTacticalProposal>>;
  readonly evidenceDraft?: Readonly<EvidenceRecord>;
}

export class KtsTacticalAdviser {
  readonly #coordinator: TacticalAdviserCoordinator;

  constructor(bridge: ModelInvocationCoordinator, repository?: MemoryRepository) {
    this.#coordinator = new TacticalAdviserCoordinator(bridge, repository);
  }

  get disposed(): boolean {
    return this.#coordinator.disposed;
  }

  async advise(
    input: Readonly<KtsModelAdviserInput>,
    signal?: AbortSignal,
  ): Promise<Readonly<KtsModelAdviserResult>> {
    const observation = canonicalizeKtsObservationForAdviser(input.request, input.observation);
    const coordination = await this.#coordinator.coordinate(
      {
        request: input.request,
        role: SIGNAL_OFFICER_ADVISER_ROLE,
        observation,
        strategyPortfolio: input.strategyPortfolio,
        applicabilityEvaluator: (strategy) =>
          evaluateKtsStrategyApplicability(observation, strategy),
        userRequest: input.userRequest ?? createKtsModelUserRequest(input.request),
        output: KTS_TACTICAL_PROPOSAL_OUTPUT,
        validateProposal: (proposal, context) =>
          validateKtsTacticalProposal({
            proposal,
            request: input.request,
            observation,
            strategyCandidates: context.context.includedStrategies,
            allowedEvidenceIds: context.context.includedEvidenceIds,
            allowedMemoryIds: context.context.includedMemoryIds,
            allowedContradictionIds:
              input.request.retrieval.mode === "enabled" &&
              input.request.retrieval.evidenceQuery?.relationType === "contradiction"
                ? context.context.includedEvidenceIds
                : [],
            maximumReasonCharacters: input.request.contextBudget.maximumReasonCharacters,
          }),
      },
      signal,
    );

    if (
      coordination.decodedProposal === undefined ||
      coordination.proposalValidation === undefined ||
      coordination.bridgeResult === undefined ||
      !coordination.bridgeResult.ok
    ) {
      return Object.freeze({ coordination });
    }

    const proposal = coordination.decodedProposal;
    const provenance = coordination.bridgeResult.provenance;
    const proposalEnvelope = createProposalEnvelope({
      proposalId: proposal.proposalId,
      proposalSchemaId: proposal.proposalSchemaId,
      proposalSchemaVersion: proposal.proposalSchemaVersion,
      adviserRequestId: proposal.adviserRequestId,
      invocationId: input.request.invocationId,
      domainId: input.request.domainId,
      domainVersion: input.request.domainVersion,
      observationId: proposal.observationId,
      observationSourceStateDigest: proposal.sourceStateDigest,
      adviserRoleId: input.request.roleId,
      adviserRoleVersion: input.request.roleVersion,
      proposerKind: "model",
      proposerIdentity: {
        providerId: provenance.actualProviderId,
        modelId: provenance.actualModelId,
        providerModelName: provenance.providerModelName,
        modelRevision: provenance.modelRevision,
      },
      ...(proposal.selectedStrategy === null
        ? {}
        : { selectedStrategy: proposal.selectedStrategy }),
      payload: proposal,
      confidenceBasisPoints: proposal.confidenceBasisPoints,
      uncertainty: proposal.uncertainty,
      abstention: proposal.abstention,
      publicReason: proposal.reason,
      evidenceReferences: proposal.evidenceReferences,
      strategyReferences: proposal.selectedStrategy === null ? [] : [proposal.selectedStrategy],
      provenance: {
        invocationId: provenance.invocationId,
        requestedProviderId: provenance.requestedProviderId,
        requestedModelId: provenance.requestedModelId,
        actualProviderId: provenance.actualProviderId,
        actualModelId: provenance.actualModelId,
        providerAdapterVersion: provenance.providerAdapterVersion,
        bridgeVersion: provenance.bridgeVersion,
        actionExecuted: false,
      },
      validationClassification: coordination.proposalValidation.classification,
    });

    if (input.evidenceGovernance === undefined) {
      return Object.freeze({ coordination, proposalEnvelope });
    }
    const evidenceDraft = await draftKtsProposalEvidence({
      governance: input.evidenceGovernance,
      observation,
      proposal: proposalEnvelope,
      ...(input.observationEvidenceId === undefined
        ? {}
        : { observationEvidenceId: input.observationEvidenceId }),
      providerAndModelProvenance: proposalEnvelope.provenance,
      retrievedMemoryIds: coordination.context?.includedMemoryIds ?? [],
      retrievedEvidenceIds: coordination.context?.includedEvidenceIds ?? [],
      contradictionEvidenceIds: proposal.contradictionReferences,
    });
    return Object.freeze({ coordination, proposalEnvelope, evidenceDraft });
  }

  dispose(): void {
    this.#coordinator.dispose();
  }
}

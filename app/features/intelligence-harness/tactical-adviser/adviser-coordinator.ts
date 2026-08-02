import {
  ModelInvocationCoordinator,
  type InvocationFailure,
  type InvocationResult,
  type StructuredOutputContract,
} from "../model-bridge";
import type { EvidenceRecord } from "../memory-fabric/evidence-contract";
import type { EpisodicMemoryRecord } from "../memory-fabric/memory-contract";
import type { MemoryRepository } from "../memory-fabric/repository-contract";
import type { RetrievalMetadata } from "../memory-fabric/retrieval-contract";
import { canonicalizeJson, type JsonValue } from "../memory-fabric/canonical-json";
import {
  requestContext,
  validateAdviserRequest,
  type AdviserRequest,
  type AdviserRole,
} from "./adviser-contract";
import { buildAdviserContext } from "./context-builder";
import type { AdviserContextReport } from "./context-contract";
import {
  freezeAdviserFailure,
  toSafeAdviserFailure,
  type TacticalAdviserFailure,
} from "./failures";
import type { ProposalValidationClassification } from "./proposal-contract";
import type { StrategyApplicabilityEvaluator } from "./strategy-contract";
import { StrategyPortfolio, type StrategySelectionReport } from "./strategy-portfolio";

export const ADVISER_RESULT_CLASSIFICATIONS = Object.freeze([
  "proposal",
  "abstention",
  "rejected",
  "failed",
  "cancelled",
  "deadline_exceeded",
] as const);
export type AdviserResultClassification = (typeof ADVISER_RESULT_CLASSIFICATIONS)[number];

export interface DomainProposalValidation {
  readonly classification: ProposalValidationClassification;
  readonly issues: readonly Readonly<{
    readonly code: string;
    readonly message: string;
  }>[];
}

export interface DomainProposalValidationContext {
  readonly request: Readonly<AdviserRequest>;
  readonly strategySelection: Readonly<StrategySelectionReport>;
  readonly retrievedMemories: readonly Readonly<EpisodicMemoryRecord>[];
  readonly retrievedEvidence: readonly Readonly<EvidenceRecord>[];
  readonly context: Readonly<AdviserContextReport>;
}

export type DomainProposalValidator<TProposal> = (
  proposal: Readonly<TProposal>,
  context: Readonly<DomainProposalValidationContext>,
) => Readonly<DomainProposalValidation>;

export interface AdviserCoordinationInput<TProposal> {
  readonly request: Readonly<AdviserRequest>;
  readonly role: Readonly<AdviserRole>;
  readonly observation: JsonValue;
  readonly strategyPortfolio: StrategyPortfolio;
  readonly applicabilityEvaluator: StrategyApplicabilityEvaluator;
  readonly userRequest: JsonValue;
  readonly output: StructuredOutputContract<TProposal>;
  readonly validateProposal: DomainProposalValidator<TProposal>;
}

export interface AdviserRetrievalReport {
  readonly mode: "disabled" | "enabled";
  readonly memory: Readonly<RetrievalMetadata>;
  readonly evidence: Readonly<RetrievalMetadata>;
}

export interface AdviserCoordinationResult<TProposal> {
  readonly classification: AdviserResultClassification;
  readonly adviserRequestId: string;
  readonly invocationId: string;
  readonly observationId: string;
  readonly observationSourceStateDigest: string;
  readonly strategySelection?: Readonly<StrategySelectionReport>;
  readonly retrieval?: Readonly<AdviserRetrievalReport>;
  readonly context?: Readonly<AdviserContextReport>;
  readonly bridgeResult?: Readonly<InvocationResult<TProposal>>;
  readonly decodedProposal?: Readonly<TProposal>;
  readonly proposalValidation?: Readonly<DomainProposalValidation>;
  readonly failure?: Readonly<TacticalAdviserFailure>;
}

export class TacticalAdviserCoordinator {
  readonly #bridge: ModelInvocationCoordinator;
  readonly #repository: MemoryRepository | undefined;
  #disposed = false;

  constructor(bridge: ModelInvocationCoordinator, repository?: MemoryRepository) {
    this.#bridge = bridge;
    this.#repository = repository;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  async coordinate<TProposal>(
    input: Readonly<AdviserCoordinationInput<TProposal>>,
    signal?: AbortSignal,
  ): Promise<Readonly<AdviserCoordinationResult<TProposal>>> {
    const { request } = input;
    if (this.#disposed) {
      return result(request, "failed", {
        failure: freezeAdviserFailure({
          code: "adviser_disposed",
          stage: "lifecycle",
          message: "The tactical adviser coordinator is disposed.",
          ...requestContext(request),
        }),
      });
    }

    try {
      validateAdviserRequest(request, input.role);
      if (
        input.output.schemaId !== request.proposalSchemaId ||
        input.output.schemaVersion !== request.proposalSchemaVersion
      ) {
        return result(request, "failed", {
          failure: freezeAdviserFailure({
            code: "invalid_prompt_contract",
            stage: "request_validation",
            message: "Structured output identity does not match the adviser request.",
            ...requestContext(request),
          }),
        });
      }

      const strategySelection = input.strategyPortfolio.selectApplicableStrategies(
        input.applicabilityEvaluator,
        input.request.strategyCandidateBudget,
      );
      if (strategySelection.candidates.length === 0) {
        return result(request, "abstention", {
          strategySelection,
        });
      }

      const retrieval = await this.#retrieve(request);
      if ("failure" in retrieval) {
        return result(request, "failed", {
          strategySelection,
          failure: retrieval.failure,
        });
      }

      const context = buildAdviserContext({
        request,
        role: input.role,
        observation: input.observation,
        strategySelection,
        retrievedMemories: retrieval.memories,
        retrievedEvidence: retrieval.evidence,
        userRequest: input.userRequest,
        outputSchemaDescriptor: input.output.schema,
      });
      const bridgeResult = await this.#bridge.invoke(
        {
          invocationId: request.invocationId,
          providerId: request.providerId,
          modelId: request.modelId,
          messages: context.messages,
          budget: request.invocationBudget,
          output: input.output,
          exposeRawFailureOutput: request.exposeRawFailureOutput,
        },
        signal,
      );
      if (!bridgeResult.ok) {
        return this.#bridgeFailureResult(
          request,
          strategySelection,
          retrieval.report,
          context,
          bridgeResult,
        );
      }

      const decodedProposal = canonicalizeJson(
        bridgeResult.output,
      ) as unknown as Readonly<TProposal>;
      const proposalValidation = freezeProposalValidation(
        input.validateProposal(decodedProposal, {
          request,
          strategySelection,
          retrievedMemories: retrieval.memories,
          retrievedEvidence: retrieval.evidence,
          context,
        }),
      );
      const classification: AdviserResultClassification =
        proposalValidation.classification === "advisory_rejected"
          ? "rejected"
          : proposalValidation.classification === "abstained"
            ? "abstention"
            : "proposal";
      return result(request, classification, {
        strategySelection,
        retrieval: retrieval.report,
        context,
        bridgeResult,
        decodedProposal,
        proposalValidation,
      });
    } catch (error) {
      return result(request, "failed", {
        failure: toSafeAdviserFailure(error, {
          code: "adviser_internal_failure",
          stage: "lifecycle",
          message: "The tactical adviser failed safely.",
          ...requestContext(request),
        }),
      });
    }
  }

  dispose(): void {
    this.#disposed = true;
  }

  async #retrieve(request: Readonly<AdviserRequest>): Promise<
    | {
        readonly memories: readonly Readonly<EpisodicMemoryRecord>[];
        readonly evidence: readonly Readonly<EvidenceRecord>[];
        readonly report: Readonly<AdviserRetrievalReport>;
      }
    | { readonly failure: Readonly<TacticalAdviserFailure> }
  > {
    if (request.retrieval.mode === "disabled") {
      const empty = emptyRetrievalMetadata();
      return {
        memories: Object.freeze([]),
        evidence: Object.freeze([]),
        report: Object.freeze({ mode: "disabled", memory: empty, evidence: empty }),
      };
    }
    if (this.#repository === undefined) {
      return {
        failure: freezeAdviserFailure({
          code: "retrieval_failed",
          stage: "retrieval",
          message: "Authorized retrieval was requested without a memory repository.",
          ...requestContext(request),
        }),
      };
    }
    try {
      const [memoryResult, evidenceResult] = await Promise.all([
        this.#repository.queryMemory(request.retrieval.memoryQuery),
        request.retrieval.evidenceQuery === undefined
          ? Promise.resolve({ records: [], metadata: emptyRetrievalMetadata() })
          : this.#repository.queryEvidence(request.retrieval.evidenceQuery),
      ]);
      return {
        memories: Object.freeze([...memoryResult.records]),
        evidence: Object.freeze([...evidenceResult.records]),
        report: Object.freeze({
          mode: "enabled",
          memory: memoryResult.metadata,
          evidence: evidenceResult.metadata,
        }),
      };
    } catch (error) {
      return {
        failure: freezeAdviserFailure({
          code: "retrieval_failed",
          stage: "retrieval",
          message: "Authorized adviser retrieval failed without widening access.",
          ...requestContext(request),
          underlyingCode: safeCode(error),
        }),
      };
    }
  }

  #bridgeFailureResult<TProposal>(
    request: Readonly<AdviserRequest>,
    strategySelection: Readonly<StrategySelectionReport>,
    retrieval: Readonly<AdviserRetrievalReport>,
    context: Readonly<AdviserContextReport>,
    bridgeFailure: Readonly<InvocationFailure>,
  ): Readonly<AdviserCoordinationResult<TProposal>> {
    const mapping = bridgeFailureMapping(bridgeFailure);
    return result(request, mapping.classification, {
      strategySelection,
      retrieval,
      context,
      bridgeResult: bridgeFailure,
      failure: freezeAdviserFailure({
        code: mapping.code,
        stage: "bridge",
        message: "The accepted model bridge did not return a validated proposal.",
        ...requestContext(request),
        underlyingCode: bridgeFailure.code,
      }),
    });
  }
}

function result<TProposal>(
  request: Readonly<AdviserRequest>,
  classification: AdviserResultClassification,
  fields: Omit<
    AdviserCoordinationResult<TProposal>,
    | "classification"
    | "adviserRequestId"
    | "invocationId"
    | "observationId"
    | "observationSourceStateDigest"
  >,
): Readonly<AdviserCoordinationResult<TProposal>> {
  return Object.freeze({
    classification,
    adviserRequestId: request.adviserRequestId,
    invocationId: request.invocationId,
    observationId: request.observation.observationId,
    observationSourceStateDigest: request.observation.sourceStateDigest,
    ...fields,
  });
}

function freezeProposalValidation(
  validation: Readonly<DomainProposalValidation>,
): Readonly<DomainProposalValidation> {
  return Object.freeze({
    classification: validation.classification,
    issues: Object.freeze(
      validation.issues.map((issue) => Object.freeze({ code: issue.code, message: issue.message })),
    ),
  });
}

function emptyRetrievalMetadata(): Readonly<RetrievalMetadata> {
  return Object.freeze({
    returnedCount: 0,
    truncated: false,
    serializedCharacters: 0,
    orderingPolicy: "disabled",
    appliedFilters: Object.freeze([]),
  });
}

function bridgeFailureMapping(failure: Readonly<InvocationFailure>): {
  readonly classification: AdviserResultClassification;
  readonly code:
    "bridge_failed" | "proposal_empty" | "proposal_malformed" | "proposal_schema_rejected";
} {
  if (failure.code === "empty_output") return { classification: "failed", code: "proposal_empty" };
  if (failure.code === "malformed_output") {
    return { classification: "failed", code: "proposal_malformed" };
  }
  if (failure.code === "schema_rejected") {
    return { classification: "rejected", code: "proposal_schema_rejected" };
  }
  if (failure.code === "cancelled") return { classification: "cancelled", code: "bridge_failed" };
  if (failure.code === "deadline_exceeded") {
    return { classification: "deadline_exceeded", code: "bridge_failed" };
  }
  return { classification: "failed", code: "bridge_failed" };
}

function safeCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "failure" in error &&
    typeof error.failure === "object" &&
    error.failure !== null &&
    "code" in error.failure &&
    typeof error.failure.code === "string"
  ) {
    return error.failure.code;
  }
  return "repository_failure";
}

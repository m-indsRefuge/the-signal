import type { InvocationBudget } from "../model-bridge";
import type {
  EvidenceQuery,
  MemoryQuery,
  RetrievalBudget,
} from "../memory-fabric/retrieval-contract";
import {
  DATA_CLASSIFICATIONS,
  RETENTION_CLASSES,
  isCanonicalUtcTimestamp,
  isPublicIdentity,
  type DataClassification,
  type RetentionClass,
} from "../memory-fabric/evidence-contract";
import { STRATEGY_FAMILIES, type StrategyFamily } from "./strategy-contract";
import type { StrategySelectionBudget } from "./strategy-portfolio";
import { failAdviser } from "./failures";

export const SIGNAL_OFFICER_ROLE_ID = "signal_officer_tactical_adviser" as const;
export const SIGNAL_OFFICER_ROLE_VERSION = "1" as const;
export const SIGNAL_OFFICER_MAXIMUM_REASON_CHARACTERS = 600 as const;

export interface AdviserRole {
  readonly roleId: string;
  readonly roleVersion: string;
  readonly purpose: string;
  readonly allowedObservationLevels: readonly number[];
  readonly proposalSchemaId: string;
  readonly proposalSchemaVersion: string;
  readonly allowedStrategyFamilies: readonly StrategyFamily[];
  readonly requiredContextClasses: readonly string[];
  readonly prohibitedBehaviors: readonly string[];
  readonly supportsAbstention: boolean;
  readonly requiresTypedSupport: boolean;
  readonly maximumReasonCharacters: number;
}

export const SIGNAL_OFFICER_ADVISER_ROLE: Readonly<AdviserRole> = Object.freeze({
  roleId: SIGNAL_OFFICER_ROLE_ID,
  roleVersion: SIGNAL_OFFICER_ROLE_VERSION,
  purpose: "Provide bounded, evidence-grounded Keep the Signal tactical advice.",
  allowedObservationLevels: Object.freeze([0, 1]),
  proposalSchemaId: "kts.tactical-proposal",
  proposalSchemaVersion: "1",
  allowedStrategyFamilies: STRATEGY_FAMILIES,
  requiredContextClasses: Object.freeze([
    "observation",
    "applicable_strategies",
    "output_schema",
    "authority_rules",
  ]),
  prohibitedBehaviors: Object.freeze([
    "action_execution",
    "authority_claim",
    "hidden_reasoning_request",
    "evidence_suppression",
  ]),
  supportsAbstention: true,
  requiresTypedSupport: true,
  maximumReasonCharacters: SIGNAL_OFFICER_MAXIMUM_REASON_CHARACTERS,
});

export interface AdviserObservationIdentity {
  readonly observationId: string;
  readonly observationSchemaId: string;
  readonly observationSchemaVersion: string | number;
  readonly observationLevel: number;
  readonly sourceStateDigest: string;
}

export interface AdviserContextBudget {
  readonly maximumMessages: number;
  readonly maximumSerializedCharacters: number;
  readonly maximumStrategies: number;
  readonly maximumRetrievedMemories: number;
  readonly maximumEvidenceReferences: number;
  readonly maximumObservationCharacters: number;
  readonly maximumReasonCharacters: number;
  readonly maximumSystemInstructionCharacters: number;
  readonly maximumDeveloperInstructionCharacters: number;
}

export interface DisabledAdviserRetrieval {
  readonly mode: "disabled";
  readonly requestId: string;
  readonly allowedDomains: readonly string[];
  readonly allowedClassifications: readonly DataClassification[];
  readonly acceptedRetentionClasses: readonly RetentionClass[];
  readonly budget: Readonly<RetrievalBudget>;
}

export interface EnabledAdviserRetrieval {
  readonly mode: "enabled";
  readonly memoryQuery: Readonly<MemoryQuery>;
  readonly evidenceQuery?: Readonly<EvidenceQuery>;
}

export type AdviserRetrievalRequest = DisabledAdviserRetrieval | EnabledAdviserRetrieval;

export interface AdviserRequest {
  readonly adviserRequestId: string;
  readonly proposalId: string;
  readonly invocationId: string;
  readonly roleId: string;
  readonly roleVersion: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly observation: Readonly<AdviserObservationIdentity>;
  readonly providerId: string;
  readonly modelId: string;
  readonly invocationBudget: Readonly<InvocationBudget>;
  readonly contextBudget: Readonly<AdviserContextBudget>;
  readonly strategyCandidateBudget: Readonly<StrategySelectionBudget>;
  readonly retrieval: Readonly<AdviserRetrievalRequest>;
  readonly promptContractId: string;
  readonly promptContractVersion: string;
  readonly proposalSchemaId: string;
  readonly proposalSchemaVersion: string;
  readonly recordedAt: string;
  readonly sessionId?: string;
  readonly episodeId?: string;
  readonly predecessorRequestId?: string;
  readonly exposeRawFailureOutput: boolean;
}

export function validateAdviserRole(role: Readonly<AdviserRole>): void {
  if (
    !isPublicIdentity(role.roleId) ||
    !isPublicIdentity(role.roleVersion) ||
    !isPublicIdentity(role.proposalSchemaId) ||
    !isPublicIdentity(role.proposalSchemaVersion) ||
    !nonEmpty(role.purpose) ||
    !Array.isArray(role.allowedObservationLevels) ||
    role.allowedObservationLevels.length === 0 ||
    role.allowedObservationLevels.some((level) => !Number.isSafeInteger(level) || level < 0) ||
    !Array.isArray(role.allowedStrategyFamilies) ||
    role.allowedStrategyFamilies.some((family) => !STRATEGY_FAMILIES.includes(family)) ||
    !uniqueNonEmpty(role.requiredContextClasses) ||
    !uniqueNonEmpty(role.prohibitedBehaviors) ||
    role.supportsAbstention !== true ||
    role.requiresTypedSupport !== true ||
    !positiveInteger(role.maximumReasonCharacters)
  ) {
    failAdviser("invalid_adviser_role", "role_validation", "Adviser role is invalid.");
  }
}

export function validateAdviserRequest(
  request: Readonly<AdviserRequest>,
  role: Readonly<AdviserRole>,
): void {
  validateAdviserRole(role);
  const identities = [
    request.adviserRequestId,
    request.proposalId,
    request.invocationId,
    request.roleId,
    request.roleVersion,
    request.domainId,
    request.domainVersion,
    request.observation.observationId,
    request.observation.observationSchemaId,
    String(request.observation.observationSchemaVersion),
    request.providerId,
    request.modelId,
    request.promptContractId,
    request.promptContractVersion,
    request.proposalSchemaId,
    request.proposalSchemaVersion,
  ];
  if (identities.some((identity) => !isPublicIdentity(identity))) {
    failAdviser(
      "invalid_adviser_request",
      "request_validation",
      "Adviser request contains an invalid public identity.",
      requestContext(request),
    );
  }
  for (const optionalIdentity of [
    request.sessionId,
    request.episodeId,
    request.predecessorRequestId,
  ]) {
    if (optionalIdentity !== undefined && !isPublicIdentity(optionalIdentity)) {
      failAdviser(
        "invalid_adviser_request",
        "request_validation",
        "Adviser request contains an invalid optional identity.",
        requestContext(request),
      );
    }
  }
  if (
    request.roleId !== role.roleId ||
    request.roleVersion !== role.roleVersion ||
    request.proposalSchemaId !== role.proposalSchemaId ||
    request.proposalSchemaVersion !== role.proposalSchemaVersion ||
    !role.allowedObservationLevels.includes(request.observation.observationLevel) ||
    !nonEmpty(request.observation.sourceStateDigest) ||
    !isCanonicalUtcTimestamp(request.recordedAt) ||
    typeof request.exposeRawFailureOutput !== "boolean"
  ) {
    failAdviser(
      "invalid_adviser_request",
      "request_validation",
      "Adviser request conflicts with its role, observation, or supplied time.",
      requestContext(request),
    );
  }
  validateContextBudget(request.contextBudget, request);
  if (request.contextBudget.maximumReasonCharacters > role.maximumReasonCharacters) {
    failAdviser(
      "invalid_context_budget",
      "request_validation",
      "Adviser reason budget exceeds the role boundary.",
      requestContext(request),
    );
  }
  if (
    !nonNegativeInteger(request.strategyCandidateBudget.maximumStrategies) ||
    !nonNegativeInteger(request.strategyCandidateBudget.maximumSerializedCharacters)
  ) {
    failAdviser(
      "strategy_budget_exceeded",
      "request_validation",
      "Strategy candidate budget is invalid.",
      requestContext(request),
    );
  }
  if (request.invocationBudget.maximumAttempts !== 1) {
    failAdviser(
      "invalid_adviser_request",
      "request_validation",
      "Adviser invocation budget must allow exactly one attempt.",
      requestContext(request),
    );
  }
  validateRetrieval(request);
}

export function requestContext(
  request: Pick<AdviserRequest, "adviserRequestId" | "invocationId" | "observation">,
): {
  readonly adviserRequestId: string;
  readonly invocationId: string;
  readonly observationId: string;
} {
  return {
    adviserRequestId: request.adviserRequestId,
    invocationId: request.invocationId,
    observationId: request.observation.observationId,
  };
}

function validateContextBudget(
  budget: Readonly<AdviserContextBudget>,
  request: Readonly<AdviserRequest>,
): void {
  if (
    !positiveInteger(budget.maximumMessages) ||
    !positiveInteger(budget.maximumSerializedCharacters) ||
    !nonNegativeInteger(budget.maximumStrategies) ||
    !nonNegativeInteger(budget.maximumRetrievedMemories) ||
    !nonNegativeInteger(budget.maximumEvidenceReferences) ||
    !positiveInteger(budget.maximumObservationCharacters) ||
    !positiveInteger(budget.maximumReasonCharacters) ||
    !positiveInteger(budget.maximumSystemInstructionCharacters) ||
    !positiveInteger(budget.maximumDeveloperInstructionCharacters)
  ) {
    failAdviser(
      "invalid_context_budget",
      "request_validation",
      "Adviser context budget is invalid.",
      requestContext(request),
    );
  }
}

function validateRetrieval(request: Readonly<AdviserRequest>): void {
  const retrieval = request.retrieval;
  if (retrieval.mode !== "disabled" && retrieval.mode !== "enabled") {
    failAdviser(
      "retrieval_not_authorized",
      "request_validation",
      "Adviser retrieval mode is unsupported.",
      requestContext(request),
    );
  }
  if (retrieval.mode === "disabled") {
    if (
      !isPublicIdentity(retrieval.requestId) ||
      retrieval.allowedDomains.length !== 1 ||
      retrieval.allowedDomains[0] !== request.domainId ||
      retrieval.allowedClassifications.length === 0 ||
      retrieval.acceptedRetentionClasses.length === 0 ||
      !validAccessClasses(retrieval.allowedClassifications, retrieval.acceptedRetentionClasses) ||
      retrieval.budget.resultLimit !== 0 ||
      retrieval.budget.maximumSerializedCharacters !== 0 ||
      retrieval.budget.relationTraversalLimit !== 0
    ) {
      failAdviser(
        "retrieval_not_authorized",
        "request_validation",
        "Disabled retrieval must retain explicit policy and zero budgets.",
        requestContext(request),
      );
    }
    return;
  }
  if (typeof retrieval.memoryQuery !== "object" || retrieval.memoryQuery === null) {
    failAdviser(
      "retrieval_not_authorized",
      "request_validation",
      "Enabled retrieval requires an explicit memory query.",
      requestContext(request),
    );
  }
  const queries = [retrieval.memoryQuery, retrieval.evidenceQuery].filter(
    (query): query is MemoryQuery | EvidenceQuery => query !== undefined,
  );
  for (const query of queries) {
    if (
      !isPublicIdentity(query.requestId) ||
      query.allowedDomains.length !== 1 ||
      query.allowedDomains[0] !== request.domainId ||
      query.allowedClassifications.length === 0 ||
      query.acceptedRetentionClasses.length === 0 ||
      !validAccessClasses(query.allowedClassifications, query.acceptedRetentionClasses) ||
      !positiveInteger(query.budget.resultLimit) ||
      !positiveInteger(query.budget.maximumSerializedCharacters) ||
      !nonNegativeInteger(query.budget.relationTraversalLimit)
    ) {
      failAdviser(
        "retrieval_not_authorized",
        "request_validation",
        "Enabled retrieval requires exact domain authority and bounded queries.",
        requestContext(request),
      );
    }
  }
}

function validAccessClasses(
  classifications: readonly DataClassification[],
  retentionClasses: readonly RetentionClass[],
): boolean {
  return (
    classifications.every((value) => DATA_CLASSIFICATIONS.includes(value)) &&
    new Set(classifications).size === classifications.length &&
    retentionClasses.every((value) => RETENTION_CLASSES.includes(value)) &&
    new Set(retentionClasses).size === retentionClasses.length
  );
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueNonEmpty(values: readonly string[]): boolean {
  return Array.isArray(values) && values.every(nonEmpty) && new Set(values).size === values.length;
}

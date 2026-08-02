import { canonicalizeJson, type JsonObject, type JsonValue } from "../memory-fabric/canonical-json";
import { isPublicIdentity } from "../memory-fabric/evidence-contract";
import { failAdviser } from "./failures";
import type { StrategyReference } from "./strategy-contract";

export const PROPOSER_KINDS = Object.freeze([
  "model",
  "rule_based_baseline",
  "human_supplied",
  "test",
] as const);
export type ProposerKind = (typeof PROPOSER_KINDS)[number];

export const UNCERTAINTY_CLASSIFICATIONS = Object.freeze([
  "low",
  "medium",
  "high",
  "unknown",
] as const);
export type UncertaintyClassification = (typeof UNCERTAINTY_CLASSIFICATIONS)[number];

export const ABSTENTION_CODES = Object.freeze([
  "insufficient_observation",
  "insufficient_evidence",
  "contradictory_evidence",
  "no_applicable_strategy",
  "budget_limited",
  "model_uncertain",
  "unsafe_to_recommend",
] as const);
export type AbstentionCode = (typeof ABSTENTION_CODES)[number];

export const PROPOSAL_VALIDATION_CLASSIFICATIONS = Object.freeze([
  "schema_valid",
  "advisory_valid",
  "advisory_rejected",
  "abstained",
] as const);
export type ProposalValidationClassification = (typeof PROPOSAL_VALIDATION_CLASSIFICATIONS)[number];

export interface ProposalAbstention {
  readonly abstained: boolean;
  readonly code?: AbstentionCode;
}

export interface ProposalEnvelopeDraft<TPayload = JsonValue> {
  readonly proposalId: string;
  readonly proposalSchemaId: string;
  readonly proposalSchemaVersion: string;
  readonly adviserRequestId: string;
  readonly invocationId: string;
  readonly domainId: string;
  readonly domainVersion: string;
  readonly observationId: string;
  readonly observationSourceStateDigest: string;
  readonly adviserRoleId: string;
  readonly adviserRoleVersion: string;
  readonly proposerKind: ProposerKind;
  readonly proposerIdentity: JsonObject;
  readonly selectedStrategy?: Readonly<StrategyReference>;
  readonly payload: TPayload;
  readonly confidenceBasisPoints: number;
  readonly uncertainty: UncertaintyClassification;
  readonly abstention: Readonly<ProposalAbstention>;
  readonly publicReason: string;
  readonly evidenceReferences: readonly string[];
  readonly strategyReferences: readonly StrategyReference[];
  readonly provenance: JsonObject;
  readonly validationClassification: ProposalValidationClassification;
}

export type ProposalEnvelope<TPayload = JsonValue> = ProposalEnvelopeDraft<TPayload>;

export function createProposalEnvelope<TPayload>(
  draft: Readonly<ProposalEnvelopeDraft<TPayload>>,
): Readonly<ProposalEnvelope<TPayload>> {
  const identities = [
    draft.proposalId,
    draft.proposalSchemaId,
    draft.proposalSchemaVersion,
    draft.adviserRequestId,
    draft.invocationId,
    draft.domainId,
    draft.domainVersion,
    draft.observationId,
    draft.adviserRoleId,
    draft.adviserRoleVersion,
  ];
  if (
    identities.some((value) => !isPublicIdentity(value)) ||
    typeof draft.observationSourceStateDigest !== "string" ||
    draft.observationSourceStateDigest.length === 0
  ) {
    failAdviser(
      "invalid_proposal_identity",
      "proposal_validation",
      "Proposal identity or lineage is invalid.",
    );
  }
  if (
    !PROPOSER_KINDS.includes(draft.proposerKind) ||
    !UNCERTAINTY_CLASSIFICATIONS.includes(draft.uncertainty) ||
    !PROPOSAL_VALIDATION_CLASSIFICATIONS.includes(draft.validationClassification) ||
    !Number.isSafeInteger(draft.confidenceBasisPoints) ||
    draft.confidenceBasisPoints < 0 ||
    draft.confidenceBasisPoints > 10_000 ||
    typeof draft.publicReason !== "string" ||
    draft.publicReason.length === 0
  ) {
    failAdviser("invalid_proposal", "proposal_validation", "Proposal scalar fields are invalid.");
  }
  if (
    typeof draft.abstention.abstained !== "boolean" ||
    (draft.abstention.abstained &&
      !ABSTENTION_CODES.includes(draft.abstention.code as AbstentionCode)) ||
    (!draft.abstention.abstained && draft.abstention.code !== undefined)
  ) {
    failAdviser("invalid_proposal", "proposal_validation", "Proposal abstention state is invalid.");
  }
  validateReferences(draft.evidenceReferences, "evidence");
  const strategyKeys = draft.strategyReferences.map((reference) => {
    validateStrategyReference(reference);
    return `${reference.strategyId}\u0000${reference.strategyVersion}`;
  });
  if (new Set(strategyKeys).size !== strategyKeys.length) {
    failAdviser(
      "invalid_proposal",
      "proposal_validation",
      "Proposal strategy references must be unique.",
    );
  }
  if (draft.selectedStrategy !== undefined) validateStrategyReference(draft.selectedStrategy);
  try {
    return canonicalizeJson(draft) as unknown as Readonly<ProposalEnvelope<TPayload>>;
  } catch {
    failAdviser("invalid_proposal", "proposal_validation", "Proposal must be JSON-compatible.");
  }
}

function validateReferences(values: readonly string[], label: string): void {
  if (
    !Array.isArray(values) ||
    values.some((value) => !isPublicIdentity(value)) ||
    new Set(values).size !== values.length
  ) {
    failAdviser(
      "invalid_proposal",
      "proposal_validation",
      `Proposal ${label} references must be unique public identities.`,
    );
  }
}

function validateStrategyReference(reference: Readonly<StrategyReference>): void {
  if (!isPublicIdentity(reference.strategyId) || !isPublicIdentity(reference.strategyVersion)) {
    failAdviser(
      "invalid_proposal",
      "proposal_validation",
      "Proposal strategy reference is invalid.",
    );
  }
}

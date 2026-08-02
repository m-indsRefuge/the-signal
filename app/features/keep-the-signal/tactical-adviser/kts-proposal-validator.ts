import { canonicalStringify } from "../../intelligence-harness/memory-fabric/canonical-json";
import type { AdviserRequest } from "../../intelligence-harness/tactical-adviser/adviser-contract";
import type { DomainProposalValidation } from "../../intelligence-harness/tactical-adviser/adviser-coordinator";
import type { TacticalAdviserFailureCode } from "../../intelligence-harness/tactical-adviser/failures";
import type { StrategyCandidate } from "../../intelligence-harness/tactical-adviser/strategy-portfolio";
import type { KtsObservationPacket } from "../intelligence-adapter";
import {
  isKtsTacticalProposal,
  type KtsSupportingFact,
  type KtsTacticalProposal,
} from "./kts-proposal-contract";

export interface KtsProposalValidationInput {
  readonly proposal: unknown;
  readonly request: Readonly<AdviserRequest>;
  readonly observation: Readonly<KtsObservationPacket>;
  readonly strategyCandidates: readonly Readonly<StrategyCandidate>[];
  readonly allowedEvidenceIds: readonly string[];
  readonly allowedMemoryIds: readonly string[];
  readonly allowedContradictionIds: readonly string[];
  readonly maximumReasonCharacters: number;
  readonly schemaOnly?: boolean;
}

interface ValidationIssue {
  readonly code: TacticalAdviserFailureCode;
  readonly message: string;
}

export function validateKtsTacticalProposal(
  input: Readonly<KtsProposalValidationInput>,
): Readonly<DomainProposalValidation> {
  const issues: ValidationIssue[] = [];
  if (!isKtsTacticalProposal(input.proposal)) {
    return freezeReport("advisory_rejected", [
      { code: "invalid_proposal", message: "KTS proposal schema is invalid." },
    ]);
  }
  if (input.schemaOnly === true) return freezeReport("schema_valid", []);
  const proposal = input.proposal;
  validateLineage(proposal, input, issues);
  validateTarget(proposal, input.observation, issues);
  validateReadiness(proposal, input.observation, issues);
  validateStrategy(proposal, input.strategyCandidates, issues);
  validateReferences(proposal, input, issues);
  validateSupportingFacts(proposal, input, issues);
  validateAbstention(proposal, issues);
  if (proposal.reason.length > input.maximumReasonCharacters) {
    issues.push({
      code: "invalid_proposal",
      message: "Proposal public reason exceeds its budget.",
    });
  }
  if (
    !proposal.abstention.abstained &&
    proposal.confidenceBasisPoints >= 8_000 &&
    (proposal.uncertainty === "high" || proposal.uncertainty === "unknown")
  ) {
    issues.push({
      code: "proposal_not_grounded",
      message: "High confidence conflicts with declared high or unknown uncertainty.",
    });
  }
  if (!proposal.abstention.abstained && proposal.supportingFacts.length === 0) {
    issues.push({
      code: "proposal_not_grounded",
      message: "A non-abstaining proposal requires typed supporting facts.",
    });
  }
  if (issues.length > 0) return freezeReport("advisory_rejected", issues);
  return freezeReport(proposal.abstention.abstained ? "abstained" : "advisory_valid", []);
}

function validateLineage(
  proposal: Readonly<KtsTacticalProposal>,
  input: Readonly<KtsProposalValidationInput>,
  issues: ValidationIssue[],
): void {
  if (
    proposal.proposalId !== input.request.proposalId ||
    proposal.adviserRequestId !== input.request.adviserRequestId ||
    proposal.observationId !== input.request.observation.observationId ||
    proposal.observationId !== input.observation.metadata.observationId ||
    proposal.sourceStateDigest !== input.request.observation.sourceStateDigest ||
    proposal.sourceStateDigest !== input.observation.metadata.sourceStateDigest
  ) {
    issues.push({
      code: "invalid_proposal_identity",
      message: "Proposal request or observation lineage does not match.",
    });
  }
}

function validateTarget(
  proposal: Readonly<KtsTacticalProposal>,
  observation: Readonly<KtsObservationPacket>,
  issues: ValidationIssue[],
): void {
  if (proposal.target.kind === "enemy") {
    if (!observation.entities.enemies.some((entity) => entity.id === proposal.target.entityId)) {
      issues.push({
        code: "invalid_target_reference",
        message: "Target enemy is absent from the bounded observation.",
      });
    }
  } else if (proposal.target.kind === "enemy_projectile") {
    if (
      !observation.entities.enemyProjectiles.some(
        (entity) => entity.id === proposal.target.entityId,
      )
    ) {
      issues.push({
        code: "invalid_target_reference",
        message: "Target projectile is absent from the bounded observation.",
      });
    }
  }
}

function validateReadiness(
  proposal: Readonly<KtsTacticalProposal>,
  observation: Readonly<KtsObservationPacket>,
  issues: ValidationIssue[],
): void {
  if (proposal.fireRecommendation === "fire_now" && !observation.actionSpace.readiness.fireReady) {
    issues.push({
      code: "unready_recommendation",
      message: "Immediate fire is not readiness-consistent.",
    });
  }
  if (
    proposal.recoveryRecommendation === "activate_now" &&
    !observation.actionSpace.readiness.recoveryPulseReady
  ) {
    issues.push({
      code: "unready_recommendation",
      message: "Immediate recovery is not readiness-consistent.",
    });
  }
  const transfer = transferChannels(proposal.powerTransferRecommendation);
  if (
    transfer !== null &&
    !observation.actionSpace.readiness.powerShiftOptions.some(
      (option) => option.from === transfer.from && option.to === transfer.to && option.ready,
    )
  ) {
    issues.push({
      code: "unready_recommendation",
      message: "Immediate power transfer is not readiness-consistent.",
    });
  }
}

function validateStrategy(
  proposal: Readonly<KtsTacticalProposal>,
  candidates: readonly Readonly<StrategyCandidate>[],
  issues: ValidationIssue[],
): void {
  if (proposal.selectedStrategy === null) {
    if (!proposal.abstention.abstained) {
      issues.push({
        code: "unsupported_strategy_reference",
        message: "A non-abstaining proposal requires a selected strategy.",
      });
    }
    return;
  }
  const candidate = candidates.find(
    ({ strategy }) =>
      strategy.strategyId === proposal.selectedStrategy?.strategyId &&
      strategy.strategyVersion === proposal.selectedStrategy?.strategyVersion,
  );
  if (candidate === undefined) {
    issues.push({
      code: "unsupported_strategy_reference",
      message: "Selected strategy is outside the supplied candidate portfolio.",
    });
  } else if (!candidate.applicability.applicable) {
    issues.push({
      code: "strategy_not_applicable",
      message: "Selected strategy is not applicable to the supplied observation.",
    });
  }
}

function validateReferences(
  proposal: Readonly<KtsTacticalProposal>,
  input: Readonly<KtsProposalValidationInput>,
  issues: ValidationIssue[],
): void {
  const evidence = new Set(input.allowedEvidenceIds);
  const contradictions = new Set(input.allowedContradictionIds);
  for (const evidenceId of proposal.evidenceReferences) {
    if (!evidence.has(evidenceId)) {
      issues.push({
        code: "unsupported_evidence_reference",
        message: "Proposal references evidence outside the retrieval result.",
      });
    }
  }
  for (const evidenceId of proposal.contradictionReferences) {
    if (!contradictions.has(evidenceId)) {
      issues.push({
        code: "unsupported_evidence_reference",
        message: "Proposal references a contradiction outside the retrieval result.",
      });
    }
  }
}

function validateSupportingFacts(
  proposal: Readonly<KtsTacticalProposal>,
  input: Readonly<KtsProposalValidationInput>,
  issues: ValidationIssue[],
): void {
  for (const fact of proposal.supportingFacts) {
    if (!supportingFactExists(fact, input)) {
      issues.push({
        code: fact.kind === "strategy" ? "unsupported_strategy_reference" : "proposal_not_grounded",
        message: `Supporting ${fact.kind} reference is not grounded in supplied context.`,
      });
    }
  }
}

function supportingFactExists(
  fact: Readonly<KtsSupportingFact>,
  input: Readonly<KtsProposalValidationInput>,
): boolean {
  switch (fact.kind) {
    case "observation_field": {
      const value = readObservationPath(input.observation, fact.path);
      if (value.missing) return false;
      try {
        return canonicalStringify(value.value) === canonicalStringify(fact.value);
      } catch {
        return false;
      }
    }
    case "entity":
      return fact.entityKind === "enemy"
        ? input.observation.entities.enemies.some((entity) => entity.id === fact.entityId)
        : input.observation.entities.enemyProjectiles.some((entity) => entity.id === fact.entityId);
    case "action_readiness": {
      const value = readObservationPath(input.observation, fact.path);
      return (
        !value.missing &&
        value.value === fact.ready &&
        fact.path.startsWith("actionSpace.readiness.")
      );
    }
    case "strategy":
      return input.strategyCandidates.some(
        ({ strategy }) =>
          strategy.strategyId === fact.strategyId &&
          strategy.strategyVersion === fact.strategyVersion,
      );
    case "evidence":
      return input.allowedEvidenceIds.includes(fact.evidenceId);
    case "memory":
      return input.allowedMemoryIds.includes(fact.memoryId);
    case "contradiction":
      return input.allowedContradictionIds.includes(fact.evidenceId);
  }
}

function validateAbstention(
  proposal: Readonly<KtsTacticalProposal>,
  issues: ValidationIssue[],
): void {
  if (!proposal.abstention.abstained) return;
  if (
    (proposal.intent !== "hold" && proposal.intent !== "observe") ||
    proposal.fireRecommendation === "fire_now" ||
    proposal.recoveryRecommendation === "activate_now" ||
    proposal.powerTransferRecommendation !== "none" ||
    proposal.target.kind !== "none"
  ) {
    issues.push({
      code: "invalid_proposal",
      message: "An abstention cannot include an immediate action-like recommendation.",
    });
  }
}

function transferChannels(recommendation: KtsTacticalProposal["powerTransferRecommendation"]): {
  readonly from: "weapons" | "defence" | "signal";
  readonly to: "weapons" | "defence" | "signal";
} | null {
  if (recommendation === "none") return null;
  const [from, , to] = recommendation.split("_");
  return {
    from: from as "weapons" | "defence" | "signal",
    to: to as "weapons" | "defence" | "signal",
  };
}

function readObservationPath(
  observation: Readonly<KtsObservationPacket>,
  path: string,
): { readonly missing: boolean; readonly value?: unknown } {
  const segments = path.split(".");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !/^[A-Za-z][A-Za-z0-9]*$/.test(segment) ||
        segment === "constructor" ||
        segment === "prototype",
    )
  ) {
    return { missing: true };
  }
  let current: unknown = observation;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return { missing: true };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { missing: false, value: current };
}

function freezeReport(
  classification: DomainProposalValidation["classification"],
  issues: readonly ValidationIssue[],
): Readonly<DomainProposalValidation> {
  return Object.freeze({
    classification,
    issues: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))),
  });
}

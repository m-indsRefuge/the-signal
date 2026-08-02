import { describe, expect, it } from "vitest";

import {
  canonicalStringify,
  type JsonObject,
} from "../app/features/intelligence-harness/memory-fabric/canonical-json";
import {
  validateEvidenceRecord,
  type EvidenceRecord,
} from "../app/features/intelligence-harness/memory-fabric/evidence-contract";
import { createProposalEnvelope } from "../app/features/intelligence-harness/tactical-adviser/proposal-contract";
import { createEvaluationCase } from "../app/features/intelligence-harness/tactical-adviser/evaluation-contract";
import { createInitialGameState } from "../app/features/keep-the-signal/engine";
import {
  DEFAULT_KTS_OBSERVATION_BUDGET,
  projectKtsObservation,
  type KtsObservationPacket,
} from "../app/features/keep-the-signal/intelligence-adapter";
import {
  draftKtsEvaluationEvidence,
  draftKtsProposalEvidence,
  type KtsAdviserEvidenceGovernance,
  type KtsProposalEvidenceInput,
} from "../app/features/keep-the-signal/tactical-adviser/kts-adviser-evidence";
import {
  createKtsTacticalProposal,
  KTS_TACTICAL_PROPOSAL_SCHEMA_ID,
  KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION,
} from "../app/features/keep-the-signal/tactical-adviser/kts-proposal-contract";

const STRATEGY_REFERENCE = Object.freeze({
  strategyId: "uncertainty-safe-hold",
  strategyVersion: "1",
});

function observation(): KtsObservationPacket {
  const result = projectKtsObservation(createInitialGameState({ seed: 42 }), [], {
    observationId: "observation:evidence",
    requestedLevel: 1,
    budget: DEFAULT_KTS_OBSERVATION_BUDGET,
  });
  if (!result.ok) throw new Error(result.failure.message);
  return result.observation;
}

function governance(
  overrides: Partial<KtsAdviserEvidenceGovernance> = {},
): KtsAdviserEvidenceGovernance {
  return {
    evidenceId: "evidence:proposal",
    recordedAt: "2026-08-01T00:00:00.000Z",
    acceptanceState: "candidate",
    classification: "internal",
    retentionClass: "benchmark",
    tags: ["proposal", "adviser"],
    actorId: "operator:test",
    operationId: "operation:test",
    ...overrides,
  };
}

function proposalEnvelope(
  value: Readonly<KtsObservationPacket>,
  proposerKind: "model" | "rule_based_baseline" = "model",
) {
  const payload = createKtsTacticalProposal({
    proposalId: "proposal:evidence",
    proposalSchemaId: KTS_TACTICAL_PROPOSAL_SCHEMA_ID,
    proposalSchemaVersion: KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION,
    adviserRequestId: "request:evidence",
    observationId: value.metadata.observationId,
    sourceStateDigest: value.metadata.sourceStateDigest,
    intent: "hold",
    movement: { moveX: 0, moveY: 0, priority: "medium" },
    fireRecommendation: "hold_fire",
    powerTransferRecommendation: "none",
    recoveryRecommendation: "hold",
    target: { kind: "none", priority: "low" },
    selectedStrategy: STRATEGY_REFERENCE,
    confidenceBasisPoints: 6_000,
    uncertainty: "medium",
    abstention: { abstained: false },
    reason: "Hold while the bounded observation remains stable.",
    supportingFacts: [
      { kind: "observation_field", path: "lifecycle.status", value: value.lifecycle.status },
      { kind: "strategy", ...STRATEGY_REFERENCE },
      { kind: "evidence", evidenceId: "evidence:support" },
      { kind: "contradiction", evidenceId: "evidence:contradiction" },
    ],
    evidenceReferences: ["evidence:support"],
    contradictionReferences: ["evidence:contradiction"],
    warnings: [],
  });
  const proposerIdentity: JsonObject =
    proposerKind === "model"
      ? { providerId: "provider:test", modelId: "model:test" }
      : { baselineId: "kts-rule-based", baselineVersion: "1" };
  return createProposalEnvelope({
    proposalId: payload.proposalId,
    proposalSchemaId: payload.proposalSchemaId,
    proposalSchemaVersion: payload.proposalSchemaVersion,
    adviserRequestId: payload.adviserRequestId,
    invocationId: "invocation:evidence",
    domainId: "keep-the-signal",
    domainVersion: `${value.metadata.engineVersion}:${value.metadata.rulesetVersion}`,
    observationId: value.metadata.observationId,
    observationSourceStateDigest: value.metadata.sourceStateDigest,
    adviserRoleId: "signal_officer_tactical_adviser",
    adviserRoleVersion: "1",
    proposerKind,
    proposerIdentity,
    selectedStrategy: STRATEGY_REFERENCE,
    payload,
    confidenceBasisPoints: payload.confidenceBasisPoints,
    uncertainty: payload.uncertainty,
    abstention: payload.abstention,
    publicReason: payload.reason,
    evidenceReferences: payload.evidenceReferences,
    strategyReferences: [STRATEGY_REFERENCE],
    provenance: proposerIdentity,
    validationClassification: "advisory_valid",
  });
}

function proposalEvidenceInput(
  overrides: Partial<KtsProposalEvidenceInput> = {},
): KtsProposalEvidenceInput {
  const value = observation();
  return {
    governance: governance(),
    observation: value,
    proposal: proposalEnvelope(value),
    observationEvidenceId: "evidence:observation",
    providerAndModelProvenance: { providerId: "provider:test", modelId: "model:test" },
    retrievedMemoryIds: ["memory:support"],
    retrievedEvidenceIds: ["evidence:support"],
    contradictionEvidenceIds: ["evidence:contradiction"],
    ...overrides,
  };
}

function evidencePayload(record: Readonly<EvidenceRecord>): JsonObject {
  return record.payload as JsonObject;
}

function evaluationCase(value: Readonly<KtsObservationPacket>) {
  return createEvaluationCase({
    caseId: "case:evidence",
    match: {
      seedOrEpisodeFamily: "seed:42",
      engineVersion: value.metadata.engineVersion,
      rulesetVersion: value.metadata.rulesetVersion,
      observationSchemaId: value.metadata.observationSchemaId,
      observationSchemaVersion: String(value.metadata.observationSchemaVersion),
      observationLevel: value.level,
      decisionPoint: `tick:${value.metadata.tick}`,
      partitionId: "partition:test",
    },
    observationId: value.metadata.observationId,
    adviserClassification: "base_model_with_retrieval",
    proposerIdentity: { providerId: "provider:test", modelId: "model:test" },
    strategyReferences: [STRATEGY_REFERENCE],
    retrievalEnabled: true,
    proposal: { intent: "hold", confidenceBasisPoints: 6_000 },
    proposalValidation: "advisory_valid",
    authoritativeDecisionEvidence: { decision: "hold" },
    authoritativeOutcomeEvidence: { signalRetained: true },
    humanUsefulnessBasisPoints: 7_000,
    metricValues: { schema_compliance: 1, advisory_valid: 1, labelled_success: 1 },
    evaluatorId: "evaluator:test",
    evaluatorVersion: "1",
  });
}

describe("KTS-I4-E adviser evidence drafting", () => {
  it("drafts proposal evidence without repository persistence", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(record.sourceType).toBe("proposal");
    expect(evidencePayload(record).persistencePerformed).toBe(false);
  });

  it("uses the accepted evidence schema", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(record).toMatchObject({
      evidenceSchemaId: "construct.evidence",
      evidenceSchemaVersion: 1,
    });
  });

  it("preserves proposal schema lineage", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(record).toMatchObject({
      sourceSchemaId: KTS_TACTICAL_PROPOSAL_SCHEMA_ID,
      sourceSchemaVersion: 1,
      sourceIdentity: "proposal:evidence",
    });
  });

  it("preserves complete observation lineage", async () => {
    const input = proposalEvidenceInput();
    const record = await draftKtsProposalEvidence(input);
    expect(record.authoritativePosition).toEqual({
      observationId: input.observation.metadata.observationId,
      seed: input.observation.metadata.seed,
      sourceStateDigest: input.observation.metadata.sourceStateDigest,
      tick: input.observation.metadata.tick,
    });
  });

  it("preserves a caller-supplied observation evidence identity", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(evidencePayload(record).observationEvidenceId).toBe("evidence:observation");
  });

  it("preserves model provenance when supplied", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(evidencePayload(record).providerAndModelProvenance).toEqual({
      modelId: "model:test",
      providerId: "provider:test",
    });
  });

  it("records null external model provenance when it is not applicable", async () => {
    const value = observation();
    const record = await draftKtsProposalEvidence(
      proposalEvidenceInput({
        proposal: proposalEnvelope(value, "rule_based_baseline"),
        observation: value,
        providerAndModelProvenance: undefined,
      }),
    );
    expect(evidencePayload(record).providerAndModelProvenance).toBeNull();
  });

  it("preserves baseline provenance through proposer identity", async () => {
    const value = observation();
    const record = await draftKtsProposalEvidence(
      proposalEvidenceInput({
        proposal: proposalEnvelope(value, "rule_based_baseline"),
        observation: value,
      }),
    );
    expect(evidencePayload(record)).toMatchObject({
      proposerKind: "rule_based_baseline",
      proposerIdentity: { baselineId: "kts-rule-based", baselineVersion: "1" },
    });
  });

  it("preserves retrieved memory references", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(evidencePayload(record).retrievedMemoryIds).toEqual(["memory:support"]);
  });

  it("preserves retrieved supporting evidence references", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(evidencePayload(record).retrievedEvidenceIds).toEqual(["evidence:support"]);
  });

  it("preserves contradictory evidence independently", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(evidencePayload(record).contradictionEvidenceIds).toEqual(["evidence:contradiction"]);
  });

  it("preserves selected strategy references", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(evidencePayload(record).selectedStrategy).toEqual(STRATEGY_REFERENCE);
    expect(evidencePayload(record).strategyReferences).toEqual([STRATEGY_REFERENCE]);
  });

  it("preserves validation confidence uncertainty and abstention", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(evidencePayload(record)).toMatchObject({
      validationClassification: "advisory_valid",
      confidenceBasisPoints: 6_000,
      uncertainty: "medium",
      abstention: { abstained: false },
    });
  });

  it("preserves caller-supplied governance metadata", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(record).toMatchObject({
      evidenceId: "evidence:proposal",
      acceptanceState: "candidate",
      classification: "internal",
      retentionClass: "benchmark",
      actorId: "operator:test",
      operationId: "operation:test",
    });
  });

  it("sorts governance tags canonically", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(record.tags).toEqual(["adviser", "proposal"]);
  });

  it("produces a stable canonical digest", async () => {
    const input = proposalEvidenceInput();
    const left = await draftKtsProposalEvidence(input);
    const right = await draftKtsProposalEvidence(input);
    expect(left.contentDigest).toBe(right.contentDigest);
    expect(canonicalStringify(left)).toBe(canonicalStringify(right));
  });

  it("changes the digest when provenance changes", async () => {
    const input = proposalEvidenceInput();
    const left = await draftKtsProposalEvidence(input);
    const right = await draftKtsProposalEvidence({
      ...input,
      providerAndModelProvenance: { providerId: "provider:test", modelId: "model:other" },
    });
    expect(left.contentDigest).not.toBe(right.contentDigest);
  });

  it("creates deeply immutable evidence", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.payload)).toBe(true);
    expect(Object.isFrozen(evidencePayload(record).retrievedEvidenceIds)).toBe(true);
  });

  it("passes the accepted evidence-record validator", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    await expect(validateEvidenceRecord(record)).resolves.toBeUndefined();
  });

  it("rejects invalid governance timestamps", async () => {
    await expect(
      draftKtsProposalEvidence(
        proposalEvidenceInput({ governance: governance({ recordedAt: "not-a-timestamp" }) }),
      ),
    ).rejects.toThrow();
  });

  it("rejects duplicate governance tags", async () => {
    await expect(
      draftKtsProposalEvidence(
        proposalEvidenceInput({ governance: governance({ tags: ["adviser", "adviser"] }) }),
      ),
    ).rejects.toThrow();
  });

  it("rejects an invalid observation evidence identity", async () => {
    await expect(
      draftKtsProposalEvidence(
        proposalEvidenceInput({ observationEvidenceId: "invalid evidence identity" }),
      ),
    ).rejects.toThrow("lineage");
  });

  it("rejects duplicate retrieved references", async () => {
    await expect(
      draftKtsProposalEvidence(
        proposalEvidenceInput({ retrievedMemoryIds: ["memory:one", "memory:one"] }),
      ),
    ).rejects.toThrow("references");
  });

  it("does not mutate the supplied observation or proposal envelope", async () => {
    const input = proposalEvidenceInput();
    const before = canonicalStringify({ observation: input.observation, proposal: input.proposal });
    await draftKtsProposalEvidence(input);
    expect(canonicalStringify({ observation: input.observation, proposal: input.proposal })).toBe(
      before,
    );
  });

  it("detects a tampered proposal evidence digest", async () => {
    const record = await draftKtsProposalEvidence(proposalEvidenceInput());
    const tampered = { ...record, contentDigest: "0".repeat(64) } as EvidenceRecord;
    await expect(validateEvidenceRecord(tampered)).rejects.toThrow();
  });

  it("drafts evaluation evidence without repository persistence", async () => {
    const value = observation();
    const record = await draftKtsEvaluationEvidence({
      governance: governance({ evidenceId: "evidence:evaluation", tags: ["evaluation"] }),
      evaluationCase: evaluationCase(value),
      proposalEvidenceId: "evidence:proposal",
      limitations: ["bounded-observation-only"],
    });
    expect(record.sourceType).toBe("evaluation");
    expect(evidencePayload(record).persistencePerformed).toBe(false);
  });

  it("uses the fixed evaluation evidence schema", async () => {
    const value = observation();
    const record = await draftKtsEvaluationEvidence({
      governance: governance({ evidenceId: "evidence:evaluation" }),
      evaluationCase: evaluationCase(value),
      proposalEvidenceId: "evidence:proposal",
      limitations: [],
    });
    expect(record).toMatchObject({
      sourceSchemaId: "kts.adviser-evaluation",
      sourceSchemaVersion: 1,
      sourceIdentity: "case:evidence",
    });
  });

  it("preserves matched evaluation lineage", async () => {
    const value = observation();
    const record = await draftKtsEvaluationEvidence({
      governance: governance({ evidenceId: "evidence:evaluation" }),
      evaluationCase: evaluationCase(value),
      proposalEvidenceId: "evidence:proposal",
      limitations: [],
    });
    expect(record.authoritativePosition).toEqual({
      decisionPoint: `tick:${value.metadata.tick}`,
      observationId: value.metadata.observationId,
      partitionId: "partition:test",
      seedOrEpisodeFamily: "seed:42",
    });
  });

  it("links evaluation evidence to its proposal draft", async () => {
    const value = observation();
    const record = await draftKtsEvaluationEvidence({
      governance: governance({ evidenceId: "evidence:evaluation" }),
      evaluationCase: evaluationCase(value),
      proposalEvidenceId: "evidence:proposal",
      limitations: [],
    });
    expect(evidencePayload(record).proposalEvidenceId).toBe("evidence:proposal");
  });

  it("preserves evaluation limitations", async () => {
    const value = observation();
    const record = await draftKtsEvaluationEvidence({
      governance: governance({ evidenceId: "evidence:evaluation" }),
      evaluationCase: evaluationCase(value),
      proposalEvidenceId: "evidence:proposal",
      limitations: ["bounded-observation-only", "descriptive-only"],
    });
    expect(evidencePayload(record).limitations).toEqual([
      "bounded-observation-only",
      "descriptive-only",
    ]);
  });

  it("preserves supplied evaluation metrics without deriving new values", async () => {
    const value = observation();
    const record = await draftKtsEvaluationEvidence({
      governance: governance({ evidenceId: "evidence:evaluation" }),
      evaluationCase: evaluationCase(value),
      proposalEvidenceId: "evidence:proposal",
      limitations: [],
    });
    expect(evidencePayload(record).metricValues).toEqual({
      advisory_valid: 1,
      labelled_success: 1,
      schema_compliance: 1,
    });
  });

  it("passes the accepted validator for evaluation evidence", async () => {
    const value = observation();
    const record = await draftKtsEvaluationEvidence({
      governance: governance({ evidenceId: "evidence:evaluation" }),
      evaluationCase: evaluationCase(value),
      proposalEvidenceId: "evidence:proposal",
      limitations: [],
    });
    await expect(validateEvidenceRecord(record)).resolves.toBeUndefined();
  });

  it("rejects an invalid proposal evidence reference", async () => {
    const value = observation();
    await expect(
      draftKtsEvaluationEvidence({
        governance: governance({ evidenceId: "evidence:evaluation" }),
        evaluationCase: evaluationCase(value),
        proposalEvidenceId: "invalid evidence identity",
        limitations: [],
      }),
    ).rejects.toThrow("references");
  });
});

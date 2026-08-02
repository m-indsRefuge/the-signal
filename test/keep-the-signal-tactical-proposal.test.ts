import { describe, expect, it } from "vitest";

import {
  ABSTENTION_CODES,
  UNCERTAINTY_CLASSIFICATIONS,
} from "../app/features/intelligence-harness/tactical-adviser/proposal-contract";
import {
  KTS_FIRE_RECOMMENDATIONS,
  KTS_POWER_TRANSFER_RECOMMENDATIONS,
  KTS_RECOVERY_RECOMMENDATIONS,
  KTS_TACTICAL_INTENTS,
  KTS_TACTICAL_PROPOSAL_OUTPUT,
  KTS_TACTICAL_PROPOSAL_SCHEMA_ID,
  KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION,
  KTS_TARGET_KINDS,
  createKtsTacticalProposal,
  isKtsTacticalProposal,
  type KtsTacticalProposal,
} from "../app/features/keep-the-signal/tactical-adviser/kts-proposal-contract";

function proposal(overrides: Partial<KtsTacticalProposal> = {}): KtsTacticalProposal {
  return {
    proposalId: "proposal:test",
    proposalSchemaId: KTS_TACTICAL_PROPOSAL_SCHEMA_ID,
    proposalSchemaVersion: KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION,
    adviserRequestId: "request:test",
    observationId: "observation:test",
    sourceStateDigest: "digest-test",
    intent: "hold",
    movement: { moveX: 0, moveY: 0, priority: "low" },
    fireRecommendation: "hold_fire",
    powerTransferRecommendation: "none",
    recoveryRecommendation: "hold",
    target: { kind: "none", priority: "low" },
    selectedStrategy: { strategyId: "strategy:test", strategyVersion: "1" },
    confidenceBasisPoints: 5_000,
    uncertainty: "medium",
    abstention: { abstained: false },
    reason: "Hold while the bounded observation remains uncertain.",
    supportingFacts: [{ kind: "observation_field", path: "lifecycle.status", value: "running" }],
    evidenceReferences: [],
    contradictionReferences: [],
    warnings: ["advisory_only"],
    ...overrides,
  };
}

describe("KTS-I4-E tactical proposal schema", () => {
  it("exports the exact schema identity", () => {
    expect([KTS_TACTICAL_PROPOSAL_SCHEMA_ID, KTS_TACTICAL_PROPOSAL_SCHEMA_VERSION]).toEqual([
      "kts.tactical-proposal",
      "1",
    ]);
  });

  it.each(KTS_TACTICAL_INTENTS)("accepts the %s intent", (intent) => {
    expect(isKtsTacticalProposal(proposal({ intent }))).toBe(true);
  });

  it.each(KTS_FIRE_RECOMMENDATIONS)("accepts the %s fire recommendation", (fireRecommendation) => {
    expect(isKtsTacticalProposal(proposal({ fireRecommendation }))).toBe(true);
  });

  it.each(KTS_RECOVERY_RECOMMENDATIONS)(
    "accepts the %s recovery recommendation",
    (recoveryRecommendation) => {
      expect(isKtsTacticalProposal(proposal({ recoveryRecommendation }))).toBe(true);
    },
  );

  it.each(KTS_POWER_TRANSFER_RECOMMENDATIONS)(
    "accepts the %s power-transfer recommendation",
    (powerTransferRecommendation) => {
      expect(isKtsTacticalProposal(proposal({ powerTransferRecommendation }))).toBe(true);
    },
  );

  it.each(KTS_TARGET_KINDS)("accepts the %s target kind with its required shape", (kind) => {
    const target =
      kind === "enemy" || kind === "enemy_projectile"
        ? { kind, entityId: 7, priority: "high" as const }
        : { kind, priority: "low" as const };
    expect(isKtsTacticalProposal(proposal({ target }))).toBe(true);
  });

  it.each(UNCERTAINTY_CLASSIFICATIONS)("accepts the %s uncertainty class", (uncertainty) => {
    expect(isKtsTacticalProposal(proposal({ uncertainty }))).toBe(true);
  });

  it.each(ABSTENTION_CODES)("accepts the %s abstention code", (code) => {
    expect(
      isKtsTacticalProposal(
        proposal({
          intent: "hold",
          abstention: { abstained: true, code },
          selectedStrategy: null,
          target: { kind: "none", priority: "low" },
        }),
      ),
    ).toBe(true);
  });

  it.each([-1, 0, 1] as const)("accepts moveX %s", (moveX) => {
    expect(
      isKtsTacticalProposal(proposal({ movement: { moveX, moveY: 0, priority: "low" } })),
    ).toBe(true);
  });

  it.each([-1, 0, 1] as const)("accepts moveY %s", (moveY) => {
    expect(
      isKtsTacticalProposal(proposal({ movement: { moveX: 0, moveY, priority: "low" } })),
    ).toBe(true);
  });

  it.each(["low", "medium", "high"] as const)("accepts %s movement priority", (priority) => {
    expect(isKtsTacticalProposal(proposal({ movement: { moveX: 0, moveY: 0, priority } }))).toBe(
      true,
    );
  });

  it.each([0, 10_000])("accepts confidence boundary %s", (confidenceBasisPoints) => {
    expect(isKtsTacticalProposal(proposal({ confidenceBasisPoints }))).toBe(true);
  });

  it.each([-1, 10_001, 1.5])("rejects invalid confidence %s", (confidenceBasisPoints) => {
    expect(isKtsTacticalProposal(proposal({ confidenceBasisPoints }))).toBe(false);
  });

  it("requires an entity ID for an enemy target", () => {
    expect(
      isKtsTacticalProposal(
        proposal({ target: { kind: "enemy", priority: "high" } as KtsTacticalProposal["target"] }),
      ),
    ).toBe(false);
  });

  it("rejects an entity ID for a none target", () => {
    expect(
      isKtsTacticalProposal(
        proposal({
          target: { kind: "none", entityId: 1, priority: "low" } as KtsTacticalProposal["target"],
        }),
      ),
    ).toBe(false);
  });

  it("accepts the exact selected-strategy shape", () => {
    expect(
      isKtsTacticalProposal(
        proposal({ selectedStrategy: { strategyId: "strategy:test", strategyVersion: "1" } }),
      ),
    ).toBe(true);
  });

  it("rejects an extra selected-strategy field", () => {
    expect(
      isKtsTacticalProposal(
        proposal({
          selectedStrategy: {
            strategyId: "strategy:test",
            strategyVersion: "1",
            hiddenRank: 1,
          } as KtsTacticalProposal["selectedStrategy"],
        }),
      ),
    ).toBe(false);
  });

  it("accepts every typed supporting-fact form", () => {
    const supportingFacts: KtsTacticalProposal["supportingFacts"] = [
      { kind: "observation_field", path: "resources.signal.integrity", value: 10 },
      { kind: "entity", entityKind: "enemy", entityId: 1 },
      { kind: "action_readiness", path: "actionSpace.readiness.fireReady", ready: true },
      { kind: "strategy", strategyId: "strategy:test", strategyVersion: "1" },
      { kind: "evidence", evidenceId: "evidence:test" },
      { kind: "memory", memoryId: "memory:test" },
      { kind: "contradiction", evidenceId: "evidence:contradiction" },
    ];
    expect(isKtsTacticalProposal(proposal({ supportingFacts }))).toBe(true);
  });

  it("rejects duplicate evidence references", () => {
    expect(
      isKtsTacticalProposal(proposal({ evidenceReferences: ["evidence:a", "evidence:a"] })),
    ).toBe(false);
  });

  it("rejects an abstention without a code", () => {
    expect(
      isKtsTacticalProposal(
        proposal({ abstention: { abstained: true } as KtsTacticalProposal["abstention"] }),
      ),
    ).toBe(false);
  });

  it("rejects a non-abstention with an abstention code", () => {
    expect(
      isKtsTacticalProposal(
        proposal({
          abstention: {
            abstained: false,
            code: "model_uncertain",
          } as KtsTacticalProposal["abstention"],
        }),
      ),
    ).toBe(false);
  });

  it("rejects an empty public reason", () => {
    expect(isKtsTacticalProposal(proposal({ reason: "" }))).toBe(false);
  });

  it("accepts the Signal Officer reason-length boundary", () => {
    expect(isKtsTacticalProposal(proposal({ reason: "r".repeat(600) }))).toBe(true);
  });

  it("rejects a reason above the Signal Officer boundary", () => {
    expect(isKtsTacticalProposal(proposal({ reason: "r".repeat(601) }))).toBe(false);
  });

  it("rejects an unknown proposal field", () => {
    expect(isKtsTacticalProposal({ ...proposal(), controlAction: true })).toBe(false);
  });

  it("rejects a missing proposal field", () => {
    const missing = Object.fromEntries(
      Object.entries(proposal()).filter(([key]) => key !== "warnings"),
    );
    expect(isKtsTacticalProposal(missing)).toBe(false);
  });

  it("rejects an unsupported schema version", () => {
    expect(isKtsTacticalProposal({ ...proposal(), proposalSchemaVersion: "2" })).toBe(false);
  });

  it("creates a deeply immutable proposal", () => {
    const created = createKtsTacticalProposal(proposal());
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.movement)).toBe(true);
    expect(Object.isFrozen(created.supportingFacts)).toBe(true);
  });

  it("maps invalid construction to a safe typed proposal failure", () => {
    const rawSecret = "raw-proposal-secret";
    const invalid = proposal({
      selectedStrategy: {
        strategyId: "strategy:test",
        strategyVersion: "1",
        rawSecret,
      } as KtsTacticalProposal["selectedStrategy"],
    });
    try {
      createKtsTacticalProposal(invalid);
      throw new Error("Expected invalid proposal construction to fail.");
    } catch (error) {
      expect(error).toMatchObject({
        failure: { code: "invalid_proposal", stage: "proposal_validation" },
      });
      expect(JSON.stringify(error)).not.toContain(rawSecret);
    }
  });

  it("decodes a strict JSON proposal", () => {
    const decoded = KTS_TACTICAL_PROPOSAL_OUTPUT.decode(JSON.stringify(proposal()));
    expect(KTS_TACTICAL_PROPOSAL_OUTPUT.validate(decoded)).toBe(true);
  });

  it("rejects malformed decoded output", () => {
    expect(() => KTS_TACTICAL_PROPOSAL_OUTPUT.decode("{")).toThrow();
  });
});

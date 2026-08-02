import { describe, expect, it } from "vitest";

import {
  STRATEGY_CALIBRATION_STATES,
  STRATEGY_CLASSIFICATIONS,
  STRATEGY_FAMILIES,
  STRATEGY_SCHEMA_ID,
  STRATEGY_SCHEMA_VERSION,
  compareStrategyReferences,
  createStrategyApplicabilityResult,
  createStrategyRecord,
  strategyIdentityKey,
  validateStrategyRecord,
  type StrategyDraft,
} from "../app/features/intelligence-harness/tactical-adviser/strategy-contract";

function draft(overrides: Partial<StrategyDraft> = {}): StrategyDraft {
  return {
    strategyId: "strategy-a",
    strategyVersion: "1",
    domainId: "keep-the-signal",
    domainVersion: "engine-1:rules-1",
    family: "preservation",
    objective: "Preserve the bounded signal.",
    triggerConditions: [{ field: "signal", operator: "below", value: 5_000 }],
    applicabilityConstraints: [{ field: "status", operator: "equals", value: "running" }],
    actionPreferences: { intent: "preserve_signal" },
    terminationConditions: [{ condition: "new_observation" }],
    expectedEffects: ["less_signal_exposure"],
    knownFailureModes: ["bounded_observation_omits_threat"],
    evidenceReferences: ["evidence:b", "evidence:a"],
    counterexampleReferences: ["evidence:counterexample"],
    confidenceBasisPoints: 5_000,
    calibrationState: "uncalibrated",
    evaluationSummaries: [{ cases: 10, result: "unknown" }],
    parentStrategies: [{ strategyId: "parent", strategyVersion: "1" }],
    portfolioPriority: 10,
    classification: "experimental_candidate",
    recordedAt: "2026-08-01T00:00:00.000Z",
    actorId: "operator:test",
    ...overrides,
  };
}

describe("KTS-I4-E strategy contract", () => {
  it("exports the exact strategy schema identity", () => {
    expect([STRATEGY_SCHEMA_ID, STRATEGY_SCHEMA_VERSION]).toEqual(["construct.strategy", 1]);
  });

  it.each(STRATEGY_FAMILIES)("creates the %s strategy family", async (family) => {
    const record = await createStrategyRecord(draft({ family }));
    expect(record.family).toBe(family);
  });

  it.each(STRATEGY_CLASSIFICATIONS)(
    "creates the %s strategy classification",
    async (classification) => {
      const record = await createStrategyRecord(draft({ classification }));
      expect(record.classification).toBe(classification);
    },
  );

  it.each(STRATEGY_CALIBRATION_STATES)(
    "creates the %s calibration state",
    async (calibrationState) => {
      const record = await createStrategyRecord(draft({ calibrationState }));
      expect(record.calibrationState).toBe(calibrationState);
    },
  );

  it("creates a lowercase SHA-256 content digest", async () => {
    const record = await createStrategyRecord(draft());
    expect(record.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("validates an unchanged strategy digest", async () => {
    const record = await createStrategyRecord(draft());
    await expect(validateStrategyRecord(record)).resolves.toBeUndefined();
  });

  it("rejects a changed strategy with a stale digest", async () => {
    const record = await createStrategyRecord(draft());
    const changed = { ...record, objective: "Changed objective." };
    await expect(validateStrategyRecord(changed)).rejects.toThrow("digest");
  });

  it("canonicalizes evidence-reference order", async () => {
    const record = await createStrategyRecord(draft());
    expect(record.evidenceReferences).toEqual(["evidence:a", "evidence:b"]);
  });

  it("canonicalizes counterexample references independently", async () => {
    const record = await createStrategyRecord(
      draft({ counterexampleReferences: ["evidence:counter-z", "evidence:counter-a"] }),
    );
    expect(record.counterexampleReferences).toEqual(["evidence:counter-a", "evidence:counter-z"]);
  });

  it("deeply freezes strategy content", async () => {
    const record = await createStrategyRecord(draft());
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.triggerConditions)).toBe(true);
    expect(Object.isFrozen(record.actionPreferences)).toBe(true);
  });

  it("preserves parent strategy lineage", async () => {
    const record = await createStrategyRecord(draft());
    expect(record.parentStrategies).toEqual([{ strategyId: "parent", strategyVersion: "1" }]);
  });

  it("rejects an invalid strategy identity", async () => {
    await expect(createStrategyRecord(draft({ strategyId: "bad id" }))).rejects.toThrow("identity");
  });

  it("rejects confidence above 10,000 basis points", async () => {
    await expect(createStrategyRecord(draft({ confidenceBasisPoints: 10_001 }))).rejects.toThrow(
      "scalar",
    );
  });

  it("rejects duplicate evidence references", async () => {
    await expect(
      createStrategyRecord(draft({ evidenceReferences: ["evidence:a", "evidence:a"] })),
    ).rejects.toThrow("collection");
  });

  it("rejects duplicate parent references", async () => {
    const parent = { strategyId: "parent", strategyVersion: "1" };
    await expect(
      createStrategyRecord(draft({ parentStrategies: [parent, parent] })),
    ).rejects.toThrow("Parent");
  });

  it("rejects non-canonical supplied time", async () => {
    await expect(createStrategyRecord(draft({ recordedAt: "2026-08-01" }))).rejects.toThrow(
      "scalar",
    );
  });

  it("creates an immutable applicability result", () => {
    const result = createStrategyApplicabilityResult({
      strategyId: "strategy-a",
      strategyVersion: "1",
      applicable: true,
      applicabilityBasisPoints: 9_000,
      satisfiedConstraints: ["signal_low"],
      unsatisfiedConstraints: [],
      uncertaintyFlags: [],
      supportingObservationReferences: ["resources.signal.integrityBasisPoints"],
      supportingEvidenceReferences: ["evidence:a"],
      evaluatorId: "evaluator",
      evaluatorVersion: "1",
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects applicability outside basis-point bounds", () => {
    expect(() =>
      createStrategyApplicabilityResult({
        strategyId: "strategy-a",
        strategyVersion: "1",
        applicable: true,
        applicabilityBasisPoints: -1,
        satisfiedConstraints: [],
        unsatisfiedConstraints: [],
        uncertaintyFlags: [],
        supportingObservationReferences: [],
        supportingEvidenceReferences: [],
        evaluatorId: "evaluator",
        evaluatorVersion: "1",
      }),
    ).toThrow("applicability");
  });

  it.each(["bad evidence id", "   ", "e".repeat(161)])(
    "rejects malformed applicability evidence identity %j",
    (evidenceId) => {
      expect(() =>
        createStrategyApplicabilityResult({
          strategyId: "strategy-a",
          strategyVersion: "1",
          applicable: true,
          applicabilityBasisPoints: 9_000,
          satisfiedConstraints: [],
          unsatisfiedConstraints: [],
          uncertaintyFlags: [],
          supportingObservationReferences: ["resources.signal.integrityBasisPoints"],
          supportingEvidenceReferences: [evidenceId],
          evaluatorId: "evaluator",
          evaluatorVersion: "1",
        }),
      ).toThrow("public identities");
    },
  );

  it("builds an unambiguous strategy identity key", () => {
    expect(strategyIdentityKey({ strategyId: "a", strategyVersion: "b:c" })).not.toBe(
      strategyIdentityKey({ strategyId: "a:b", strategyVersion: "c" }),
    );
  });

  it("orders strategy identity before version", () => {
    expect(
      compareStrategyReferences(
        { strategyId: "a", strategyVersion: "9" },
        { strategyId: "b", strategyVersion: "1" },
      ),
    ).toBeLessThan(0);
  });
});

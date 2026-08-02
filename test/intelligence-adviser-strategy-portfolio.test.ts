import { describe, expect, it } from "vitest";

import {
  createStrategyRecord,
  type StrategyDraft,
  type StrategyRecord,
} from "../app/features/intelligence-harness/tactical-adviser/strategy-contract";
import {
  StrategyPortfolio,
  type StrategySelectionBudget,
} from "../app/features/intelligence-harness/tactical-adviser/strategy-portfolio";

const selectionBudget: StrategySelectionBudget = {
  maximumStrategies: 10,
  maximumSerializedCharacters: 100_000,
};

function draft(id = "strategy-a", overrides: Partial<StrategyDraft> = {}): StrategyDraft {
  return {
    strategyId: id,
    strategyVersion: "1",
    domainId: "keep-the-signal",
    domainVersion: "engine-1:rules-1",
    family: "preservation",
    objective: `Objective ${id}`,
    triggerConditions: [],
    applicabilityConstraints: [],
    actionPreferences: { intent: "hold" },
    terminationConditions: [],
    expectedEffects: ["bounded_effect"],
    knownFailureModes: ["bounded_failure"],
    evidenceReferences: [],
    counterexampleReferences: [],
    confidenceBasisPoints: 5_000,
    calibrationState: "uncalibrated",
    evaluationSummaries: [],
    parentStrategies: [],
    portfolioPriority: 10,
    classification: "experimental_candidate",
    recordedAt: "2026-08-01T00:00:00.000Z",
    actorId: "operator:test",
    ...overrides,
  };
}

function portfolio(maximumStrategyCount = 100, maximumSerializedCharacters = 10_000_000) {
  return new StrategyPortfolio({ maximumStrategyCount, maximumSerializedCharacters });
}

function evaluator(scores: Readonly<Record<string, number>>): (
  strategy: Readonly<StrategyRecord>,
) => {
  strategyId: string;
  strategyVersion: string;
  applicable: boolean;
  applicabilityBasisPoints: number;
  satisfiedConstraints: readonly string[];
  unsatisfiedConstraints: readonly string[];
  uncertaintyFlags: readonly string[];
  supportingObservationReferences: readonly string[];
  supportingEvidenceReferences: readonly string[];
  evaluatorId: string;
  evaluatorVersion: string;
} {
  return (strategy) => ({
    strategyId: strategy.strategyId,
    strategyVersion: strategy.strategyVersion,
    applicable: (scores[strategy.strategyId] ?? 0) > 0,
    applicabilityBasisPoints: scores[strategy.strategyId] ?? 0,
    satisfiedConstraints: [],
    unsatisfiedConstraints: [],
    uncertaintyFlags: [],
    supportingObservationReferences: [],
    supportingEvidenceReferences: [],
    evaluatorId: "test-evaluator",
    evaluatorVersion: "1",
  });
}

describe("KTS-I4-E bounded strategy portfolio", () => {
  it("registers and retrieves an exact strategy identity", async () => {
    const store = portfolio();
    const record = await createStrategyRecord(draft());
    await store.registerStrategy(record);
    expect(store.getStrategy(record)).toEqual(record);
  });

  it("returns null for an unknown exact identity", () => {
    expect(portfolio().getStrategy({ strategyId: "missing", strategyVersion: "1" })).toBeNull();
  });

  it("does not alias another strategy version", async () => {
    const store = portfolio();
    await store.registerStrategy(
      await createStrategyRecord(draft("same", { strategyVersion: "1" })),
    );
    expect(store.getStrategy({ strategyId: "same", strategyVersion: "2" })).toBeNull();
  });

  it("idempotently returns byte-equivalent content", async () => {
    const store = portfolio();
    const record = await createStrategyRecord(draft());
    await store.registerStrategy(record);
    await expect(store.registerStrategy(record)).resolves.toEqual(record);
    expect(store.size).toBe(1);
  });

  it("rejects a conflicting valid record with the same identity", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft()));
    const conflict = await createStrategyRecord(draft("strategy-a", { objective: "Different." }));
    await expect(store.registerStrategy(conflict)).rejects.toThrow("different content");
  });

  it("rejects a stale digest before registration", async () => {
    const store = portfolio();
    const record = await createStrategyRecord(draft());
    await expect(store.registerStrategy({ ...record, objective: "tampered" })).rejects.toThrow(
      "digest",
    );
  });

  it("enforces the portfolio count limit", async () => {
    const store = portfolio(1);
    await store.registerStrategy(await createStrategyRecord(draft("one")));
    await expect(store.registerStrategy(await createStrategyRecord(draft("two")))).rejects.toThrow(
      "count",
    );
  });

  it("enforces the portfolio character limit", async () => {
    const record = await createStrategyRecord(draft());
    const store = portfolio(2, JSON.stringify(record).length - 1);
    await expect(store.registerStrategy(record)).rejects.toThrow("character");
  });

  it("rejects invalid constructor limits", () => {
    expect(() => portfolio(0)).toThrow("limits");
  });

  it("returns immutable independent lookup clones", async () => {
    const store = portfolio();
    const record = await createStrategyRecord(draft());
    await store.registerStrategy(record);
    const first = store.getStrategy(record)!;
    const second = store.getStrategy(record)!;
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("isolates registered content from later caller mutation", async () => {
    const store = portfolio();
    const immutable = await createStrategyRecord(draft());
    const mutable = JSON.parse(JSON.stringify(immutable)) as StrategyRecord;
    await store.registerStrategy(mutable);
    (mutable as { objective: string }).objective = "caller mutation";
    expect(store.getStrategy(immutable)?.objective).toBe(immutable.objective);
  });

  it("lists strategies by identity then version", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("b")));
    await store.registerStrategy(await createStrategyRecord(draft("a", { strategyVersion: "2" })));
    await store.registerStrategy(await createStrategyRecord(draft("a", { strategyVersion: "1" })));
    expect(
      store
        .listStrategiesWithinBudget(selectionBudget)
        .candidates.map(({ strategy }) => `${strategy.strategyId}:${strategy.strategyVersion}`),
    ).toEqual(["a:1", "a:2", "b:1"]);
  });

  it("uses identical locale-independent lexical ordering for listing and applicability ties", async () => {
    const identities = ["A", "a", "a_1", "a-1", "a.1", "a1", "1", "10", "2"];
    const expected = ["1", "10", "2", "A", "a", "a-1", "a.1", "a1", "a_1"];
    const store = portfolio();
    for (const identity of identities) {
      await store.registerStrategy(await createStrategyRecord(draft(identity)));
    }
    const listed = store
      .listStrategiesWithinBudget(selectionBudget)
      .candidates.map(({ strategy }) => strategy.strategyId);
    const selected = store
      .selectApplicableStrategies(
        (strategy) => ({
          strategyId: strategy.strategyId,
          strategyVersion: strategy.strategyVersion,
          applicable: true,
          applicabilityBasisPoints: 5_000,
          satisfiedConstraints: [],
          unsatisfiedConstraints: [],
          uncertaintyFlags: [],
          supportingObservationReferences: [],
          supportingEvidenceReferences: [],
          evaluatorId: "lexical-order",
          evaluatorVersion: "1",
        }),
        selectionBudget,
      )
      .candidates.map(({ strategy }) => strategy.strategyId);
    expect(listed).toEqual(expected);
    expect(selected).toEqual(expected);
  });

  it("reports list truncation by count", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("a")));
    await store.registerStrategy(await createStrategyRecord(draft("b")));
    const report = store.listStrategiesWithinBudget({ ...selectionBudget, maximumStrategies: 1 });
    expect(report).toMatchObject({ truncated: true, omittedCount: 1 });
  });

  it("reports list truncation by characters", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("a")));
    const report = store.listStrategiesWithinBudget({
      maximumStrategies: 10,
      maximumSerializedCharacters: 0,
    });
    expect(report.candidates).toHaveLength(0);
    expect(report.truncated).toBe(true);
  });

  it("filters non-applicable strategies", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("yes")));
    await store.registerStrategy(await createStrategyRecord(draft("no")));
    const report = store.selectApplicableStrategies(evaluator({ yes: 5_000 }), selectionBudget);
    expect(report.candidates.map(({ strategy }) => strategy.strategyId)).toEqual(["yes"]);
  });

  it("orders higher applicability first", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("low")));
    await store.registerStrategy(await createStrategyRecord(draft("high")));
    const report = store.selectApplicableStrategies(
      evaluator({ low: 2_000, high: 9_000 }),
      selectionBudget,
    );
    expect(report.candidates[0]?.strategy.strategyId).toBe("high");
  });

  it("uses higher portfolio priority after applicability", async () => {
    const store = portfolio();
    await store.registerStrategy(
      await createStrategyRecord(draft("low", { portfolioPriority: 1 })),
    );
    await store.registerStrategy(
      await createStrategyRecord(draft("high", { portfolioPriority: 9 })),
    );
    const report = store.selectApplicableStrategies(
      evaluator({ low: 5_000, high: 5_000 }),
      selectionBudget,
    );
    expect(report.candidates[0]?.strategy.strategyId).toBe("high");
  });

  it("uses lower strategy ID after equal score and priority", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("b")));
    await store.registerStrategy(await createStrategyRecord(draft("a")));
    const report = store.selectApplicableStrategies(
      evaluator({ a: 5_000, b: 5_000 }),
      selectionBudget,
    );
    expect(report.candidates[0]?.strategy.strategyId).toBe("a");
  });

  it("uses lower version as final candidate tie breaker", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("a", { strategyVersion: "2" })));
    await store.registerStrategy(await createStrategyRecord(draft("a", { strategyVersion: "1" })));
    const report = store.selectApplicableStrategies(evaluator({ a: 5_000 }), selectionBudget);
    expect(report.candidates.map(({ strategy }) => strategy.strategyVersion)).toEqual(["1", "2"]);
  });

  it("rejects an evaluator identity mismatch", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("a")));
    expect(() =>
      store.selectApplicableStrategies(
        () => ({
          strategyId: "other",
          strategyVersion: "1",
          applicable: true,
          applicabilityBasisPoints: 1,
          satisfiedConstraints: [],
          unsatisfiedConstraints: [],
          uncertaintyFlags: [],
          supportingObservationReferences: [],
          supportingEvidenceReferences: [],
          evaluatorId: "test-evaluator",
          evaluatorVersion: "1",
        }),
        selectionBudget,
      ),
    ).toThrow("identity");
  });

  it("returns an immutable snapshot with exact totals", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("a")));
    const snapshot = store.snapshot();
    expect(snapshot.strategyCount).toBe(1);
    expect(snapshot.serializedCharacters).toBeGreaterThan(0);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("preserves an existing snapshot after disposal", async () => {
    const store = portfolio();
    await store.registerStrategy(await createStrategyRecord(draft("a")));
    const snapshot = store.snapshot();
    store.dispose();
    expect(snapshot.strategies[0]?.strategyId).toBe("a");
  });

  it("rejects registration after disposal", async () => {
    const store = portfolio();
    store.dispose();
    await expect(store.registerStrategy(await createStrategyRecord(draft()))).rejects.toThrow(
      "disposed",
    );
  });

  it("rejects lookup after disposal", () => {
    const store = portfolio();
    store.dispose();
    expect(() => store.getStrategy({ strategyId: "a", strategyVersion: "1" })).toThrow("disposed");
  });

  it("disposes idempotently", () => {
    const store = portfolio();
    store.dispose();
    expect(() => store.dispose()).not.toThrow();
  });

  it("bounds deterministic selection from 10,000 registered strategy versions", async () => {
    const store = portfolio(10_000, 100_000_000);
    const records = await Promise.all(
      Array.from({ length: 10_000 }, (_, index) =>
        createStrategyRecord(draft(`scale-${index.toString().padStart(5, "0")}`)),
      ),
    );
    await Promise.all(records.map((record) => store.registerStrategy(record)));
    const report = store.selectApplicableStrategies(
      (strategy) => ({
        strategyId: strategy.strategyId,
        strategyVersion: strategy.strategyVersion,
        applicable: true,
        applicabilityBasisPoints: 5_000,
        satisfiedConstraints: [],
        unsatisfiedConstraints: [],
        uncertaintyFlags: [],
        supportingObservationReferences: [],
        supportingEvidenceReferences: [],
        evaluatorId: "scale",
        evaluatorVersion: "1",
      }),
      { maximumStrategies: 10, maximumSerializedCharacters: 1_000_000 },
    );
    expect(report.evaluatedCount).toBe(10_000);
    expect(report.applicableCount).toBe(10_000);
    expect(report.applicableCount).toBeGreaterThanOrEqual(1_000);
    expect(report.truncated).toBe(true);
    expect(report.candidates).toHaveLength(10);
  });
});

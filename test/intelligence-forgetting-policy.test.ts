import { describe, expect, it } from "vitest";
import type { EpisodicMemoryRecord } from "../app/features/intelligence-harness/memory-fabric/memory-contract";
import {
  evaluateRetention,
  PROTECTED_REASON_CODES,
  RETENTION_DECISIONS,
  type RetentionContext,
  type RetentionPolicy,
} from "../app/features/intelligence-harness/consolidation/retention-policy";

const digest = "a".repeat(64);

describe("KTS-I4-F retention policy", () => {
  for (const decision of RETENTION_DECISIONS) {
    it(`exports decision ${decision}`, () => {
      expect(RETENTION_DECISIONS).toContain(decision);
    });
  }

  for (const reason of PROTECTED_REASON_CODES) {
    it(`exports protected reason ${reason}`, () => {
      expect(PROTECTED_REASON_CODES).toContain(reason);
    });
  }

  const protectedCases: readonly [string, Partial<RetentionContext>, string][] = [
    ["governance violation", { governanceViolation: true }, "governance_violation"],
    ["safety failure", { safetyFailure: true }, "safety_failure"],
    ["unique failure", { uniqueFailure: true }, "unique_failure"],
    ["unique counterexample", { uniqueCounterexample: true }, "unique_counterexample"],
    ["human correction relation", { correctionPresent: true }, "human_correction"],
    ["human correction source", { evidenceSourceTypes: ["human_correction"] }, "human_correction"],
    ["contradiction relation", { contradictionPresent: true }, "contradiction"],
    ["contradiction role", { evidenceRoles: ["contradiction"] }, "contradiction"],
    ["benchmark significance", { memory: memory({ significance: "benchmark" }) }, "benchmark"],
    ["benchmark retention", { memory: memory({ retentionClass: "benchmark" }) }, "benchmark"],
    [
      "training lineage",
      { memory: memory({ retentionClass: "training_lineage" }) },
      "training_lineage",
    ],
    ["promotion evidence", { promotionEvidence: true }, "promotion_evidence"],
    ["rejection evidence", { rejectionEvidence: true }, "rejection_evidence"],
    ["model transition", { modelVersionTransition: true }, "model_version_transition"],
    [
      "reproducibility requirement",
      { requiredForReproducibility: true },
      "reproducibility_required",
    ],
    ["sole support", { soleSupport: true }, "sole_support"],
    [
      "protected retention",
      { memory: memory({ retentionClass: "protected" }) },
      "protected_retention",
    ],
    ["unknown legal status", { legalStatus: "unknown" }, "unknown_legal_status"],
    ["unknown consent status", { consentStatus: "unknown" }, "unknown_consent_status"],
    ["unknown audit status", { auditStatus: "unknown" }, "unknown_audit_status"],
    ["incomplete audit", { auditStatus: "incomplete" }, "unknown_audit_status"],
  ];

  for (const [name, overrides, reason] of protectedCases) {
    it(`protects ${name}`, () => {
      const report = evaluateRetention(policy(), context(overrides));
      expect(report.decision).toBe("protected");
      expect(report.protectedReasons).toContain(reason);
    });
  }

  it("lists every applicable protected reason", () => {
    const report = evaluateRetention(
      policy(),
      context({
        governanceViolation: true,
        safetyFailure: true,
        uniqueFailure: true,
        contradictionPresent: true,
        correctionPresent: true,
        promotionEvidence: true,
        rejectionEvidence: true,
        modelVersionTransition: true,
        requiredForReproducibility: true,
        soleSupport: true,
        legalStatus: "unknown",
        consentStatus: "unknown",
        auditStatus: "unknown",
        memory: memory({ retentionClass: "protected", significance: "benchmark" }),
      }),
    );
    expect(report.protectedReasons.length).toBeGreaterThan(10);
  });

  it("does not let aggregate support override protection", () => {
    const report = evaluateRetention(
      policy(),
      context({
        uniqueCounterexample: true,
        supportCardinality: 10_000,
        higherLevelTargetAvailable: true,
      }),
    );
    expect(report.decision).toBe("protected");
  });

  it("marks rejected consolidation", () => {
    const report = evaluateRetention(
      policy(),
      context({
        validationClassification: "candidate_rejected",
      }),
    );
    expect(report.decision).toBe("consolidation_rejected");
  });

  it("marks routine redundant memory as forgetting candidate", () => {
    const report = evaluateRetention(
      policy(),
      context({
        supportCardinality: 3,
        higherLevelTargetAvailable: true,
      }),
    );
    expect(report.decision).toBe("forgetting_candidate");
  });

  it("requires minimum support for forgetting candidacy", () => {
    const report = evaluateRetention(
      policy(),
      context({
        supportCardinality: 1,
        higherLevelTargetAvailable: true,
        soleSupport: false,
      }),
    );
    expect(report.decision).not.toBe("forgetting_candidate");
  });

  it("requires a higher-level target for forgetting candidacy", () => {
    const report = evaluateRetention(
      policy(),
      context({
        supportCardinality: 3,
        higherLevelTargetAvailable: false,
      }),
    );
    expect(report.decision).toBe("archive_candidate");
  });

  it("can retain routine records when archive candidates are disabled", () => {
    const report = evaluateRetention(
      policy({
        archiveRoutineWithoutTarget: false,
      }),
      context({
        supportCardinality: 3,
        higherLevelTargetAvailable: false,
      }),
    );
    expect(report.decision).toBe("retain");
  });

  it("can disable forgetting candidates", () => {
    const report = evaluateRetention(
      policy({
        permitForgettingCandidate: false,
      }),
      context({
        supportCardinality: 3,
        higherLevelTargetAvailable: true,
      }),
    );
    expect(report.decision).toBe("archive_candidate");
  });

  for (const significance of ["notable", "surprising"] as const) {
    it(`retains nonroutine significance ${significance}`, () => {
      const report = evaluateRetention(
        policy(),
        context({
          memory: memory({ significance }),
          supportCardinality: 100,
          higherLevelTargetAvailable: true,
        }),
      );
      expect(report.decision).toBe("retain");
    });
  }

  it("freezes retention reports", () => {
    const report = evaluateRetention(
      policy(),
      context({
        supportCardinality: 3,
        higherLevelTargetAvailable: true,
      }),
    );
    expect(Object.isFrozen(report)).toBe(true);
  });

  it("sorts protected reason codes", () => {
    const report = evaluateRetention(
      policy(),
      context({
        safetyFailure: true,
        governanceViolation: true,
      }),
    );
    expect(report.protectedReasons).toEqual([...report.protectedReasons].sort());
  });

  it("supports 10,000 deterministic decisions", () => {
    const reports = Array.from({ length: 10_000 }, (_, index) =>
      evaluateRetention(
        policy(),
        context({
          memory: memory({ memoryId: `episode:${String(index).padStart(5, "0")}` }),
          supportCardinality: 3,
          higherLevelTargetAvailable: true,
        }),
      ),
    );
    expect(reports).toHaveLength(10_000);
    expect(reports.every((report) => report.decision === "forgetting_candidate")).toBe(true);
  });

  it("produces equivalent reports for equivalent inputs", () => {
    const first = evaluateRetention(
      policy(),
      context({
        supportCardinality: 3,
        higherLevelTargetAvailable: true,
      }),
    );
    const second = evaluateRetention(
      policy(),
      context({
        supportCardinality: 3,
        higherLevelTargetAvailable: true,
      }),
    );
    expect(first).toEqual(second);
  });

  it("rejects a support threshold below two", () => {
    expect(() =>
      evaluateRetention(policy({ minimumSupportCardinality: 1 }), context()),
    ).toThrowError();
  });
});

function policy(overrides: Partial<RetentionPolicy> = {}): RetentionPolicy {
  return {
    policyId: "policy:retention",
    policyVersion: "1",
    minimumSupportCardinality: 2,
    archiveRoutineWithoutTarget: true,
    permitForgettingCandidate: true,
    ...overrides,
  };
}

function context(overrides: Partial<RetentionContext> = {}): RetentionContext {
  return {
    memory: memory(),
    evidenceRoles: [],
    evidenceSourceTypes: [],
    validationClassification: "candidate_validated",
    supportCardinality: 2,
    uniqueFailure: false,
    uniqueCounterexample: false,
    contradictionPresent: false,
    correctionPresent: false,
    governanceViolation: false,
    safetyFailure: false,
    promotionEvidence: false,
    rejectionEvidence: false,
    modelVersionTransition: false,
    requiredForReproducibility: false,
    soleSupport: false,
    higherLevelTargetAvailable: false,
    legalStatus: "known_permitted",
    consentStatus: "known_permitted",
    auditStatus: "complete",
    ...overrides,
  };
}

function memory(overrides: Partial<EpisodicMemoryRecord> = {}): Readonly<EpisodicMemoryRecord> {
  return Object.freeze({
    memoryId: "episode:a",
    memoryKind: "episodic",
    memorySchemaId: "construct.memory",
    memorySchemaVersion: 1,
    domainId: "keep-the-signal",
    domainVersion: "1",
    significance: "routine",
    summary: {},
    acceptanceState: "accepted",
    classification: "internal",
    retentionClass: "standard",
    tags: [],
    recordedAt: "2026-08-02T08:00:00.000Z",
    contentDigest: digest,
    ...overrides,
  });
}

import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_STATES,
  DATA_CLASSIFICATIONS,
  EVIDENCE_RELATION_TYPES,
  EVIDENCE_SCHEMA_ID,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_SOURCE_TYPES,
  RETENTION_CLASSES,
  canonicalEvidenceRecord,
  createEvidenceRecord,
  createEvidenceRelation,
  isCanonicalUtcTimestamp,
  isPublicIdentity,
  validateEvidenceRecord,
} from "../app/features/intelligence-harness/memory-fabric/evidence-contract";

function draft(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: "evidence:1",
    domainId: "keep-the-signal",
    domainVersion: "kts-i2.0.0:kts-foundation-0.1",
    sourceType: "observation" as const,
    sourceSchemaId: "kts.observation",
    sourceSchemaVersion: 1,
    sourceIdentity: "obs:1",
    authoritativePosition: { tick: 4, seed: 7 },
    payload: { level: 0 },
    acceptanceState: "accepted" as const,
    classification: "internal" as const,
    retentionClass: "standard" as const,
    tags: ["kts", "observation"],
    recordedAt: "2026-08-01T12:00:00.000Z",
    operationId: "op:1",
    ...overrides,
  };
}

describe("KTS-I4-D evidence contract", () => {
  it("exports evidence schema identity", () => {
    expect(EVIDENCE_SCHEMA_ID).toBe("construct.evidence");
    expect(EVIDENCE_SCHEMA_VERSION).toBe(1);
  });
  for (const sourceType of EVIDENCE_SOURCE_TYPES)
    it(`accepts source type ${sourceType}`, async () =>
      expect((await createEvidenceRecord(draft({ sourceType }) as never)).sourceType).toBe(
        sourceType,
      ));
  for (const acceptanceState of ACCEPTANCE_STATES)
    it(`accepts state ${acceptanceState}`, async () =>
      expect(
        (await createEvidenceRecord(draft({ acceptanceState }) as never)).acceptanceState,
      ).toBe(acceptanceState));
  for (const classification of DATA_CLASSIFICATIONS)
    it(`accepts classification ${classification}`, async () =>
      expect((await createEvidenceRecord(draft({ classification }) as never)).classification).toBe(
        classification,
      ));
  for (const retentionClass of RETENTION_CLASSES)
    it(`accepts retention ${retentionClass}`, async () =>
      expect((await createEvidenceRecord(draft({ retentionClass }) as never)).retentionClass).toBe(
        retentionClass,
      ));
  for (const relationType of EVIDENCE_RELATION_TYPES)
    it(`accepts relation ${relationType}`, () =>
      expect(
        createEvidenceRelation({
          relationId: `rel:${relationType}`,
          relationType,
          sourceEvidenceId: "evidence:1",
          targetEvidenceId: "evidence:2",
          recordedAt: "2026-08-01T12:00:00.000Z",
        }).relationType,
      ).toBe(relationType));
  it("accepts the maximum identity length", () =>
    expect(isPublicIdentity(`a${"b".repeat(159)}`)).toBe(true));
  it("rejects an overlong identity", () =>
    expect(isPublicIdentity(`a${"b".repeat(160)}`)).toBe(false));
  it("rejects whitespace identity", () => expect(isPublicIdentity("bad id")).toBe(false));
  it("accepts canonical UTC milliseconds", () =>
    expect(isCanonicalUtcTimestamp("2026-08-01T12:00:00.000Z")).toBe(true));
  it("rejects timestamps without milliseconds", () =>
    expect(isCanonicalUtcTimestamp("2026-08-01T12:00:00Z")).toBe(false));
  it("creates a lowercase digest", async () =>
    expect((await createEvidenceRecord(draft())).contentDigest).toMatch(/^[a-f0-9]{64}$/));
  it("sorts tags in the digest envelope", async () =>
    expect((await createEvidenceRecord(draft({ tags: ["z", "a"] }) as never)).tags).toEqual([
      "a",
      "z",
    ]));
  it("produces stable content", async () =>
    expect(canonicalEvidenceRecord(await createEvidenceRecord(draft()))).toBe(
      canonicalEvidenceRecord(await createEvidenceRecord(draft())),
    ));
  it("changes digest when classification changes", async () =>
    expect((await createEvidenceRecord(draft())).contentDigest).not.toBe(
      (await createEvidenceRecord(draft({ classification: "restricted" }) as never)).contentDigest,
    ));
  it("changes digest when retention changes", async () =>
    expect((await createEvidenceRecord(draft())).contentDigest).not.toBe(
      (await createEvidenceRecord(draft({ retentionClass: "protected" }) as never)).contentDigest,
    ));
  it("changes digest when provenance changes", async () =>
    expect((await createEvidenceRecord(draft())).contentDigest).not.toBe(
      (await createEvidenceRecord(draft({ sourceIdentity: "obs:2" }) as never)).contentDigest,
    ));
  it("validates its own record", async () =>
    await expect(
      validateEvidenceRecord(await createEvidenceRecord(draft())),
    ).resolves.toBeUndefined());
  it("rejects a changed payload digest", async () => {
    const record = await createEvidenceRecord(draft());
    await expect(validateEvidenceRecord({ ...record, payload: { level: 1 } })).rejects.toThrow();
  });
  it("returns immutable evidence", async () =>
    expect(Object.isFrozen(await createEvidenceRecord(draft()))).toBe(true));
  it("does not mutate the draft", async () => {
    const source = draft();
    const before = JSON.stringify(source);
    await createEvidenceRecord(source);
    expect(JSON.stringify(source)).toBe(before);
  });
  it("rejects self relations", () =>
    expect(() =>
      createEvidenceRelation({
        relationId: "rel:self",
        relationType: "supports",
        sourceEvidenceId: "evidence:1",
        targetEvidenceId: "evidence:1",
        recordedAt: "2026-08-01T12:00:00.000Z",
      }),
    ).toThrow());
  it("freezes relation metadata", () =>
    expect(
      Object.isFrozen(
        createEvidenceRelation({
          relationId: "rel:1",
          relationType: "supports",
          sourceEvidenceId: "evidence:1",
          targetEvidenceId: "evidence:2",
          metadata: { weight: 1 },
          recordedAt: "2026-08-01T12:00:00.000Z",
        }).metadata,
      ),
    ).toBe(true));
});

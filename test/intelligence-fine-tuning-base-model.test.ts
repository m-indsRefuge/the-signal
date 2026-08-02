import { describe, expect, it } from "vitest";

import {
  MODEL_LICENCE_STATUSES,
  createBaseModelRecord,
  validateBaseModelRecord,
  FineTuningFailure,
} from "../app/features/intelligence-harness/fine-tuning";
const a = "a".repeat(64),
  b = "b".repeat(64);
function model() {
  return {
    modelId: "org/model",
    revision: "abcdef123456",
    architectureFamily: "decoder-transformer",
    parameterCount: 500000000,
    contextLimit: 4096,
    weightFormat: "safetensors",
    quantizationStatus: "none",
    sourceLocation: "hf:org/model",
    files: [{ path: "model.safetensors", digest: a, bytes: 100 }],
    tokenizer: { tokenizerId: "org/model-tokenizer", revision: "abcdef123456", digest: b },
    licenceId: "apache-2.0",
    licenceStatus: "approved" as const,
    licenceTextReference: "licence/apache-2.0",
    redistributionConstraints: ["retain_notice"],
    intendedUseConstraints: ["advisory_only"],
    knownLimitations: ["experimental"],
    remoteCodeRequired: false,
  };
}
describe("KTS-I4-H base model", () => {
  for (const status of MODEL_LICENCE_STATUSES)
    it(`exports licence status ${status}`, () => expect(MODEL_LICENCE_STATUSES).toContain(status));
  for (const revision of ["main", "latest", "model:latest"])
    it(`rejects floating revision ${revision}`, async () =>
      await expect(createBaseModelRecord({ ...model(), revision })).rejects.toMatchObject({
        code: "base_model_revision_unpinned",
      }));
  for (const parameterCount of [1, 1000, 1000000, 500000000])
    it(`accepts parameter count ${parameterCount}`, async () =>
      expect((await createBaseModelRecord({ ...model(), parameterCount })).parameterCount).toBe(
        parameterCount,
      ));
  for (const contextLimit of [128, 512, 2048, 4096, 8192])
    it(`accepts context limit ${contextLimit}`, async () =>
      expect((await createBaseModelRecord({ ...model(), contextLimit })).contextLimit).toBe(
        contextLimit,
      ));
  it("creates immutable model records", async () =>
    expect(Object.isFrozen(await createBaseModelRecord(model()))).toBe(true));
  it("sorts model files", async () =>
    expect(
      (
        await createBaseModelRecord({
          ...model(),
          files: [
            { path: "z", digest: a, bytes: 1 },
            { path: "a", digest: b, bytes: 1 },
          ],
        })
      ).files[0]?.path,
    ).toBe("a"));
  it("validates model record digests", async () =>
    await expect(
      validateBaseModelRecord(await createBaseModelRecord(model())),
    ).resolves.toBeUndefined());
  it("rejects unapproved licence", async () =>
    await expect(
      createBaseModelRecord({ ...model(), licenceStatus: "unknown" as const }),
    ).rejects.toBeInstanceOf(FineTuningFailure));
  it("rejects remote code", async () =>
    await expect(
      createBaseModelRecord({ ...model(), remoteCodeRequired: true }),
    ).rejects.toBeInstanceOf(FineTuningFailure));
  it("rejects malformed file digest", async () =>
    await expect(
      createBaseModelRecord({ ...model(), files: [{ path: "x", digest: "bad", bytes: 1 }] }),
    ).rejects.toMatchObject({ code: "base_model_digest_mismatch" }));
  for (let i = 0; i < 20; i++)
    it(`creates deterministic model record ${i}`, async () =>
      expect((await createBaseModelRecord(model())).contentDigest).toHaveLength(64));
  it("supports 10000 base-model identity validations", async () => {
    const records = await Promise.all(
      Array.from({ length: 10000 }, (_, i) =>
        createBaseModelRecord({ ...model(), modelId: `org/model-${i}` }),
      ),
    );
    expect(records).toHaveLength(10000);
    expect(records[9999]?.contentDigest).toHaveLength(64);
  });
});

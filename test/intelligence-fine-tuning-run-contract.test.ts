import { describe, expect, it } from "vitest";

import {
  RUN_STATES,
  canTransitionRun,
  createRunRecord,
  FineTuningFailure,
  type RunState,
  createCheckpointRecord,
  createAdapterRecord,
} from "../app/features/intelligence-harness/fine-tuning";
const h = "a".repeat(64);
describe("KTS-I4-H run contract", () => {
  for (const state of RUN_STATES)
    it(`exports run state ${state}`, () => expect(RUN_STATES).toContain(state));
  const allowed: readonly (readonly [RunState, RunState])[] = [
    ["draft", "validated"],
    ["validated", "authorized"],
    ["authorized", "running"],
    ["running", "completed"],
    ["completed", "evaluated"],
    ["evaluated", "experiment_accepted"],
  ];
  for (const [from, to] of allowed)
    it(`allows transition ${from} to ${to}`, () => expect(canTransitionRun(from, to)).toBe(true));
  const blocked: readonly (readonly [RunState, RunState])[] = [
    ["draft", "running"],
    ["validated", "completed"],
    ["authorized", "experiment_accepted"],
    ["failed", "completed"],
    ["cancelled", "running"],
    ["rejected", "validated"],
  ];
  for (const [from, to] of blocked)
    it(`blocks transition ${from} to ${to}`, () => expect(canTransitionRun(from, to)).toBe(false));
  it("creates immutable run records", async () =>
    expect(
      Object.isFrozen(
        await createRunRecord({
          runId: "run:1",
          runVersion: "1",
          trainingPlanDigest: h,
          state: "validated",
          priorState: "draft",
          transitionReason: "validated",
          sequence: 1,
        }),
      ),
    ).toBe(true));
  it("rejects invalid transitions", async () =>
    await expect(
      createRunRecord({
        runId: "run:1",
        runVersion: "1",
        trainingPlanDigest: h,
        state: "completed",
        priorState: "draft",
        transitionReason: "bad",
        sequence: 1,
      }),
    ).rejects.toBeInstanceOf(FineTuningFailure));
  for (let i = 0; i < 30; i++)
    it(`creates deterministic run record ${i}`, async () =>
      expect(
        (
          await createRunRecord({
            runId: `run:${i}`,
            runVersion: "1",
            trainingPlanDigest: h,
            state: "validated",
            priorState: "draft",
            transitionReason: "validated",
            sequence: 1,
          })
        ).contentDigest,
      ).toHaveLength(64));
  it("creates checkpoint lineage records", async () =>
    expect(
      (
        await createCheckpointRecord({
          checkpointId: "checkpoint:1",
          parentBaseModelDigest: h,
          datasetManifestDigest: h,
          trainingPlanDigest: h,
          step: 10,
          epoch: 1,
          trainableParameterScope: "adapter_only",
          files: [{ path: "adapter.bin", digest: h, bytes: 100 }],
          metricSnapshotDigest: h,
          environmentDigest: h,
          status: "candidate",
        })
      ).contentDigest,
    ).toHaveLength(64));
  it("creates experimental adapter candidates", async () =>
    expect(
      (
        await createAdapterRecord({
          adapterId: "adapter:1",
          adapterVersion: "1",
          parentBaseModelDigest: h,
          datasetManifestDigest: h,
          trainingPlanDigest: h,
          finalCheckpointDigest: h,
          trainableParameterScope: "adapter_only",
          files: [{ path: "adapter.bin", digest: h, bytes: 100 }],
          status: "experimental_candidate",
          knownLimitations: ["experimental"],
        })
      ).status,
    ).toBe("experimental_candidate"));
  it("rejects malformed adapter lineage", async () =>
    await expect(
      createAdapterRecord({
        adapterId: "adapter:1",
        adapterVersion: "1",
        parentBaseModelDigest: "bad",
        datasetManifestDigest: h,
        trainingPlanDigest: h,
        finalCheckpointDigest: h,
        trainableParameterScope: "adapter_only",
        files: [{ path: "adapter.bin", digest: h, bytes: 100 }],
        status: "experimental_candidate",
        knownLimitations: [],
      }),
    ).rejects.toMatchObject({ code: "adapter_invalid" }));
  it("supports 10000 checkpoint records", async () => {
    const records = await Promise.all(
      Array.from({ length: 10000 }, (_, i) =>
        createCheckpointRecord({
          checkpointId: `checkpoint:${i}`,
          parentBaseModelDigest: h,
          datasetManifestDigest: h,
          trainingPlanDigest: h,
          step: i,
          epoch: i / 100,
          trainableParameterScope: "adapter_only",
          files: [{ path: `adapter-${i}.bin`, digest: h, bytes: 100 }],
          metricSnapshotDigest: h,
          environmentDigest: h,
          status: "candidate",
        }),
      ),
    );
    expect(records).toHaveLength(10000);
    expect(records[9999]?.contentDigest).toHaveLength(64);
  });
});

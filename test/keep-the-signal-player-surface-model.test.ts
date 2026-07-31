import { describe, expect, it } from "vitest";

import type { PowerShiftAction } from "../app/features/keep-the-signal/engine";
import type { KtsAudioSnapshot } from "../app/features/keep-the-signal/presentation";
import type {
  KtsBrowserAdapterSnapshot,
  KtsRuntimeLifecycle,
  KtsSessionRecord,
  ReplayVerificationFailure,
} from "../app/features/keep-the-signal/runtime";
import {
  KTS_PLAYER_POWER_TRANSFERS,
  createKtsSeedEntryModel,
  deriveKtsPlayerActions,
  deriveKtsPlayerOverlay,
  describeKtsAudio,
  formatKtsCoherenceTicks,
  formatKtsPowerTransfer,
  ktsToneClass,
  resolveKtsRouteSeed,
} from "../app/features/keep-the-signal/player/player-surface-model";

const VIEWPORT = Object.freeze({ cssWidth: 1280, cssHeight: 720, devicePixelRatio: 1 });

const AUDIO: KtsAudioSnapshot = Object.freeze({
  status: "locked",
  muted: false,
  masterVolume: 0.55,
  contextCreated: false,
  cuesAccepted: 0,
  cuesPlayed: 0,
  lastCue: null,
  disposed: false,
});

const FINAL_RECORD: KtsSessionRecord = Object.freeze({
  engineVersion: "kts-i2.0.0",
  rulesetVersion: "kts-foundation-0.1",
  seed: 123,
  frames: Object.freeze([]),
  finalCanonicalState: "sealed",
  finalDigest: "digest-123",
  outcome: "completed",
});

const REPLAY_FAILURE: ReplayVerificationFailure = Object.freeze({
  ok: false,
  reason: "digest_mismatch",
  processedTicks: 5,
  expected: "expected",
  actual: "actual",
  state: null,
});

describe("Keep the Signal KTS-I3 player surface model", () => {
  it("defines the six accepted power-transfer controls in keyboard order", () => {
    expect(KTS_PLAYER_POWER_TRANSFERS).toEqual([
      { key: "1", from: "defence", to: "weapons" },
      { key: "2", from: "signal", to: "weapons" },
      { key: "3", from: "weapons", to: "defence" },
      { key: "4", from: "signal", to: "defence" },
      { key: "5", from: "weapons", to: "signal" },
      { key: "6", from: "defence", to: "signal" },
    ]);
  });

  it.each([
    ["1", "Defence → Weapons"],
    ["2", "Signal → Weapons"],
    ["3", "Weapons → Defence"],
    ["4", "Signal → Defence"],
    ["5", "Weapons → Signal"],
    ["6", "Defence → Signal"],
  ])("formats power-transfer key %s", (key, expected) => {
    const transfer = KTS_PLAYER_POWER_TRANSFERS.find((candidate) => candidate.key === key);
    expect(formatKtsPowerTransfer(transfer as Readonly<PowerShiftAction>)).toBe(expected);
  });

  it("resolves an explicit valid route seed without calling the generator", () => {
    let calls = 0;
    expect(
      resolveKtsRouteSeed("?seed=42", () => {
        calls += 1;
        return 99;
      }),
    ).toEqual({ status: "ready", seed: 42, notice: null });
    expect(calls).toBe(0);
  });

  it("reports normalization when the route seed is zero", () => {
    const result = resolveKtsRouteSeed("?seed=0", () => 99);
    expect(result.status).toBe("ready");
    expect(result.seed).not.toBe(0);
    expect(result.notice).toContain("normalized");
  });

  it("generates a secure seed when the route seed is absent", () => {
    expect(resolveKtsRouteSeed("", () => 77)).toEqual({
      status: "ready",
      seed: 77,
      notice: null,
    });
  });

  it("replaces an invalid route seed and preserves the validation message", () => {
    const result = resolveKtsRouteSeed("?seed=invalid", () => 88);
    expect(result).toEqual({
      status: "ready",
      seed: 88,
      notice:
        "Seed must contain decimal digits only, without a sign or decimal point. A secure replacement seed was generated.",
    });
  });

  it("returns an initialization error when absent-seed generation fails", () => {
    const result = resolveKtsRouteSeed("", () => {
      throw new Error("crypto unavailable");
    });
    expect(result).toEqual({
      status: "error",
      seed: null,
      notice: "crypto unavailable",
    });
  });

  it("combines invalid-query and generation failures", () => {
    const result = resolveKtsRouteSeed("?seed=-1", () => {
      throw new Error("crypto unavailable");
    });
    expect(result.status).toBe("error");
    expect(result.notice).toContain("Seed must contain decimal digits only");
    expect(result.notice).toContain("crypto unavailable");
  });

  it.each([
    ["123", true, 123, null],
    [" 123 ", true, 123, null],
    ["0", true, null, "resolves"],
    ["", false, null, "unsigned 32-bit"],
    ["-1", false, null, "decimal digits"],
    ["4294967296", false, null, "between 0 and"],
  ] as const)(
    "projects seed entry %j",
    (input, canSubmit, expectedSeed, expectedMessageFragment) => {
      const model = createKtsSeedEntryModel(input);
      expect(model.canSubmit).toBe(canSubmit);

      if (input === "0") {
        expect(model.normalizedSeed).not.toBe(0);
      } else {
        expect(model.normalizedSeed).toBe(expectedSeed);
      }

      if (expectedMessageFragment === null) {
        expect(model.message).toBeNull();
      } else {
        expect(model.message).toContain(expectedMessageFragment);
      }
    },
  );

  it.each([
    ["idle", true, false, false, false, false],
    ["playing", false, true, false, false, true],
    ["replaying", false, true, false, false, false],
    ["completed", false, false, false, true, false],
    ["terminal", false, false, false, true, false],
  ] as const)(
    "derives action availability for %s",
    (lifecycle, canStart, canPause, canResume, canReplay, canControlShip) => {
      const actions = deriveKtsPlayerActions(
        makeSnapshot({
          lifecycle,
          sessionRecord:
            lifecycle === "completed" || lifecycle === "terminal" ? FINAL_RECORD : null,
        }),
      );
      expect(actions.canStart).toBe(canStart);
      expect(actions.canPause).toBe(canPause);
      expect(actions.canResume).toBe(canResume);
      expect(actions.canReplay).toBe(canReplay);
      expect(actions.canControlShip).toBe(canControlShip);
    },
  );

  it("allows a paused live session to resume", () => {
    const actions = deriveKtsPlayerActions(
      makeSnapshot({ lifecycle: "paused", resumeLifecycle: "playing" }),
    );
    expect(actions.canResume).toBe(true);
    expect(actions.canControlShip).toBe(false);
  });

  it("allows a paused replay to resume and exit", () => {
    const actions = deriveKtsPlayerActions(
      makeSnapshot({
        lifecycle: "paused",
        resumeLifecycle: "replaying",
        sessionRecord: FINAL_RECORD,
      }),
    );
    expect(actions.canResume).toBe(true);
    expect(actions.canExitReplay).toBe(true);
  });

  it("blocks resume after a replay integrity fault but allows exit", () => {
    const actions = deriveKtsPlayerActions(
      makeSnapshot({
        lifecycle: "paused",
        replayVerification: REPLAY_FAILURE,
        sessionRecord: FINAL_RECORD,
      }),
    );
    expect(actions.canResume).toBe(false);
    expect(actions.canExitReplay).toBe(true);
  });

  it.each([
    ["idle", "idle", "Begin transmission"],
    ["completed", "completed", "Run same seed again"],
    ["terminal", "terminal", "Retry same seed"],
  ] as const)("projects the %s lifecycle overlay", (lifecycle, kind, primaryLabel) => {
    const overlay = deriveKtsPlayerOverlay(
      makeSnapshot({
        lifecycle,
        sessionRecord: lifecycle === "idle" ? null : FINAL_RECORD,
      }),
    );
    expect(overlay?.kind).toBe(kind);
    expect(overlay?.primaryLabel).toBe(primaryLabel);
  });

  it("projects a normal paused overlay", () => {
    const overlay = deriveKtsPlayerOverlay(
      makeSnapshot({ lifecycle: "paused", resumeLifecycle: "playing" }),
    );
    expect(overlay?.kind).toBe("paused");
    expect(overlay?.primaryAction).toBe("resume");
  });

  it("projects a timing-interruption overlay", () => {
    const overlay = deriveKtsPlayerOverlay(
      makeSnapshot({
        lifecycle: "paused",
        resumeLifecycle: "playing",
        timingInterrupted: true,
      }),
    );
    expect(overlay?.kind).toBe("timing-interrupted");
    expect(overlay?.tone).toBe("warning");
  });

  it("projects a replay-integrity-fault overlay", () => {
    const overlay = deriveKtsPlayerOverlay(
      makeSnapshot({
        lifecycle: "paused",
        replayVerification: REPLAY_FAILURE,
        sessionRecord: FINAL_RECORD,
      }),
    );
    expect(overlay?.kind).toBe("replay-fault");
    expect(overlay?.description).toContain("digest mismatch");
  });

  it("uses replay-specific paused copy", () => {
    const overlay = deriveKtsPlayerOverlay(
      makeSnapshot({ lifecycle: "paused", resumeLifecycle: "replaying" }),
    );
    expect(overlay?.eyebrow).toContain("REPLAY PAUSED");
    expect(overlay?.primaryLabel).toBe("Resume replay");
  });

  it.each(["playing", "replaying"] as const)(
    "does not obscure active lifecycle %s",
    (lifecycle) => {
      expect(deriveKtsPlayerOverlay(makeSnapshot({ lifecycle }))).toBeNull();
    },
  );

  it.each([
    [0, "0.0s"],
    [1, "0.0s"],
    [30, "0.5s"],
    [60, "1.0s"],
    [3599, "60.0s"],
    [3600, "1m 00s"],
    [3660, "1m 01s"],
  ])("formats %i coherence ticks", (ticks, expected) => {
    expect(formatKtsCoherenceTicks(ticks)).toBe(expected);
  });

  it("supports a custom tick rate", () => {
    expect(formatKtsCoherenceTicks(20, 20)).toBe("1.0s");
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid coherence ticks %s", (ticks) => {
    expect(() => formatKtsCoherenceTicks(ticks)).toThrow(RangeError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid tick rate %s",
    (tickRate) => {
      expect(() => formatKtsCoherenceTicks(1, tickRate)).toThrow(RangeError);
    },
  );

  it.each([
    ["locked", false, 0.55, "Audio locked"],
    ["unavailable", false, 0.55, "Audio unavailable"],
    ["disposed", false, 0.55, "Audio disposed"],
    ["ready", true, 0.55, "Audio muted"],
    ["ready", false, 0.4, "Audio active at 40 percent"],
    ["suspended", false, 0.35, "Audio suspended"],
  ] as const)("describes %s audio", (status, muted, masterVolume, expected) => {
    expect(describeKtsAudio({ ...AUDIO, status, muted, masterVolume })).toBe(expected);
  });

  it.each(["neutral", "signal", "warning", "danger", "success"] as const)(
    "creates the %s tone class",
    (tone) => {
      expect(ktsToneClass(tone)).toBe(`kts-tone--${tone}`);
    },
  );
});

interface SnapshotOverrides {
  readonly lifecycle?: KtsRuntimeLifecycle;
  readonly resumeLifecycle?: "playing" | "replaying" | null;
  readonly timingInterrupted?: boolean;
  readonly sessionRecord?: KtsSessionRecord | null;
  readonly replayVerification?: ReplayVerificationFailure | null;
}

function makeSnapshot(overrides: SnapshotOverrides = {}): KtsBrowserAdapterSnapshot {
  const lifecycle = overrides.lifecycle ?? "idle";

  return {
    mounted: true,
    disposed: false,
    animationFrameScheduled: false,
    renderCount: 1,
    publicationCount: 1,
    reducedMotion: false,
    viewport: VIEWPORT,
    runtime: {
      lifecycle,
      seed: 123,
      previousState: { tick: 0, seed: 123 },
      currentState: { tick: 0, seed: 123 },
      loop: { interpolationAlpha: 0 },
      input: {},
      recentEvents: [],
      lastTickEvents: [],
      sessionFrameCount: 0,
      sessionRecord: overrides.sessionRecord ?? null,
      replayVerification: overrides.replayVerification ?? null,
      replayFrameIndex: 0,
      replayFrameCount: 0,
      timingInterrupted: overrides.timingInterrupted ?? false,
      resumeLifecycle: overrides.resumeLifecycle ?? null,
      disposed: false,
    },
    presentation: {},
    hud: {
      lifecycle,
      lifecycleLabel: lifecycle,
      signal: { value: 10_000, maximum: 10_000, ratio: 1, percent: 100 },
      defence: { value: 10_000, maximum: 10_000, ratio: 1, percent: 100 },
      score: 1_250,
      currentCoherenceTicks: 0,
      longestCoherenceTicks: 0,
      power: {
        weapons: 34,
        defence: 33,
        signal: 33,
        total: 100,
        shiftCooldown: { ready: true, ratio: 0 },
      },
      weaponCooldown: { ready: true, ratio: 0 },
      recoveryCooldown: { ready: true, ratio: 0 },
      encounter: {
        waveNumber: 1,
        waveCount: 5,
        phaseLabel: "Active",
        enemiesResolved: 0,
        enemiesScheduled: 8,
      },
      seed: 123,
      engineVersion: "kts-i2.0.0",
      rulesetVersion: "kts-foundation-0.1",
      finalDigest: overrides.sessionRecord?.finalDigest ?? null,
      recentEvents: [],
      latestAnnouncement: null,
      accessibleSummary: "Idle",
      timingInterrupted: overrides.timingInterrupted ?? false,
      replayFault: overrides.replayVerification?.reason ?? null,
    },
    renderSummary: null,
    audio: AUDIO,
  } as unknown as KtsBrowserAdapterSnapshot;
}

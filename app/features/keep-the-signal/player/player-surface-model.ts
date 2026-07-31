import type { PowerChannel, PowerShiftAction } from "../engine";
import type { KtsAudioSnapshot, KtsHudTone } from "../presentation";
import {
  generateRuntimeSeed,
  readSeedFromSearch,
  validateSeedText,
  type KtsBrowserAdapterSnapshot,
  type SeedValidationResult,
} from "../runtime";

export const KTS_PLAYER_POWER_TRANSFERS = Object.freeze([
  Object.freeze({ key: "1", from: "defence", to: "weapons" }),
  Object.freeze({ key: "2", from: "signal", to: "weapons" }),
  Object.freeze({ key: "3", from: "weapons", to: "defence" }),
  Object.freeze({ key: "4", from: "signal", to: "defence" }),
  Object.freeze({ key: "5", from: "weapons", to: "signal" }),
  Object.freeze({ key: "6", from: "defence", to: "signal" }),
] as const satisfies readonly (Readonly<PowerShiftAction> & { readonly key: string })[]);

export type KtsPlayerOverlayKind =
  "idle" | "paused" | "timing-interrupted" | "replay-fault" | "completed" | "terminal";

export interface KtsPlayerOverlayModel {
  readonly kind: KtsPlayerOverlayKind;
  readonly tone: KtsHudTone;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly primaryAction: "start" | "resume" | "restart" | "exit-replay";
  readonly primaryLabel: string;
  readonly secondaryAction: "replay" | "restart" | null;
  readonly secondaryLabel: string | null;
}

export interface KtsPlayerActionAvailability {
  readonly canStart: boolean;
  readonly canPause: boolean;
  readonly canResume: boolean;
  readonly canRestart: boolean;
  readonly canReplay: boolean;
  readonly canExitReplay: boolean;
  readonly canControlShip: boolean;
  readonly canQueueRecovery: boolean;
  readonly canQueuePowerShift: boolean;
}

export interface KtsRouteSeedResolution {
  readonly status: "ready" | "error";
  readonly seed: number | null;
  readonly notice: string | null;
}

export interface KtsSeedEntryModel {
  readonly validation: SeedValidationResult;
  readonly canSubmit: boolean;
  readonly normalizedSeed: number | null;
  readonly message: string | null;
}

export function resolveKtsRouteSeed(
  search: string,
  generator: () => number = generateRuntimeSeed,
): KtsRouteSeedResolution {
  const query = readSeedFromSearch(search);

  if (query.status === "valid") {
    return Object.freeze({
      status: "ready",
      seed: query.seed,
      notice: query.normalizedFromZero ? `Seed 0 was normalized to ${query.seed}.` : null,
    });
  }

  try {
    const generatedSeed = generator();

    if (query.status === "invalid") {
      return Object.freeze({
        status: "ready",
        seed: generatedSeed,
        notice: `${query.message} A secure replacement seed was generated.`,
      });
    }

    return Object.freeze({
      status: "ready",
      seed: generatedSeed,
      notice: null,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Secure seed generation failed.";

    return Object.freeze({
      status: "error",
      seed: null,
      notice: query.status === "invalid" ? `${query.message} ${detail}` : detail,
    });
  }
}

export function createKtsSeedEntryModel(input: string): KtsSeedEntryModel {
  const validation = validateSeedText(input);

  return Object.freeze({
    validation,
    canSubmit: validation.valid,
    normalizedSeed: validation.valid ? validation.seed : null,
    message: validation.valid
      ? validation.normalizedFromZero
        ? `Seed 0 resolves to ${validation.seed}.`
        : null
      : validation.message,
  });
}

export function deriveKtsPlayerActions(
  snapshot: Readonly<KtsBrowserAdapterSnapshot>,
): KtsPlayerActionAvailability {
  const lifecycle = snapshot.runtime.lifecycle;
  const replayIsPaused = lifecycle === "paused" && snapshot.runtime.resumeLifecycle === "replaying";
  const hasFinalRecord = snapshot.runtime.sessionRecord !== null;
  const replayFault =
    snapshot.runtime.replayVerification !== null && !snapshot.runtime.replayVerification.ok;

  return Object.freeze({
    canStart: lifecycle === "idle",
    canPause: lifecycle === "playing" || lifecycle === "replaying",
    canResume: lifecycle === "paused" && snapshot.runtime.resumeLifecycle !== null && !replayFault,
    canRestart: lifecycle !== "idle" || snapshot.runtime.currentState.tick > 0,
    canReplay: hasFinalRecord && (lifecycle === "completed" || lifecycle === "terminal"),
    canExitReplay:
      lifecycle === "replaying" ||
      replayIsPaused ||
      replayFault ||
      snapshot.runtime.replayVerification?.ok === true,
    canControlShip: lifecycle === "playing",
    canQueueRecovery: lifecycle === "playing",
    canQueuePowerShift: lifecycle === "playing",
  });
}

export function deriveKtsPlayerOverlay(
  snapshot: Readonly<KtsBrowserAdapterSnapshot>,
): KtsPlayerOverlayModel | null {
  const runtime = snapshot.runtime;
  const lifecycle = runtime.lifecycle;
  const replayFault =
    runtime.replayVerification !== null && !runtime.replayVerification.ok
      ? runtime.replayVerification.reason
      : null;

  if (lifecycle === "idle") {
    return overlay(
      "idle",
      "signal",
      "KTS / CARRIER READY",
      "Preserve the signal.",
      "Five waves are waiting beyond the carrier boundary. The engine is deterministic; every accepted input becomes replayable evidence.",
      "start",
      "Begin transmission",
      null,
      null,
    );
  }

  if (lifecycle === "paused" && replayFault !== null) {
    return overlay(
      "replay-fault",
      "danger",
      "KTS / INTEGRITY FAULT",
      "Replay evidence diverged.",
      `The deterministic replay check stopped with ${humanizeIdentifier(replayFault)}. Return to the finalized live record or begin a fresh run.`,
      "exit-replay",
      "Return to live record",
      "restart",
      "Restart same seed",
    );
  }

  if (lifecycle === "paused" && runtime.timingInterrupted) {
    return overlay(
      "timing-interrupted",
      "warning",
      "KTS / TIMING INTERRUPTED",
      "The frame backlog crossed the safe limit.",
      "Authoritative time has been paused and the interrupted backlog discarded. Resume explicitly when the browser is stable.",
      "resume",
      "Resume transmission",
      "restart",
      "Restart same seed",
    );
  }

  if (lifecycle === "paused") {
    return overlay(
      "paused",
      "neutral",
      runtime.resumeLifecycle === "replaying" ? "KTS / REPLAY PAUSED" : "KTS / SESSION PAUSED",
      runtime.resumeLifecycle === "replaying" ? "Replay held." : "Transmission held.",
      "The authoritative simulation is not advancing. Held and queued inputs have been cleared.",
      "resume",
      runtime.resumeLifecycle === "replaying" ? "Resume replay" : "Resume transmission",
      "restart",
      "Restart same seed",
    );
  }

  if (lifecycle === "completed") {
    return overlay(
      "completed",
      "success",
      "KTS / SIGNAL PRESERVED",
      "The encounter is complete.",
      `Final score ${snapshot.hud.score.toLocaleString("en-US")}. The run is sealed with canonical state and digest evidence.`,
      "restart",
      "Run same seed again",
      "replay",
      "Replay verified run",
    );
  }

  if (lifecycle === "terminal") {
    return overlay(
      "terminal",
      "danger",
      "KTS / SIGNAL LOST",
      "The carrier collapsed.",
      `Final score ${snapshot.hud.score.toLocaleString("en-US")}. The input record remains available for deterministic replay.`,
      "restart",
      "Retry same seed",
      "replay",
      "Replay failed run",
    );
  }

  return null;
}

export function formatKtsCoherenceTicks(ticks: number, ticksPerSecond = 60): string {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Coherence ticks must be a non-negative safe integer.");
  }

  if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) {
    throw new RangeError("ticksPerSecond must be a positive finite number.");
  }

  const totalSeconds = ticks / ticksPerSecond;

  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function formatKtsPowerTransfer(transfer: Readonly<PowerShiftAction>): string {
  return `${channelLabel(transfer.from)} → ${channelLabel(transfer.to)}`;
}

export function describeKtsAudio(audio: Readonly<KtsAudioSnapshot>): string {
  if (audio.status === "unavailable") {
    return "Audio unavailable";
  }

  if (audio.status === "locked") {
    return "Audio locked";
  }

  if (audio.status === "disposed") {
    return "Audio disposed";
  }

  if (audio.status === "suspended") {
    return "Audio suspended";
  }

  return audio.muted
    ? "Audio muted"
    : `Audio active at ${Math.round(audio.masterVolume * 100)} percent`;
}

export function ktsToneClass(tone: KtsHudTone): string {
  return `kts-tone--${tone}`;
}

function overlay(
  kind: KtsPlayerOverlayKind,
  tone: KtsHudTone,
  eyebrow: string,
  title: string,
  description: string,
  primaryAction: KtsPlayerOverlayModel["primaryAction"],
  primaryLabel: string,
  secondaryAction: KtsPlayerOverlayModel["secondaryAction"],
  secondaryLabel: string | null,
): KtsPlayerOverlayModel {
  return Object.freeze({
    kind,
    tone,
    eyebrow,
    title,
    description,
    primaryAction,
    primaryLabel,
    secondaryAction,
    secondaryLabel,
  });
}

function channelLabel(channel: PowerChannel): string {
  if (channel === "defence") {
    return "Defence";
  }

  return `${channel.charAt(0).toUpperCase()}${channel.slice(1)}`;
}

function humanizeIdentifier(identifier: string): string {
  return identifier.replaceAll("_", " ");
}

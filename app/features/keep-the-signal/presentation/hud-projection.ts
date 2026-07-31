import { ENGINE_CONSTANTS, type EngineEvent } from "../engine";
import type { KtsRuntimeLifecycle } from "../runtime";
import type { KtsPresentationFrame } from "./presentation-frame";

export const KTS_HUD_EVENT_LIMIT = 12;
const PRESENTATION_WEAPON_COOLDOWN_SCALE_TICKS = 18;

export type KtsHudTone = "neutral" | "signal" | "warning" | "danger" | "success";

export interface KtsHudMeter {
  readonly value: number;
  readonly maximum: number;
  readonly ratio: number;
  readonly percent: number;
}

export interface KtsHudCooldown {
  readonly remainingTicks: number;
  readonly scaleTicks: number;
  readonly ratio: number;
  readonly ready: boolean;
  readonly label: string;
}

export interface KtsHudPowerProjection {
  readonly weapons: number;
  readonly defence: number;
  readonly signal: number;
  readonly total: number;
  readonly shiftCooldown: KtsHudCooldown;
}

export interface KtsHudEncounterProjection {
  readonly waveNumber: number;
  readonly waveCount: number;
  readonly phase: "active" | "intermission" | "complete";
  readonly phaseLabel: string;
  readonly enemiesScheduled: number;
  readonly enemiesSpawned: number;
  readonly enemiesDefeated: number;
  readonly enemiesEscaped: number;
  readonly enemiesResolved: number;
  readonly totalDefeated: number;
  readonly totalEscaped: number;
}

export interface KtsHudEventRecord {
  readonly id: string;
  readonly tick: number;
  readonly type: EngineEvent["type"];
  readonly tone: KtsHudTone;
  readonly label: string;
  readonly announcement: string | null;
  readonly critical: boolean;
}

export interface KtsHudViewModel {
  readonly lifecycle: KtsRuntimeLifecycle;
  readonly lifecycleLabel: string;
  readonly signal: KtsHudMeter;
  readonly defence: KtsHudMeter;
  readonly score: number;
  readonly currentCoherenceTicks: number;
  readonly longestCoherenceTicks: number;
  readonly power: KtsHudPowerProjection;
  readonly weaponCooldown: KtsHudCooldown;
  readonly recoveryCooldown: KtsHudCooldown;
  readonly encounter: KtsHudEncounterProjection;
  readonly seed: number;
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly finalDigest: string | null;
  readonly recentEvents: readonly KtsHudEventRecord[];
  readonly latestAnnouncement: string | null;
  readonly accessibleSummary: string;
  readonly timingInterrupted: boolean;
  readonly replayFault: string | null;
}

export function projectKtsHud(frame: Readonly<KtsPresentationFrame>): KtsHudViewModel {
  const state = frame.currentState;
  const signal = createMeter(state.signal.integrity, ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY);
  const defence = createMeter(state.defence.integrity, ENGINE_CONSTANTS.MAX_DEFENCE_INTEGRITY);
  const weaponCooldown = createCooldown(
    state.weapon.fireCooldownTicks,
    PRESENTATION_WEAPON_COOLDOWN_SCALE_TICKS,
    "Weapons",
  );
  const recoveryCooldown = createCooldown(
    state.recoveryPulse.cooldownTicks,
    ENGINE_CONSTANTS.RECOVERY_PULSE_COOLDOWN_TICKS,
    "Recovery pulse",
  );
  const shiftCooldown = createCooldown(
    state.power.shiftCooldownTicks,
    ENGINE_CONSTANTS.POWER_SHIFT_COOLDOWN_TICKS,
    "Power transfer",
  );
  const power: KtsHudPowerProjection = Object.freeze({
    weapons: state.power.weapons,
    defence: state.power.defence,
    signal: state.power.signal,
    total: state.power.weapons + state.power.defence + state.power.signal,
    shiftCooldown,
  });
  const encounter: KtsHudEncounterProjection = Object.freeze({
    waveNumber: state.encounter.waveNumber,
    waveCount: ENGINE_CONSTANTS.ENCOUNTER_WAVE_COUNT,
    phase: state.encounter.phase,
    phaseLabel: encounterPhaseLabel(state.encounter.phase),
    enemiesScheduled: state.encounter.enemiesScheduled,
    enemiesSpawned: state.encounter.enemiesSpawned,
    enemiesDefeated: state.encounter.enemiesDefeated,
    enemiesEscaped: state.encounter.enemiesEscaped,
    enemiesResolved: state.encounter.enemiesDefeated + state.encounter.enemiesEscaped,
    totalDefeated: state.encounter.totalEnemiesDefeated,
    totalEscaped: state.encounter.totalEnemiesEscaped,
  });
  const recentEvents = projectKtsHudEvents(frame.recentEvents);
  const latestAnnouncement = findLatestAnnouncement(recentEvents);
  const lifecycleLabel = runtimeLifecycleLabel(frame.lifecycle);
  const accessibleSummary = createAccessibleHudSummary({
    lifecycleLabel,
    signal,
    defence,
    score: state.score,
    currentCoherenceTicks: state.currentCoherenceTicks,
    longestCoherenceTicks: state.longestCoherenceTicks,
    encounter,
    seed: state.seed,
    finalDigest: frame.finalDigest,
    timingInterrupted: frame.timingInterrupted,
    replayFault: frame.replayFault,
  });

  return Object.freeze({
    lifecycle: frame.lifecycle,
    lifecycleLabel,
    signal,
    defence,
    score: state.score,
    currentCoherenceTicks: state.currentCoherenceTicks,
    longestCoherenceTicks: state.longestCoherenceTicks,
    power,
    weaponCooldown,
    recoveryCooldown,
    encounter,
    seed: state.seed,
    engineVersion: state.engineVersion,
    rulesetVersion: state.rulesetVersion,
    finalDigest: frame.finalDigest,
    recentEvents,
    latestAnnouncement,
    accessibleSummary,
    timingInterrupted: frame.timingInterrupted,
    replayFault: frame.replayFault,
  });
}

export function projectKtsHudEvents(
  events: readonly Readonly<EngineEvent>[],
): readonly KtsHudEventRecord[] {
  const projected: KtsHudEventRecord[] = [];

  for (const event of events) {
    const record = projectKtsHudEvent(event);

    if (record !== null) {
      projected.push(record);
    }
  }

  return Object.freeze(projected.slice(-KTS_HUD_EVENT_LIMIT));
}

export function projectKtsHudEvent(event: Readonly<EngineEvent>): KtsHudEventRecord | null {
  if (event.type === "score_added") {
    return null;
  }

  const identity = `${event.tick}:${event.type}:${eventIdentitySuffix(event)}`;

  switch (event.type) {
    case "wave_started":
      return hudEvent(
        identity,
        event,
        "signal",
        `Wave ${event.waveNumber} started · ${event.enemiesScheduled} hostiles`,
        `Wave ${event.waveNumber} started. ${event.enemiesScheduled} hostiles scheduled.`,
        true,
      );
    case "wave_completed":
      return hudEvent(
        identity,
        event,
        "success",
        `Wave ${event.waveNumber} complete`,
        `Wave ${event.waveNumber} complete.`,
        true,
      );
    case "encounter_completed":
      return hudEvent(
        identity,
        event,
        "success",
        "Encounter complete",
        `Encounter complete. ${event.totalEnemiesDefeated} hostiles defeated and ${event.totalEnemiesEscaped} escaped.`,
        true,
      );
    case "game_terminated":
      return hudEvent(
        identity,
        event,
        "danger",
        "Signal lost",
        "Signal lost. Session terminated.",
        true,
      );
    case "signal_collapse_started":
      return hudEvent(
        identity,
        event,
        "danger",
        "Signal collapse sequence",
        "Warning. Signal collapse sequence started.",
        true,
      );
    case "signal_collapse_averted":
      return hudEvent(
        identity,
        event,
        "success",
        "Signal collapse averted",
        "Signal collapse averted.",
        true,
      );
    case "enemy_escaped":
      return hudEvent(
        identity,
        event,
        "danger",
        `Hostile ${event.enemyId} escaped`,
        `Hostile ${event.enemyId} escaped the field.`,
        true,
      );
    case "recovery_pulse_applied":
      return hudEvent(
        identity,
        event,
        "signal",
        `Recovery pulse · +${event.signalRestored} Signal · +${event.defenceRestored} Defence`,
        `Recovery pulse restored ${event.signalRestored} Signal and ${event.defenceRestored} Defence.`,
        true,
      );
    case "power_shift_applied":
      return hudEvent(
        identity,
        event,
        "signal",
        `${titleCase(event.from)} → ${titleCase(event.to)} · ${event.amount}`,
        `${event.amount} power transferred from ${event.from} to ${event.to}.`,
        false,
      );
    case "action_rejected":
      return hudEvent(
        identity,
        event,
        event.action === "power_shift" ? "warning" : "neutral",
        `${actionLabel(event.action)} rejected · ${reasonLabel(event.reason)}`,
        event.action === "power_shift"
          ? `Power transfer rejected. ${reasonLabel(event.reason)}.`
          : null,
        event.action === "power_shift",
      );
    case "enemy_destroyed":
      return hudEvent(
        identity,
        event,
        "success",
        `${titleCase(event.archetype)} ${event.enemyId} destroyed`,
        null,
        false,
      );
    case "enemy_spawned":
      return hudEvent(
        identity,
        event,
        "neutral",
        `${titleCase(event.archetype)} ${event.enemyId} detected`,
        null,
        false,
      );
    case "enemy_damaged":
      return hudEvent(
        identity,
        event,
        "warning",
        `Hostile ${event.enemyId} integrity ${event.nextIntegrity}`,
        null,
        false,
      );
    case "enemy_projectile_hit_player":
      return hudEvent(
        identity,
        event,
        "danger",
        `${titleCase(event.projectileKind)} impact · ${titleCase(event.target)}`,
        null,
        false,
      );
    case "defence_damaged":
      return hudEvent(
        identity,
        event,
        "warning",
        `Defence impact · ${event.effectiveDamage}`,
        null,
        false,
      );
    case "signal_damaged":
      return hudEvent(
        identity,
        event,
        "danger",
        `Signal corruption · ${event.effectiveDamage}`,
        null,
        false,
      );
    case "defence_recovered":
      return hudEvent(
        identity,
        event,
        "success",
        `Defence recovered · ${event.amount}`,
        null,
        false,
      );
    case "signal_recovered":
      return hudEvent(
        identity,
        event,
        "success",
        `Signal recovered · ${event.amount}`,
        null,
        false,
      );
    case "projectile_fired":
      return hudEvent(identity, event, "neutral", `Pulse ${event.projectileId} fired`, null, false);
    case "projectile_expired":
      return hudEvent(
        identity,
        event,
        "neutral",
        `Pulse ${event.projectileId} expired`,
        null,
        false,
      );
    case "enemy_fired":
      return hudEvent(
        identity,
        event,
        "warning",
        `Hostile ${event.enemyId} fired ${event.projectileKind}`,
        null,
        false,
      );
    case "enemy_fire_rejected":
      return hudEvent(
        identity,
        event,
        "neutral",
        `Hostile ${event.enemyId} fire rejected`,
        null,
        false,
      );
    case "enemy_projectile_expired":
      return hudEvent(
        identity,
        event,
        "neutral",
        `Hostile pulse ${event.projectileId} expired`,
        null,
        false,
      );
    case "player_projectile_hit_enemy":
      return hudEvent(identity, event, "signal", `Pulse hit hostile ${event.enemyId}`, null, false);
    case "enemy_score_awarded":
      return hudEvent(
        identity,
        event,
        "success",
        `Hostile ${event.enemyId} · +${event.amount}`,
        null,
        false,
      );
    case "interference_load_changed":
      return hudEvent(
        identity,
        event,
        event.nextLoad > event.previousLoad ? "warning" : "signal",
        `Interference ${event.previousLoad} → ${event.nextLoad}`,
        null,
        false,
      );
    default:
      return null;
  }
}

export function createMeter(value: number, maximum: number): KtsHudMeter {
  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new RangeError("maximum must be a positive finite number.");
  }

  const boundedValue = Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : 0;
  const ratio = boundedValue / maximum;

  return Object.freeze({
    value: boundedValue,
    maximum,
    ratio,
    percent: Math.round(ratio * 100),
  });
}

export function createCooldown(
  remainingTicks: number,
  scaleTicks: number,
  name: string,
): KtsHudCooldown {
  if (!Number.isFinite(scaleTicks) || scaleTicks <= 0) {
    throw new RangeError("scaleTicks must be a positive finite number.");
  }

  const boundedRemaining = Number.isFinite(remainingTicks) ? Math.max(0, remainingTicks) : 0;
  const ratio = Math.min(1, boundedRemaining / scaleTicks);
  const ready = boundedRemaining === 0;

  return Object.freeze({
    remainingTicks: boundedRemaining,
    scaleTicks,
    ratio,
    ready,
    label: ready ? `${name} ready` : `${name} unavailable for ${boundedRemaining} ticks`,
  });
}

export function encounterPhaseLabel(phase: "active" | "intermission" | "complete"): string {
  switch (phase) {
    case "active":
      return "Wave active";
    case "intermission":
      return "Signal recalibration";
    case "complete":
      return "Encounter complete";
  }
}

export function runtimeLifecycleLabel(lifecycle: KtsRuntimeLifecycle): string {
  switch (lifecycle) {
    case "idle":
      return "Awaiting activation";
    case "playing":
      return "Signal engaged";
    case "paused":
      return "Session paused";
    case "completed":
      return "Encounter complete";
    case "terminal":
      return "Signal lost";
    case "replaying":
      return "Replay verification";
  }
}

function createAccessibleHudSummary(input: {
  readonly lifecycleLabel: string;
  readonly signal: KtsHudMeter;
  readonly defence: KtsHudMeter;
  readonly score: number;
  readonly currentCoherenceTicks: number;
  readonly longestCoherenceTicks: number;
  readonly encounter: KtsHudEncounterProjection;
  readonly seed: number;
  readonly finalDigest: string | null;
  readonly timingInterrupted: boolean;
  readonly replayFault: string | null;
}): string {
  const resolved = input.encounter.enemiesResolved;
  const parts = [
    `${input.lifecycleLabel}.`,
    `Signal ${input.signal.percent} percent.`,
    `Defence ${input.defence.percent} percent.`,
    `Score ${input.score}.`,
    `Coherence ${input.currentCoherenceTicks} ticks, longest ${input.longestCoherenceTicks}.`,
    `Wave ${input.encounter.waveNumber} of ${input.encounter.waveCount}, ${input.encounter.phaseLabel.toLowerCase()}.`,
    `${resolved} of ${input.encounter.enemiesScheduled} current-wave hostiles resolved.`,
    `Seed ${input.seed}.`,
  ];

  if (input.timingInterrupted) {
    parts.push("Timing interruption requires explicit resume.");
  }

  if (input.replayFault !== null) {
    parts.push(`Replay integrity fault: ${input.replayFault}.`);
  }

  if (input.finalDigest !== null) {
    parts.push(`Final digest ${input.finalDigest}.`);
  }

  return parts.join(" ");
}

function hudEvent(
  id: string,
  event: Readonly<EngineEvent>,
  tone: KtsHudTone,
  label: string,
  announcement: string | null,
  critical: boolean,
): KtsHudEventRecord {
  return Object.freeze({
    id,
    tick: event.tick,
    type: event.type,
    tone,
    label,
    announcement,
    critical,
  });
}

function findLatestAnnouncement(events: readonly KtsHudEventRecord[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const announcement = events[index].announcement;

    if (announcement !== null) {
      return announcement;
    }
  }

  return null;
}

function eventIdentitySuffix(event: Readonly<EngineEvent>): string {
  if ("enemyId" in event) {
    return String(event.enemyId);
  }

  if ("projectileId" in event) {
    return String(event.projectileId);
  }

  if ("sourceId" in event && typeof event.sourceId === "string") {
    return event.sourceId;
  }

  if ("waveNumber" in event) {
    return String(event.waveNumber);
  }

  return "event";
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function actionLabel(action: string): string {
  return titleCase(action);
}

function reasonLabel(reason: string): string {
  return reason.replaceAll("_", " ");
}

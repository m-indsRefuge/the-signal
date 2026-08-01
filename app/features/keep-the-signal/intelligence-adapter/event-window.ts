import type { EngineEvent } from "../engine";
import { KtsObservationAdapterError } from "./observation-failures";
import {
  deepFreezeKtsValue,
  type KtsEventWindowMetadata,
  type KtsEventWindowObservation,
  type KtsObservationBudget,
  type KtsProjectedEngineEvent,
  type KtsProjectedEventDetails,
} from "./observation-contract";

interface IndexedEvent {
  readonly event: EngineEvent;
  readonly originalIndex: number;
}

export function projectKtsEventWindow(
  events: readonly EngineEvent[],
  stateTick: number,
  budget: Readonly<KtsObservationBudget>,
  requestedStartTick?: number,
): Readonly<KtsEventWindowObservation> {
  if (!Array.isArray(events)) {
    throw new KtsObservationAdapterError(
      "invalid_event_window",
      "event_projection",
      "The supplied engine event window must be an array.",
    );
  }

  if (
    requestedStartTick !== undefined &&
    (!Number.isSafeInteger(requestedStartTick) || requestedStartTick < 0)
  ) {
    throw new KtsObservationAdapterError(
      "invalid_event_window",
      "event_projection",
      "The requested event-window start tick must be a non-negative safe integer.",
    );
  }

  const ageStartTick = Math.max(0, stateTick - budget.maximumEventAgeTicks);
  const effectiveStartTick = Math.max(ageStartTick, requestedStartTick ?? 0);

  const indexed: IndexedEvent[] = events.map((event, originalIndex) => {
    if (
      typeof event !== "object" ||
      event === null ||
      !Number.isSafeInteger((event as { tick?: unknown }).tick) ||
      (event as { tick: number }).tick < 0
    ) {
      throw new KtsObservationAdapterError(
        "invalid_event_window",
        "event_projection",
        "Every engine event must carry a non-negative safe-integer tick.",
        { eventIndex: originalIndex },
      );
    }

    if (event.tick > stateTick) {
      throw new KtsObservationAdapterError(
        "future_event",
        "event_projection",
        "An engine event may not occur after the authoritative state tick.",
        { eventIndex: originalIndex, eventTick: event.tick, stateTick },
      );
    }

    return {
      event,
      originalIndex,
    };
  });

  indexed.sort((left, right) => {
    if (left.event.tick !== right.event.tick) {
      return left.event.tick - right.event.tick;
    }

    return left.originalIndex - right.originalIndex;
  });

  const eligible = indexed.filter(({ event }) => event.tick >= effectiveStartTick);
  const omittedByAge = indexed.length - eligible.length;

  const selected =
    budget.maximumRecentEvents === 0
      ? []
      : eligible.slice(Math.max(0, eligible.length - budget.maximumRecentEvents));

  const projected = selected.map(({ event }, sequence) => projectEngineEvent(event, sequence));

  const omittedByCount = eligible.length - selected.length;
  const omittedCount = omittedByAge + omittedByCount;

  const metadata: KtsEventWindowMetadata = {
    sourceCount: events.length,
    eligibleCount: eligible.length,
    includedCount: projected.length,
    omittedByAge,
    omittedByCount,
    omittedCount,
    truncated: omittedCount > 0,
    maximumRecentEvents: budget.maximumRecentEvents,
    maximumEventAgeTicks: budget.maximumEventAgeTicks,
    effectiveStartTick,
    selectionPolicy: "newest_eligible_stable_chronological",
  };

  return deepFreezeKtsValue({
    events: projected,
    metadata,
  });
}

export function projectEngineEvent(
  event: EngineEvent,
  sequence: number,
): Readonly<KtsProjectedEngineEvent> {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new KtsObservationAdapterError(
      "invalid_event_window",
      "event_projection",
      "Projected event sequence must be a non-negative safe integer.",
    );
  }

  switch (event.type) {
    case "power_shift_applied":
      return build(event, sequence, {
        from: event.from,
        to: event.to,
        amount: event.amount,
      });
    case "action_rejected":
      return build(
        event,
        sequence,
        {
          action: event.action,
          reason: event.reason,
        },
        event.sourceId,
      );
    case "projectile_fired":
      return build(event, sequence, { projectileId: event.projectileId });
    case "projectile_expired":
      return build(event, sequence, {
        projectileId: event.projectileId,
        reason: event.reason,
      });
    case "enemy_spawned":
      return build(event, sequence, {
        enemyId: event.enemyId,
        archetype: event.archetype,
        waveNumber: event.waveNumber,
        positionX: event.positionX,
        positionY: event.positionY,
        archetypeRoll: event.archetypeRoll,
        spawnXRoll: event.spawnXRoll,
      });
    case "enemy_fired":
      return build(event, sequence, {
        enemyId: event.enemyId,
        projectileId: event.projectileId,
        projectileKind: event.projectileKind,
        positionX: event.positionX,
        positionY: event.positionY,
        rawDamage: event.rawDamage,
      });
    case "enemy_fire_rejected":
      return build(event, sequence, {
        enemyId: event.enemyId,
        reason: event.reason,
      });
    case "enemy_projectile_expired":
      return build(event, sequence, {
        projectileId: event.projectileId,
        ownerEnemyId: event.ownerEnemyId,
        reason: event.reason,
      });
    case "player_projectile_hit_enemy":
      return build(event, sequence, {
        projectileId: event.projectileId,
        enemyId: event.enemyId,
        rawDamage: event.rawDamage,
        effectiveDamage: event.effectiveDamage,
      });
    case "enemy_damaged":
      return build(event, sequence, {
        enemyId: event.enemyId,
        projectileId: event.projectileId,
        previousIntegrity: event.previousIntegrity,
        nextIntegrity: event.nextIntegrity,
        rawDamage: event.rawDamage,
        effectiveDamage: event.effectiveDamage,
      });
    case "enemy_destroyed":
      return build(event, sequence, {
        enemyId: event.enemyId,
        archetype: event.archetype,
        projectileId: event.projectileId,
      });
    case "enemy_score_awarded":
      return build(event, sequence, {
        enemyId: event.enemyId,
        amount: event.amount,
        scoreAfter: event.scoreAfter,
      });
    case "enemy_projectile_hit_player":
      return build(event, sequence, {
        projectileId: event.projectileId,
        ownerEnemyId: event.ownerEnemyId,
        projectileKind: event.projectileKind,
        target: event.target,
        rawDamage: event.rawDamage,
      });
    case "enemy_escaped":
      return build(event, sequence, {
        enemyId: event.enemyId,
        archetype: event.archetype,
        positionY: event.positionY,
        defenceRawDamage: event.defenceRawDamage,
        signalRawDamage: event.signalRawDamage,
      });
    case "wave_started":
      return build(event, sequence, {
        waveNumber: event.waveNumber,
        enemiesScheduled: event.enemiesScheduled,
      });
    case "wave_completed":
      return build(event, sequence, {
        waveNumber: event.waveNumber,
        enemiesDefeated: event.enemiesDefeated,
        enemiesEscaped: event.enemiesEscaped,
        totalEnemiesDefeated: event.totalEnemiesDefeated,
        totalEnemiesEscaped: event.totalEnemiesEscaped,
      });
    case "encounter_completed":
      return build(event, sequence, {
        totalEnemiesDefeated: event.totalEnemiesDefeated,
        totalEnemiesEscaped: event.totalEnemiesEscaped,
      });
    case "recovery_pulse_applied":
      return build(event, sequence, {
        signalRestored: event.signalRestored,
        defenceRestored: event.defenceRestored,
      });
    case "defence_damaged":
      return build(
        event,
        sequence,
        {
          rawDamage: event.rawDamage,
          effectiveDamage: event.effectiveDamage,
        },
        event.sourceId,
      );
    case "defence_recovered":
      return build(event, sequence, { amount: event.amount });
    case "signal_damaged":
      return build(
        event,
        sequence,
        {
          source: event.source,
          rawDamage: event.rawDamage,
          effectiveDamage: event.effectiveDamage,
        },
        event.sourceId,
      );
    case "signal_recovered":
      return build(event, sequence, { amount: event.amount });
    case "interference_load_changed":
      return build(
        event,
        sequence,
        {
          previousLoad: event.previousLoad,
          nextLoad: event.nextLoad,
        },
        event.sourceId,
      );
    case "signal_collapse_started":
    case "signal_collapse_averted":
      return build(event, sequence, {});
    case "game_terminated":
      return build(event, sequence, { reason: event.reason });
    case "score_added":
      return build(event, sequence, {
        amount: event.amount,
        integrityTier: event.integrityTier,
        coherenceMultiplier: event.coherenceMultiplier,
      });
    default:
      return assertNeverEvent(event);
  }
}

function build(
  event: EngineEvent,
  sequence: number,
  details: KtsProjectedEventDetails,
  sourceId?: string,
): Readonly<KtsProjectedEngineEvent> {
  return deepFreezeKtsValue({
    type: event.type,
    tick: event.tick,
    sequence,
    ...(sourceId === undefined ? {} : { sourceId }),
    details: { ...details },
  });
}

function assertNeverEvent(event: never): never {
  const unknownEvent = event as { readonly type?: unknown };

  throw new KtsObservationAdapterError(
    "unknown_event_type",
    "event_projection",
    "The engine event type is not supported by the accepted observation schema.",
    {
      eventType: typeof unknownEvent.type === "string" ? unknownEvent.type : "unknown",
    },
  );
}

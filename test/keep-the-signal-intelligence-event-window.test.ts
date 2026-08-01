import { describe, expect, it } from "vitest";

import type { EngineEvent } from "../app/features/keep-the-signal/engine";
import {
  DEFAULT_KTS_OBSERVATION_BUDGET,
  KtsObservationAdapterError,
  projectEngineEvent,
  projectKtsEventWindow,
} from "../app/features/keep-the-signal/intelligence-adapter";

const eventCases: readonly EngineEvent[] = [
  { type: "power_shift_applied", tick: 1, from: "weapons", to: "signal", amount: 5 },
  {
    type: "action_rejected",
    tick: 1,
    action: "fire",
    reason: "cooldown_active",
    sourceId: "source",
  },
  { type: "projectile_fired", tick: 1, projectileId: 1 },
  { type: "projectile_expired", tick: 1, projectileId: 1, reason: "lifetime" },
  {
    type: "enemy_spawned",
    tick: 1,
    enemyId: 1,
    archetype: "scout",
    waveNumber: 1,
    positionX: 1,
    positionY: 2,
    archetypeRoll: 3,
    spawnXRoll: 4,
  },
  {
    type: "enemy_fired",
    tick: 1,
    enemyId: 1,
    projectileId: 2,
    projectileKind: "kinetic",
    positionX: 3,
    positionY: 4,
    rawDamage: 400,
  },
  { type: "enemy_fire_rejected", tick: 1, enemyId: 1, reason: "projectile_capacity" },
  {
    type: "enemy_projectile_expired",
    tick: 1,
    projectileId: 2,
    ownerEnemyId: 1,
    reason: "world_boundary",
  },
  {
    type: "player_projectile_hit_enemy",
    tick: 1,
    projectileId: 1,
    enemyId: 1,
    rawDamage: 1000,
    effectiveDamage: 900,
  },
  {
    type: "enemy_damaged",
    tick: 1,
    enemyId: 1,
    projectileId: 1,
    previousIntegrity: 1000,
    nextIntegrity: 100,
    rawDamage: 1000,
    effectiveDamage: 900,
  },
  { type: "enemy_destroyed", tick: 1, enemyId: 1, archetype: "scout", projectileId: 1 },
  { type: "enemy_score_awarded", tick: 1, enemyId: 1, amount: 100, scoreAfter: 200 },
  {
    type: "enemy_projectile_hit_player",
    tick: 1,
    projectileId: 2,
    ownerEnemyId: 1,
    projectileKind: "corruption",
    target: "signal",
    rawDamage: 650,
  },
  {
    type: "enemy_escaped",
    tick: 1,
    enemyId: 1,
    archetype: "interceptor",
    positionY: 999,
    defenceRawDamage: 500,
    signalRawDamage: 200,
  },
  { type: "wave_started", tick: 1, waveNumber: 2, enemiesScheduled: 10 },
  {
    type: "wave_completed",
    tick: 1,
    waveNumber: 1,
    enemiesDefeated: 7,
    enemiesEscaped: 1,
    totalEnemiesDefeated: 7,
    totalEnemiesEscaped: 1,
  },
  { type: "encounter_completed", tick: 1, totalEnemiesDefeated: 55, totalEnemiesEscaped: 5 },
  { type: "recovery_pulse_applied", tick: 1, signalRestored: 1200, defenceRestored: 600 },
  { type: "defence_damaged", tick: 1, sourceId: "impact", rawDamage: 500, effectiveDamage: 400 },
  { type: "defence_recovered", tick: 1, amount: 10 },
  {
    type: "signal_damaged",
    tick: 1,
    sourceId: "corruption",
    source: "corruption",
    rawDamage: 500,
    effectiveDamage: 400,
  },
  { type: "signal_recovered", tick: 1, amount: 10 },
  { type: "interference_load_changed", tick: 1, sourceId: "field", previousLoad: 10, nextLoad: 20 },
  { type: "signal_collapse_started", tick: 1 },
  { type: "signal_collapse_averted", tick: 1 },
  { type: "game_terminated", tick: 1, reason: "signal_collapse" },
  { type: "score_added", tick: 1, amount: 10, integrityTier: 2, coherenceMultiplier: 3 },
];

describe("KTS-I4-C event projection", () => {
  for (const event of eventCases) {
    it(`projects accepted event variant ${event.type}`, () => {
      const projected = projectEngineEvent(event, 0);
      expect(projected.type).toBe(event.type);
      expect(projected.tick).toBe(1);
      expect(projected.sequence).toBe(0);
      expect(Object.isFrozen(projected)).toBe(true);
      expect(Object.isFrozen(projected.details)).toBe(true);
    });
  }

  it("preserves a supplied source identity", () => {
    const projected = projectEngineEvent(
      {
        type: "defence_damaged",
        tick: 3,
        sourceId: "impact-1",
        rawDamage: 500,
        effectiveDamage: 400,
      },
      0,
    );

    expect(projected.sourceId).toBe("impact-1");
  });

  it("does not spread unselected event fields", () => {
    const event = {
      type: "projectile_fired",
      tick: 2,
      projectileId: 4,
      hidden: "not accepted",
    } as EngineEvent;

    expect(projectEngineEvent(event, 0)).not.toHaveProperty("hidden");
    expect(projectEngineEvent(event, 0).details).not.toHaveProperty("hidden");
  });

  it("orders events by tick", () => {
    const result = projectKtsEventWindow(
      [
        { type: "signal_recovered", tick: 3, amount: 1 },
        { type: "signal_recovered", tick: 1, amount: 1 },
        { type: "signal_recovered", tick: 2, amount: 1 },
      ],
      3,
      DEFAULT_KTS_OBSERVATION_BUDGET,
    );

    expect(result.events.map((event) => event.tick)).toEqual([1, 2, 3]);
  });

  it("preserves caller sequence for same-tick events", () => {
    const result = projectKtsEventWindow(
      [
        { type: "projectile_fired", tick: 2, projectileId: 8 },
        { type: "projectile_fired", tick: 2, projectileId: 3 },
      ],
      2,
      DEFAULT_KTS_OBSERVATION_BUDGET,
    );

    expect(result.events.map((event) => event.details.projectileId)).toEqual([8, 3]);
  });

  it("retains the newest eligible events under the count budget", () => {
    const result = projectKtsEventWindow(
      [
        { type: "signal_recovered", tick: 1, amount: 1 },
        { type: "signal_recovered", tick: 2, amount: 1 },
        { type: "signal_recovered", tick: 3, amount: 1 },
      ],
      3,
      { ...DEFAULT_KTS_OBSERVATION_BUDGET, maximumRecentEvents: 2 },
    );

    expect(result.events.map((event) => event.tick)).toEqual([2, 3]);
    expect(result.metadata.omittedByCount).toBe(1);
  });

  it("removes events older than the age budget", () => {
    const result = projectKtsEventWindow(
      [
        { type: "signal_recovered", tick: 1, amount: 1 },
        { type: "signal_recovered", tick: 9, amount: 1 },
      ],
      10,
      { ...DEFAULT_KTS_OBSERVATION_BUDGET, maximumEventAgeTicks: 2 },
    );

    expect(result.events.map((event) => event.tick)).toEqual([9]);
    expect(result.metadata.omittedByAge).toBe(1);
  });

  it("honours an explicit later event-window start tick", () => {
    const result = projectKtsEventWindow(
      [
        { type: "signal_recovered", tick: 5, amount: 1 },
        { type: "signal_recovered", tick: 8, amount: 1 },
      ],
      10,
      DEFAULT_KTS_OBSERVATION_BUDGET,
      7,
    );

    expect(result.events.map((event) => event.tick)).toEqual([8]);
    expect(result.metadata.effectiveStartTick).toBe(7);
  });

  it("supports a zero event count budget", () => {
    const result = projectKtsEventWindow([{ type: "signal_recovered", tick: 1, amount: 1 }], 1, {
      ...DEFAULT_KTS_OBSERVATION_BUDGET,
      maximumRecentEvents: 0,
    });

    expect(result.events).toEqual([]);
    expect(result.metadata.omittedByCount).toBe(1);
  });

  it("reports aggregate omission metadata", () => {
    const result = projectKtsEventWindow(
      [
        { type: "signal_recovered", tick: 1, amount: 1 },
        { type: "signal_recovered", tick: 9, amount: 1 },
        { type: "signal_recovered", tick: 10, amount: 1 },
      ],
      10,
      {
        ...DEFAULT_KTS_OBSERVATION_BUDGET,
        maximumEventAgeTicks: 2,
        maximumRecentEvents: 1,
      },
    );

    expect(result.metadata.omittedByAge).toBe(1);
    expect(result.metadata.omittedByCount).toBe(1);
    expect(result.metadata.omittedCount).toBe(2);
    expect(result.metadata.truncated).toBe(true);
  });

  it("rejects an event after the authoritative state tick", () => {
    expect(() =>
      projectKtsEventWindow(
        [{ type: "signal_recovered", tick: 2, amount: 1 }],
        1,
        DEFAULT_KTS_OBSERVATION_BUDGET,
      ),
    ).toThrowError(KtsObservationAdapterError);
  });

  it("rejects an event with an invalid tick", () => {
    expect(() =>
      projectKtsEventWindow(
        [{ type: "signal_recovered", tick: -1, amount: 1 }],
        1,
        DEFAULT_KTS_OBSERVATION_BUDGET,
      ),
    ).toThrowError(KtsObservationAdapterError);
  });

  it("rejects an invalid requested start tick", () => {
    expect(() => projectKtsEventWindow([], 1, DEFAULT_KTS_OBSERVATION_BUDGET, -1)).toThrowError(
      KtsObservationAdapterError,
    );
  });

  it("fails closed for an unknown event type", () => {
    expect(() => projectEngineEvent({ type: "future_event", tick: 1 } as never, 0)).toThrowError(
      KtsObservationAdapterError,
    );
  });

  it("rejects an invalid projected sequence", () => {
    expect(() =>
      projectEngineEvent({ type: "signal_recovered", tick: 1, amount: 1 }, -1),
    ).toThrowError(KtsObservationAdapterError);
  });

  it("returns an immutable event-window record", () => {
    const result = projectKtsEventWindow(
      [{ type: "signal_recovered", tick: 1, amount: 1 }],
      1,
      DEFAULT_KTS_OBSERVATION_BUDGET,
    );

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.events)).toBe(true);
    expect(Object.isFrozen(result.metadata)).toBe(true);
  });

  it("does not mutate the supplied event sequence", () => {
    const events: EngineEvent[] = [
      { type: "signal_recovered", tick: 2, amount: 2 },
      { type: "signal_recovered", tick: 1, amount: 1 },
    ];
    const before = structuredClone(events);

    projectKtsEventWindow(events, 2, DEFAULT_KTS_OBSERVATION_BUDGET);
    expect(events).toEqual(before);
  });
});

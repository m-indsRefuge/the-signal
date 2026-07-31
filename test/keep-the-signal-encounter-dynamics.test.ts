import { describe, expect, it } from "vitest";

import { circlesCollide } from "../app/features/keep-the-signal/engine/collisions";

import {
  ENGINE_CONSTANTS,
  NEUTRAL_TICK_FRAME,
  canEnemyFire,
  createEnemyProjectileState,
  createEnemySpawn,
  createEnemyState,
  createInitialGameState,
  createStateDigest,
  decrementEnemyFireCooldown,
  decrementEnemyFireCooldowns,
  enemyProjectileIsOutsideWorld,
  integrateEnemyMovement,
  integrateEnemyProjectile,
  stepGame,
  type EnemyProjectileState,
  type EnemyState,
  type GameState,
} from "../app/features/keep-the-signal/engine";

describe("Keep the Signal encounter movement and projectile primitives", () => {
  it("decrements a firing enemy cooldown without mutation", () => {
    const enemy = createEnemyState(1, "interceptor", 500_000);
    const result = decrementEnemyFireCooldown(enemy);

    expect(result.fireCooldownTicks).toBe(119);
    expect(enemy.fireCooldownTicks).toBe(120);
    expect(result).not.toBe(enemy);
  });

  it("clamps an enemy fire cooldown at zero", () => {
    const enemy = {
      ...createEnemyState(1, "interceptor", 500_000),
      fireCooldownTicks: 0,
    };

    expect(decrementEnemyFireCooldown(enemy).fireCooldownTicks).toBe(0);
  });

  it("decrements all enemy cooldowns while preserving input order", () => {
    const first = {
      ...createEnemyState(1, "interceptor", 400_000),
      fireCooldownTicks: 2,
    };
    const second = {
      ...createEnemyState(2, "disruptor", 600_000),
      fireCooldownTicks: 1,
    };

    const result = decrementEnemyFireCooldowns([first, second]);

    expect(result.map((enemy) => enemy.id)).toEqual([1, 2]);
    expect(result.map((enemy) => enemy.fireCooldownTicks)).toEqual([1, 0]);
    expect(first.fireCooldownTicks).toBe(2);
    expect(second.fireCooldownTicks).toBe(1);
  });

  it("prevents Scouts from firing even at zero cooldown", () => {
    const scout = createEnemyState(1, "scout", 500_000);

    expect(scout.fireCooldownTicks).toBe(0);
    expect(canEnemyFire(scout)).toBe(false);
  });

  it("allows an Interceptor to fire only at zero cooldown", () => {
    const cooling = {
      ...createEnemyState(1, "interceptor", 500_000),
      fireCooldownTicks: 1,
    };
    const ready = {
      ...cooling,
      fireCooldownTicks: 0,
    };

    expect(canEnemyFire(cooling)).toBe(false);
    expect(canEnemyFire(ready)).toBe(true);
  });

  it("moves a Scout downward by its accepted velocity", () => {
    const scout = createEnemyState(1, "scout", 500_000);
    const moved = integrateEnemyMovement(scout);

    expect(moved.positionX).toBe(500_000);
    expect(moved.positionY).toBe(41_800);
    expect(scout.positionY).toBe(40_000);
  });

  it("moves a Disruptor downward by its accepted velocity", () => {
    const disruptor = createEnemyState(1, "disruptor", 500_000);
    const moved = integrateEnemyMovement(disruptor);

    expect(moved.positionX).toBe(500_000);
    expect(moved.positionY).toBe(40_900);
  });

  it("moves an Interceptor horizontally and vertically", () => {
    const interceptor = createEnemyState(1, "interceptor", 500_000);
    const moved = integrateEnemyMovement(interceptor);

    expect(moved.positionX).toBe(500_900);
    expect(moved.positionY).toBe(41_300);
    expect(moved.velocityX).toBe(900);
  });

  it("clamps and reverses an Interceptor crossing the left boundary", () => {
    const interceptor = {
      ...createEnemyState(2, "interceptor", 40_100),
      velocityX: -900,
    };

    const moved = integrateEnemyMovement(interceptor);

    expect(moved.positionX).toBe(ENGINE_CONSTANTS.ENEMY_SPAWN_MIN_X);
    expect(moved.positionY).toBe(41_300);
    expect(moved.velocityX).toBe(900);
  });

  it("clamps and reverses an Interceptor crossing the right boundary", () => {
    const interceptor = {
      ...createEnemyState(1, "interceptor", 959_900),
      velocityX: 900,
    };

    const moved = integrateEnemyMovement(interceptor);

    expect(moved.positionX).toBe(ENGINE_CONSTANTS.ENEMY_SPAWN_MAX_X);
    expect(moved.positionY).toBe(41_300);
    expect(moved.velocityX).toBe(-900);
  });

  it("does not apply extra horizontal movement after a boundary reversal", () => {
    const interceptor = {
      ...createEnemyState(1, "interceptor", 959_900),
      velocityX: 900,
    };

    const first = integrateEnemyMovement(interceptor);
    const second = integrateEnemyMovement(first);

    expect(first.positionX).toBe(960_000);
    expect(second.positionX).toBe(959_100);
  });

  it("creates the accepted kinetic projectile from an Interceptor", () => {
    const interceptor = createEnemyState(1, "interceptor", 500_000);

    expect(createEnemyProjectileState(1, interceptor)).toEqual({
      id: 1,
      ownerEnemyId: 1,
      kind: "kinetic",
      positionX: 500_000,
      positionY: 62_000,
      velocityX: 0,
      velocityY: 5_000,
      radius: 5_000,
      rawDamage: 400,
      remainingTicks: 240,
    });
  });

  it("creates the accepted corruption projectile from a Disruptor", () => {
    const disruptor = createEnemyState(2, "disruptor", 600_000);

    expect(createEnemyProjectileState(7, disruptor)).toEqual({
      id: 7,
      ownerEnemyId: 2,
      kind: "corruption",
      positionX: 600_000,
      positionY: 65_000,
      velocityX: 0,
      velocityY: 5_000,
      radius: 5_000,
      rawDamage: 650,
      remainingTicks: 240,
    });
  });

  it("rejects projectile creation for a Scout", () => {
    const scout = createEnemyState(1, "scout", 500_000);

    expect(() => createEnemyProjectileState(1, scout)).toThrow(
      'Enemy archetype "scout" cannot create a projectile.',
    );
  });

  it("rejects a non-positive enemy-projectile ID", () => {
    const interceptor = createEnemyState(1, "interceptor", 500_000);

    expect(() => createEnemyProjectileState(0, interceptor)).toThrow(
      "Enemy projectile ID must be a positive safe integer.",
    );
  });

  it("moves an enemy projectile and decrements its lifetime", () => {
    const projectile = createEnemyProjectileState(1, createEnemyState(1, "interceptor", 500_000));

    const result = integrateEnemyProjectile(projectile);

    expect(result.expiryReason).toBeNull();
    expect(result.projectile.positionY).toBe(67_000);
    expect(result.projectile.remainingTicks).toBe(239);
    expect(projectile.positionY).toBe(62_000);
    expect(projectile.remainingTicks).toBe(240);
  });

  it("expires an enemy projectile when its lifetime reaches zero", () => {
    const projectile: EnemyProjectileState = {
      ...createEnemyProjectileState(1, createEnemyState(1, "interceptor", 500_000)),
      remainingTicks: 1,
    };

    const result = integrateEnemyProjectile(projectile);

    expect(result.expiryReason).toBe("lifetime");
    expect(result.projectile.remainingTicks).toBe(0);
  });

  it("gives lifetime expiry precedence over world-boundary expiry", () => {
    const projectile: EnemyProjectileState = {
      ...createEnemyProjectileState(1, createEnemyState(1, "interceptor", 500_000)),
      positionY: 1_000_001,
      remainingTicks: 1,
    };

    expect(integrateEnemyProjectile(projectile).expiryReason).toBe("lifetime");
  });

  it("expires a projectile only after its complete radius leaves the world", () => {
    const touchingBoundary: EnemyProjectileState = {
      ...createEnemyProjectileState(1, createEnemyState(1, "interceptor", 500_000)),
      positionY: 1_000_000,
      remainingTicks: 10,
    };

    const outsideBoundary: EnemyProjectileState = {
      ...touchingBoundary,
      positionY: 1_000_001,
    };

    expect(integrateEnemyProjectile(touchingBoundary).expiryReason).toBeNull();

    expect(integrateEnemyProjectile(outsideBoundary).expiryReason).toBe("world_boundary");
  });

  it("detects all four complete-radius world exits", () => {
    const base = createEnemyProjectileState(1, createEnemyState(1, "interceptor", 500_000));

    expect(
      enemyProjectileIsOutsideWorld({
        ...base,
        positionX: -5_001,
      }),
    ).toBe(true);

    expect(
      enemyProjectileIsOutsideWorld({
        ...base,
        positionX: 1_005_001,
      }),
    ).toBe(true);

    expect(
      enemyProjectileIsOutsideWorld({
        ...base,
        positionY: -5_001,
      }),
    ).toBe(true);

    expect(
      enemyProjectileIsOutsideWorld({
        ...base,
        positionY: 1_005_001,
      }),
    ).toBe(true);
  });
});

function createRunningStateWithEnemy(enemy: EnemyState, spawnCooldownTicks = 2): GameState {
  const state = createInitialGameState({ seed: 1_987_041_211 });

  state.encounter.spawnCooldownTicks = spawnCooldownTicks;
  state.encounter.enemiesSpawned = 1;
  state.encounter.nextEnemyId = enemy.id + 1;
  state.enemies = [enemy];

  return state;
}

describe("Keep the Signal authoritative encounter lifecycle integration", () => {
  it("spawns and moves the first enemy during the first running step", () => {
    const initial = createInitialGameState({ seed: 1_987_041_211 });
    const expectedSpawn = createEnemySpawn({
      waveNumber: 1,
      enemyId: 1,
      rngState: initial.rngState,
    });

    const result = stepGame(initial, NEUTRAL_TICK_FRAME);

    expect(initial.enemies).toEqual([]);
    expect(initial.encounter.enemiesSpawned).toBe(0);
    expect(initial.rngState).toBe(1_987_041_211);

    expect(result.state.rngState).toBe(expectedSpawn.nextRngState);
    expect(result.state.encounter.enemiesSpawned).toBe(1);
    expect(result.state.encounter.nextEnemyId).toBe(2);
    expect(result.state.encounter.spawnCooldownTicks).toBe(82);

    expect(result.state.enemies).toEqual([
      {
        ...expectedSpawn.enemy,
        positionY: expectedSpawn.enemy.positionY + expectedSpawn.enemy.velocityY,
      },
    ]);

    expect(result.events.find((event) => event.type === "enemy_spawned")).toEqual({
      type: "enemy_spawned",
      tick: 0,
      enemyId: 1,
      archetype: expectedSpawn.enemy.archetype,
      waveNumber: 1,
      positionX: expectedSpawn.enemy.positionX,
      positionY: expectedSpawn.enemy.positionY,
      archetypeRoll: expectedSpawn.archetypeRoll,
      spawnXRoll: expectedSpawn.spawnXRoll,
    });
  });

  it("decrements the spawn cooldown before testing spawn eligibility", () => {
    const first = stepGame(createInitialGameState({ seed: 1_987_041_211 }), NEUTRAL_TICK_FRAME);

    const second = stepGame(first.state, NEUTRAL_TICK_FRAME);

    expect(second.state.encounter.spawnCooldownTicks).toBe(81);
    expect(second.state.encounter.enemiesSpawned).toBe(1);
    expect(second.events.some((event) => event.type === "enemy_spawned")).toBe(false);
  });

  it("spawns the second enemy after exactly 82 later running steps", () => {
    let state = stepGame(createInitialGameState({ seed: 1_987_041_211 }), NEUTRAL_TICK_FRAME).state;

    for (let index = 0; index < 81; index += 1) {
      state = stepGame(state, NEUTRAL_TICK_FRAME).state;
    }

    expect(state.encounter.spawnCooldownTicks).toBe(1);
    expect(state.encounter.enemiesSpawned).toBe(1);

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.encounter.spawnCooldownTicks).toBe(82);
    expect(result.state.encounter.enemiesSpawned).toBe(2);
    expect(result.state.enemies.map((enemy) => enemy.id)).toEqual([1, 2]);
    expect(result.events.find((event) => event.type === "enemy_spawned")).toMatchObject({
      type: "enemy_spawned",
      tick: 82,
      enemyId: 2,
      waveNumber: 1,
    });
  });

  it("consumes exactly two RNG transitions for each authoritative spawn", () => {
    const initial = createInitialGameState({ seed: 1_987_041_211 });
    const firstExpected = createEnemySpawn({
      waveNumber: 1,
      enemyId: 1,
      rngState: initial.rngState,
    });
    const secondExpected = createEnemySpawn({
      waveNumber: 1,
      enemyId: 2,
      rngState: firstExpected.nextRngState,
    });

    let state = stepGame(initial, NEUTRAL_TICK_FRAME).state;

    for (let index = 0; index < 82; index += 1) {
      state = stepGame(state, NEUTRAL_TICK_FRAME).state;
    }

    expect(state.rngState).toBe(secondExpected.nextRngState);
    expect(state.enemies[0]?.positionX).toBe(firstExpected.enemy.positionX);
    expect(state.enemies[1]?.positionX).toBe(secondExpected.enemy.positionX);
  });

  it("decrements fire cooldown, moves, fires, and moves the new projectile in order", () => {
    const interceptor = {
      ...createEnemyState(1, "interceptor", 500_000),
      fireCooldownTicks: 1,
    };

    const result = stepGame(createRunningStateWithEnemy(interceptor), NEUTRAL_TICK_FRAME);

    expect(result.state.enemies[0]).toMatchObject({
      id: 1,
      positionX: 500_900,
      positionY: 41_300,
      fireCooldownTicks: 120,
    });

    expect(result.state.enemyProjectiles).toEqual([
      {
        id: 1,
        ownerEnemyId: 1,
        kind: "kinetic",
        positionX: 500_900,
        positionY: 68_300,
        velocityX: 0,
        velocityY: 5_000,
        radius: 5_000,
        rawDamage: 400,
        remainingTicks: 239,
      },
    ]);

    expect(result.state.encounter.nextEnemyProjectileId).toBe(2);

    expect(result.events.find((event) => event.type === "enemy_fired")).toEqual({
      type: "enemy_fired",
      tick: 0,
      enemyId: 1,
      projectileId: 1,
      projectileKind: "kinetic",
      positionX: 500_900,
      positionY: 63_300,
      rawDamage: 400,
    });
  });

  it("creates and moves a corruption projectile from a ready Disruptor", () => {
    const disruptor = {
      ...createEnemyState(1, "disruptor", 600_000),
      fireCooldownTicks: 1,
    };

    const result = stepGame(createRunningStateWithEnemy(disruptor), NEUTRAL_TICK_FRAME);

    expect(result.state.enemies[0]).toMatchObject({
      positionX: 600_000,
      positionY: 40_900,
      fireCooldownTicks: 180,
    });

    expect(result.state.enemyProjectiles[0]).toMatchObject({
      kind: "corruption",
      positionX: 600_000,
      positionY: 70_900,
      rawDamage: 650,
      remainingTicks: 239,
    });

    expect(result.events.find((event) => event.type === "enemy_fired")).toMatchObject({
      enemyId: 1,
      projectileKind: "corruption",
      positionX: 600_000,
      positionY: 65_900,
      rawDamage: 650,
    });
  });

  it("rejects enemy firing at projectile capacity and resets the cooldown", () => {
    const interceptor = {
      ...createEnemyState(1, "interceptor", 500_000),
      fireCooldownTicks: 1,
    };
    const state = createRunningStateWithEnemy(interceptor);

    state.enemyProjectiles = Array.from(
      { length: ENGINE_CONSTANTS.MAX_ACTIVE_ENEMY_PROJECTILES },
      (_, index) => createEnemyProjectileState(index + 1, interceptor),
    );
    state.encounter.nextEnemyProjectileId = ENGINE_CONSTANTS.MAX_ACTIVE_ENEMY_PROJECTILES + 1;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemyProjectiles).toHaveLength(
      ENGINE_CONSTANTS.MAX_ACTIVE_ENEMY_PROJECTILES,
    );
    expect(result.state.encounter.nextEnemyProjectileId).toBe(129);
    expect(result.state.enemies[0]?.fireCooldownTicks).toBe(120);

    expect(result.events.find((event) => event.type === "enemy_fire_rejected")).toEqual({
      type: "enemy_fire_rejected",
      tick: 0,
      enemyId: 1,
      reason: "projectile_capacity",
    });
  });

  it("expires an enemy projectile by lifetime in the authoritative step", () => {
    const state = createInitialGameState({ seed: 1 });
    const interceptor = createEnemyState(1, "interceptor", 500_000);

    state.encounter.spawnCooldownTicks = 2;
    state.encounter.nextEnemyProjectileId = 2;
    state.enemyProjectiles = [
      {
        ...createEnemyProjectileState(1, interceptor),
        remainingTicks: 1,
      },
    ];

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemyProjectiles).toEqual([]);
    expect(result.events.find((event) => event.type === "enemy_projectile_expired")).toEqual({
      type: "enemy_projectile_expired",
      tick: 0,
      projectileId: 1,
      ownerEnemyId: 1,
      reason: "lifetime",
    });
  });

  it("expires an enemy projectile by world boundary in the authoritative step", () => {
    const state = createInitialGameState({ seed: 1 });
    const interceptor = createEnemyState(1, "interceptor", 500_000);

    state.encounter.spawnCooldownTicks = 2;
    state.encounter.nextEnemyProjectileId = 2;
    state.enemyProjectiles = [
      {
        ...createEnemyProjectileState(1, interceptor),
        positionY: 1_000_001,
        remainingTicks: 10,
      },
    ];

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemyProjectiles).toEqual([]);
    expect(result.events.find((event) => event.type === "enemy_projectile_expired")).toEqual({
      type: "enemy_projectile_expired",
      tick: 0,
      projectileId: 1,
      ownerEnemyId: 1,
      reason: "world_boundary",
    });
  });

  it("uses the input-state tick for all encounter lifecycle events", () => {
    const interceptor = {
      ...createEnemyState(1, "interceptor", 500_000),
      fireCooldownTicks: 1,
    };
    const state = createRunningStateWithEnemy(interceptor);

    state.tick = 37;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    const encounterEvents = result.events.filter(
      (event) =>
        event.type === "enemy_fired" ||
        event.type === "enemy_fire_rejected" ||
        event.type === "enemy_projectile_expired" ||
        event.type === "enemy_spawned",
    );

    expect(encounterEvents.length).toBeGreaterThan(0);
    expect(encounterEvents.every((event) => event.tick === 37)).toBe(true);
    expect(result.state.tick).toBe(38);
  });

  it("emits an authoritative spawn event before ordinary tick scoring", () => {
    const result = stepGame(createInitialGameState({ seed: 1_987_041_211 }), NEUTRAL_TICK_FRAME);

    const spawnIndex = result.events.findIndex((event) => event.type === "enemy_spawned");
    const scoreIndex = result.events.findIndex((event) => event.type === "score_added");

    expect(spawnIndex).toBeGreaterThanOrEqual(0);
    expect(scoreIndex).toBeGreaterThan(spawnIndex);
  });

  it("keeps a terminal encounter state as a complete deep-cloned no-op", () => {
    const state = createInitialGameState({ seed: 1 });

    state.status = "terminal";
    state.terminalReason = "signal_collapse";
    state.signal.integrity = 0;
    state.signal.collapseTicks = ENGINE_CONSTANTS.SIGNAL_COLLAPSE_GRACE_TICKS;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state).toEqual(state);
    expect(result.state).not.toBe(state);
    expect(result.state.encounter).not.toBe(state.encounter);
    expect(result.state.enemies).not.toBe(state.enemies);
    expect(result.state.enemyProjectiles).not.toBe(state.enemyProjectiles);
    expect(result.events).toEqual([]);
  });

  it("reproduces equal authoritative encounter state from equal seeds and frames", () => {
    const run = (): GameState => {
      let state = createInitialGameState({ seed: 1_987_041_211 });

      for (let index = 0; index < 240; index += 1) {
        state = stepGame(state, NEUTRAL_TICK_FRAME).state;
      }

      return state;
    };

    const first = run();
    const second = run();

    expect(first).toEqual(second);
    expect(createStateDigest(first)).toBe(createStateDigest(second));
  });
});

function createCombatStateWithEnemies(enemies: EnemyState[]): GameState {
  const state = createInitialGameState({ seed: 1_987_041_211 });

  state.encounter.spawnCooldownTicks = 2;
  state.encounter.enemiesSpawned = enemies.length;
  state.encounter.nextEnemyId =
    enemies.reduce((maximum, enemy) => Math.max(maximum, enemy.id), 0) + 1;
  state.enemies = enemies;

  return state;
}

function addPlayerProjectile(
  state: GameState,
  options: {
    readonly id?: number;
    readonly positionX: number;
    readonly positionY: number;
  },
): void {
  const id = options.id ?? 1;

  state.weapon.nextProjectileId = Math.max(state.weapon.nextProjectileId, id + 1);

  state.projectiles.push({
    id,
    positionX: options.positionX,
    positionY: options.positionY,
    velocityX: 0,
    velocityY: 0,
    radius: ENGINE_CONSTANTS.PROJECTILE_RADIUS,
    remainingTicks: 10,
  });

  state.projectiles.sort((left, right) => left.id - right.id);
}

function addEnemyProjectileAtPlayer(state: GameState, projectile: EnemyProjectileState): void {
  state.encounter.nextEnemyProjectileId = Math.max(
    state.encounter.nextEnemyProjectileId,
    projectile.id + 1,
  );

  state.enemyProjectiles.push({
    ...projectile,
    positionX: state.player.positionX,
    positionY: state.player.positionY - ENGINE_CONSTANTS.ENEMY_PROJECTILE_SPEED_PER_TICK,
    remainingTicks: 10,
  });

  state.enemyProjectiles.sort((left, right) => left.id - right.id);
}

describe("Keep the Signal deterministic combat resolution", () => {
  it("collides at the exact squared-distance boundary", () => {
    expect(
      circlesCollide(
        { positionX: 0, positionY: 0, radius: 4 },
        { positionX: 10, positionY: 0, radius: 6 },
      ),
    ).toBe(true);
  });

  it("does not collide one unit beyond the combined radii", () => {
    expect(
      circlesCollide(
        { positionX: 0, positionY: 0, radius: 4 },
        { positionX: 11, positionY: 0, radius: 6 },
      ),
    ).toBe(false);
  });

  it("rejects collision calculations outside safe-integer limits", () => {
    expect(() =>
      circlesCollide(
        {
          positionX: Number.MAX_SAFE_INTEGER,
          positionY: 0,
          radius: 1,
        },
        { positionX: 0, positionY: 0, radius: 1 },
      ),
    ).toThrow("Collision squared-distance calculation must remain within safe-integer limits.");
  });

  it("uses the lowest enemy ID when one projectile overlaps multiple enemies", () => {
    const first = createEnemyState(1, "scout", 500_000);
    const second = createEnemyState(2, "scout", 500_000);
    const state = createCombatStateWithEnemies([first, second]);

    addPlayerProjectile(state, {
      positionX: 500_000,
      positionY: 41_800,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.projectiles).toEqual([]);
    expect(result.state.enemies.map((enemy) => enemy.id)).toEqual([2]);
    expect(result.state.encounter.enemiesDefeated).toBe(1);

    expect(
      result.events.find((event) => event.type === "player_projectile_hit_enemy"),
    ).toMatchObject({
      projectileId: 1,
      enemyId: 1,
    });
  });

  it("removes a player projectile and applies nonlethal enemy damage", () => {
    const disruptor = createEnemyState(1, "disruptor", 500_000);
    const state = createCombatStateWithEnemies([disruptor]);

    addPlayerProjectile(state, {
      positionX: 500_000,
      positionY: 40_900,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.projectiles).toEqual([]);
    expect(result.state.enemies[0]?.integrity).toBe(1_600);
    expect(result.state.encounter.enemiesDefeated).toBe(0);

    expect(result.events.find((event) => event.type === "enemy_damaged")).toEqual({
      type: "enemy_damaged",
      tick: 0,
      enemyId: 1,
      projectileId: 1,
      previousIntegrity: 2_600,
      nextIntegrity: 1_600,
      rawDamage: 1_000,
      effectiveDamage: 1_000,
    });
  });

  it("destroys an enemy, increments counters, and awards its fixed score", () => {
    const scout = createEnemyState(1, "scout", 500_000);
    const state = createCombatStateWithEnemies([scout]);

    addPlayerProjectile(state, {
      positionX: 500_000,
      positionY: 41_800,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemies).toEqual([]);
    expect(result.state.encounter.enemiesDefeated).toBe(1);
    expect(result.state.encounter.totalEnemiesDefeated).toBe(1);
    expect(result.state.score).toBe(106);

    expect(result.events.find((event) => event.type === "enemy_destroyed")).toEqual({
      type: "enemy_destroyed",
      tick: 0,
      enemyId: 1,
      archetype: "scout",
      projectileId: 1,
    });

    expect(result.events.find((event) => event.type === "enemy_score_awarded")).toEqual({
      type: "enemy_score_awarded",
      tick: 0,
      enemyId: 1,
      amount: 100,
      scoreAfter: 100,
    });
  });

  it("does not reset current coherence when an enemy is destroyed", () => {
    const scout = createEnemyState(1, "scout", 500_000);
    const state = createCombatStateWithEnemies([scout]);

    state.currentCoherenceTicks = 100;
    state.longestCoherenceTicks = 100;

    addPlayerProjectile(state, {
      positionX: 500_000,
      positionY: 41_800,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.currentCoherenceTicks).toBe(101);
    expect(result.state.longestCoherenceTicks).toBe(101);
  });

  it("lets each player projectile hit at most one enemy", () => {
    const first = createEnemyState(1, "scout", 500_000);
    const second = createEnemyState(2, "scout", 500_000);
    const state = createCombatStateWithEnemies([first, second]);

    addPlayerProjectile(state, {
      positionX: 500_000,
      positionY: 41_800,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);
    const hitEvents = result.events.filter((event) => event.type === "player_projectile_hit_enemy");

    expect(hitEvents).toHaveLength(1);
    expect(result.state.enemies).toHaveLength(1);
  });

  it("resolves player projectiles in ascending ID order", () => {
    const interceptor = createEnemyState(1, "interceptor", 500_000);
    const state = createCombatStateWithEnemies([interceptor]);

    addPlayerProjectile(state, {
      id: 2,
      positionX: 500_900,
      positionY: 41_300,
    });
    addPlayerProjectile(state, {
      id: 1,
      positionX: 500_900,
      positionY: 41_300,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);
    const damageEvents = result.events.filter((event) => event.type === "enemy_damaged");

    expect(damageEvents).toEqual([
      {
        type: "enemy_damaged",
        tick: 0,
        enemyId: 1,
        projectileId: 1,
        previousIntegrity: 1_800,
        nextIntegrity: 800,
        rawDamage: 1_000,
        effectiveDamage: 1_000,
      },
      {
        type: "enemy_damaged",
        tick: 0,
        enemyId: 1,
        projectileId: 2,
        previousIntegrity: 800,
        nextIntegrity: 0,
        rawDamage: 1_000,
        effectiveDamage: 800,
      },
    ]);

    expect(result.state.enemies).toEqual([]);
    expect(result.state.projectiles).toEqual([]);
  });

  it("emits destruction and bonus events before ordinary tick scoring", () => {
    const scout = createEnemyState(1, "scout", 500_000);
    const state = createCombatStateWithEnemies([scout]);

    addPlayerProjectile(state, {
      positionX: 500_000,
      positionY: 41_800,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);
    const destroyedIndex = result.events.findIndex((event) => event.type === "enemy_destroyed");
    const awardedIndex = result.events.findIndex((event) => event.type === "enemy_score_awarded");
    const ordinaryScoreIndex = result.events.findIndex((event) => event.type === "score_added");

    expect(destroyedIndex).toBeGreaterThanOrEqual(0);
    expect(awardedIndex).toBeGreaterThan(destroyedIndex);
    expect(ordinaryScoreIndex).toBeGreaterThan(awardedIndex);
  });

  it("routes a kinetic projectile through Defence mitigation", () => {
    const state = createInitialGameState({ seed: 1 });
    const interceptor = createEnemyState(1, "interceptor", 500_000);

    state.encounter.spawnCooldownTicks = 2;
    state.defence.ticksSinceDamage = 500;

    addEnemyProjectileAtPlayer(state, createEnemyProjectileState(1, interceptor));

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemyProjectiles).toEqual([]);
    expect(result.state.defence.integrity).toBe(9_668);
    expect(result.state.defence.ticksSinceDamage).toBe(0);
    expect(result.state.signal.integrity).toBe(10_000);

    expect(result.events.find((event) => event.type === "enemy_projectile_hit_player")).toEqual({
      type: "enemy_projectile_hit_player",
      tick: 0,
      projectileId: 1,
      ownerEnemyId: 1,
      projectileKind: "kinetic",
      target: "defence",
      rawDamage: 400,
    });

    expect(result.events.find((event) => event.type === "defence_damaged")).toMatchObject({
      sourceId: "enemy_projectile:1",
      rawDamage: 400,
      effectiveDamage: 332,
    });
  });

  it("routes a corruption projectile through Signal resistance", () => {
    const state = createInitialGameState({ seed: 1 });
    const disruptor = createEnemyState(1, "disruptor", 500_000);

    state.encounter.spawnCooldownTicks = 2;
    state.signal.ticksSinceDamage = 500;

    addEnemyProjectileAtPlayer(state, createEnemyProjectileState(1, disruptor));

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemyProjectiles).toEqual([]);
    expect(result.state.signal.integrity).toBe(9_447);
    expect(result.state.signal.ticksSinceDamage).toBe(0);
    expect(result.state.defence.integrity).toBe(10_000);

    expect(
      result.events.find((event) => event.type === "enemy_projectile_hit_player"),
    ).toMatchObject({
      projectileId: 1,
      projectileKind: "corruption",
      target: "signal",
      rawDamage: 650,
    });

    expect(result.events.find((event) => event.type === "signal_damaged")).toMatchObject({
      sourceId: "enemy_projectile:1",
      source: "corruption",
      rawDamage: 650,
      effectiveDamage: 553,
    });
  });

  it("resolves enemy projectiles in ascending projectile ID order", () => {
    const state = createInitialGameState({ seed: 1 });
    const interceptor = createEnemyState(1, "interceptor", 500_000);
    const disruptor = createEnemyState(2, "disruptor", 500_000);

    state.encounter.spawnCooldownTicks = 2;

    addEnemyProjectileAtPlayer(state, createEnemyProjectileState(2, disruptor));
    addEnemyProjectileAtPlayer(state, createEnemyProjectileState(1, interceptor));

    const result = stepGame(state, NEUTRAL_TICK_FRAME);
    const hitEvents = result.events.filter((event) => event.type === "enemy_projectile_hit_player");

    expect(
      hitEvents.map((event) =>
        event.type === "enemy_projectile_hit_player" ? event.projectileId : -1,
      ),
    ).toEqual([1, 2]);
  });

  it("preserves a noncolliding enemy projectile", () => {
    const state = createInitialGameState({ seed: 1 });
    const interceptor = createEnemyState(1, "interceptor", 100_000);
    const projectile = createEnemyProjectileState(1, interceptor);

    state.encounter.spawnCooldownTicks = 2;
    state.encounter.nextEnemyProjectileId = 2;
    state.enemyProjectiles = [
      {
        ...projectile,
        positionX: 100_000,
        positionY: 100_000,
        remainingTicks: 10,
      },
    ];

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemyProjectiles).toHaveLength(1);
    expect(result.state.enemyProjectiles[0]).toMatchObject({
      id: 1,
      positionX: 100_000,
      positionY: 105_000,
      remainingTicks: 9,
    });
  });

  it("uses the input-state tick for every combat event", () => {
    const scout = createEnemyState(1, "scout", 500_000);
    const state = createCombatStateWithEnemies([scout]);

    state.tick = 37;

    addPlayerProjectile(state, {
      positionX: 500_000,
      positionY: 41_800,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);
    const combatEvents = result.events.filter(
      (event) =>
        event.type === "player_projectile_hit_enemy" ||
        event.type === "enemy_damaged" ||
        event.type === "enemy_destroyed" ||
        event.type === "enemy_score_awarded" ||
        event.type === "enemy_projectile_hit_player",
    );

    expect(combatEvents).not.toHaveLength(0);
    expect(combatEvents.every((event) => event.tick === 37)).toBe(true);
  });

  it("does not mutate the previous combat state", () => {
    const scout = createEnemyState(1, "scout", 500_000);
    const state = createCombatStateWithEnemies([scout]);

    addPlayerProjectile(state, {
      positionX: 500_000,
      positionY: 41_800,
    });

    const snapshot = structuredClone(state);
    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(state).toEqual(snapshot);
    expect(result.state).not.toBe(state);
    expect(result.state.enemies).not.toBe(state.enemies);
    expect(result.state.projectiles).not.toBe(state.projectiles);
  });
});

function createEscapingEnemy(
  enemyId: number,
  archetype: "scout" | "interceptor" | "disruptor" = "scout",
  offsetBeyondBoundary = 1,
): EnemyState {
  const enemy = createEnemyState(enemyId, archetype, 500_000);

  return {
    ...enemy,
    positionY: ENGINE_CONSTANTS.WORLD_MAX + enemy.radius - enemy.velocityY + offsetBeyondBoundary,
  };
}

function createIntermissionState(phaseTicks: number): GameState {
  const state = createInitialGameState({ seed: 1_987_041_211 });

  state.encounter = {
    ...state.encounter,
    phase: "intermission",
    waveNumber: 1,
    phaseTicks,
    spawnCooldownTicks: 0,
    enemiesScheduled: 8,
    enemiesSpawned: 8,
    enemiesDefeated: 8,
    enemiesEscaped: 0,
    totalEnemiesDefeated: 8,
    totalEnemiesEscaped: 0,
    nextEnemyId: 9,
    nextEnemyProjectileId: 1,
  };

  return state;
}

function createFinalWaveStateWithEscapingScout(): GameState {
  const state = createInitialGameState({ seed: 1_987_041_211 });
  const enemy = createEscapingEnemy(60);

  state.encounter = {
    ...state.encounter,
    phase: "active",
    waveNumber: 5,
    phaseTicks: 0,
    spawnCooldownTicks: 0,
    enemiesScheduled: 16,
    enemiesSpawned: 16,
    enemiesDefeated: 15,
    enemiesEscaped: 0,
    totalEnemiesDefeated: 59,
    totalEnemiesEscaped: 0,
    nextEnemyId: 61,
    nextEnemyProjectileId: 1,
  };
  state.enemies = [enemy];

  return state;
}

describe("Keep the Signal enemy escape and wave progression", () => {
  it("does not escape an enemy exactly touching the lower world boundary", () => {
    const enemy = createEscapingEnemy(1, "scout", 0);
    const state = createCombatStateWithEnemies([enemy]);

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemies).toHaveLength(1);
    expect(result.state.encounter.enemiesEscaped).toBe(0);
    expect(result.events.some((event) => event.type === "enemy_escaped")).toBe(false);
  });

  it("escapes an enemy once its complete radius passes the world boundary", () => {
    const enemy = createEscapingEnemy(1);
    const state = createCombatStateWithEnemies([enemy]);

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.enemies).toEqual([]);
    expect(result.state.encounter.enemiesEscaped).toBe(1);
    expect(result.state.encounter.totalEnemiesEscaped).toBe(1);
    expect(result.events.find((event) => event.type === "enemy_escaped")).toEqual({
      type: "enemy_escaped",
      tick: 0,
      enemyId: 1,
      archetype: "scout",
      positionY: 1_014_001,
      defenceRawDamage: 300,
      signalRawDamage: 0,
    });
  });

  it("processes simultaneous escapes in ascending enemy-ID order", () => {
    const state = createCombatStateWithEnemies([createEscapingEnemy(1), createEscapingEnemy(2)]);

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(
      result.events.filter((event) => event.type === "enemy_escaped").map((event) => event.enemyId),
    ).toEqual([1, 2]);
  });

  it("routes Interceptor escape consequences through both accepted damage paths", () => {
    const state = createCombatStateWithEnemies([createEscapingEnemy(1, "interceptor")]);
    state.defence.ticksSinceDamage = 500;
    state.signal.ticksSinceDamage = 500;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.defence.integrity).toBe(9_585);
    expect(result.state.signal.integrity).toBe(9_830);
    expect(result.state.defence.ticksSinceDamage).toBe(0);
    expect(result.state.signal.ticksSinceDamage).toBe(0);

    expect(
      result.events.find(
        (event) => event.type === "defence_damaged" && event.sourceId === "enemy_escape:1:defence",
      ),
    ).toMatchObject({
      rawDamage: 500,
      effectiveDamage: 415,
    });

    expect(
      result.events.find(
        (event) => event.type === "signal_damaged" && event.sourceId === "enemy_escape:1:signal",
      ),
    ).toMatchObject({
      source: "corruption",
      rawDamage: 200,
      effectiveDamage: 170,
    });
  });

  it("prevents an enemy destroyed during combat from escaping later in the tick", () => {
    const enemy = createEscapingEnemy(1);
    const state = createCombatStateWithEnemies([enemy]);

    addPlayerProjectile(state, {
      positionX: enemy.positionX,
      positionY: ENGINE_CONSTANTS.WORLD_MAX + ENGINE_CONSTANTS.PROJECTILE_RADIUS,
    });

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.encounter.enemiesDefeated).toBe(1);
    expect(result.state.encounter.enemiesEscaped).toBe(0);
    expect(result.events.some((event) => event.type === "enemy_destroyed")).toBe(true);
    expect(result.events.some((event) => event.type === "enemy_escaped")).toBe(false);
  });

  it("waits for active enemy projectiles before completing a resolved wave", () => {
    const state = createIntermissionState(0);
    state.encounter.phase = "active";
    state.enemyProjectiles = [
      {
        id: 1,
        ownerEnemyId: 8,
        kind: "kinetic",
        positionX: 100_000,
        positionY: 100_000,
        velocityX: 0,
        velocityY: 0,
        radius: ENGINE_CONSTANTS.ENEMY_PROJECTILE_RADIUS,
        rawDamage: 400,
        remainingTicks: 10,
      },
    ];
    state.encounter.nextEnemyProjectileId = 2;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.encounter.phase).toBe("active");
    expect(result.events.some((event) => event.type === "wave_completed")).toBe(false);
  });

  it("enters intermission after the final enemy projectile expires", () => {
    const state = createIntermissionState(0);
    state.encounter.phase = "active";
    state.enemyProjectiles = [
      {
        id: 1,
        ownerEnemyId: 8,
        kind: "kinetic",
        positionX: 100_000,
        positionY: 100_000,
        velocityX: 0,
        velocityY: 0,
        radius: ENGINE_CONSTANTS.ENEMY_PROJECTILE_RADIUS,
        rawDamage: 400,
        remainingTicks: 1,
      },
    ];
    state.encounter.nextEnemyProjectileId = 2;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.encounter.phase).toBe("intermission");
    expect(result.state.encounter.phaseTicks).toBe(0);
    expect(result.state.encounter.spawnCooldownTicks).toBe(0);
    expect(result.events.find((event) => event.type === "wave_completed")).toMatchObject({
      tick: 0,
      waveNumber: 1,
      enemiesDefeated: 8,
      enemiesEscaped: 0,
      totalEnemiesDefeated: 8,
      totalEnemiesEscaped: 0,
    });
  });

  it("emits ordinary tick scoring before wave completion", () => {
    const state = createIntermissionState(0);
    state.encounter.phase = "active";

    const result = stepGame(state, NEUTRAL_TICK_FRAME);
    const scoreIndex = result.events.findIndex((event) => event.type === "score_added");
    const waveIndex = result.events.findIndex((event) => event.type === "wave_completed");

    expect(scoreIndex).toBeGreaterThanOrEqual(0);
    expect(waveIndex).toBeGreaterThan(scoreIndex);
  });

  it("increments intermission phase ticks while ordinary simulation continues", () => {
    const state = createIntermissionState(0);

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.encounter.phase).toBe("intermission");
    expect(result.state.encounter.phaseTicks).toBe(1);
    expect(result.state.tick).toBe(1);
    expect(result.state.score).toBeGreaterThan(0);
  });

  it("does not spawn or consume RNG during an unfinished intermission", () => {
    const state = createIntermissionState(50);
    const previousRngState = state.rngState;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.rngState).toBe(previousRngState);
    expect(result.state.enemies).toEqual([]);
    expect(result.events.some((event) => event.type === "enemy_spawned")).toBe(false);
  });

  it("starts Wave 2 and spawns its first enemy on the 180th intermission step", () => {
    const state = createIntermissionState(179);

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.encounter.phase).toBe("active");
    expect(result.state.encounter.waveNumber).toBe(2);
    expect(result.state.encounter.phaseTicks).toBe(0);
    expect(result.state.encounter.enemiesScheduled).toBe(10);
    expect(result.state.encounter.enemiesSpawned).toBe(1);
    expect(result.state.enemies).toHaveLength(1);
    expect(result.state.enemies[0].positionY).toBeGreaterThan(ENGINE_CONSTANTS.ENEMY_SPAWN_Y);
  });

  it("resets current-wave counters while preserving encounter totals", () => {
    const state = createIntermissionState(179);
    state.encounter.enemiesDefeated = 6;
    state.encounter.enemiesEscaped = 2;
    state.encounter.totalEnemiesDefeated = 6;
    state.encounter.totalEnemiesEscaped = 2;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);

    expect(result.state.encounter.enemiesDefeated).toBe(0);
    expect(result.state.encounter.enemiesEscaped).toBe(0);
    expect(result.state.encounter.totalEnemiesDefeated).toBe(6);
    expect(result.state.encounter.totalEnemiesEscaped).toBe(2);
  });

  it("emits wave_started before the same-tick enemy_spawned event", () => {
    const result = stepGame(createIntermissionState(179), NEUTRAL_TICK_FRAME);

    const waveStartedIndex = result.events.findIndex((event) => event.type === "wave_started");
    const enemySpawnedIndex = result.events.findIndex((event) => event.type === "enemy_spawned");

    expect(result.events[waveStartedIndex]).toMatchObject({
      type: "wave_started",
      tick: 0,
      waveNumber: 2,
      enemiesScheduled: 10,
    });
    expect(enemySpawnedIndex).toBeGreaterThan(waveStartedIndex);
  });

  it("completes the encounter after Wave 5 resolves", () => {
    const result = stepGame(createFinalWaveStateWithEscapingScout(), NEUTRAL_TICK_FRAME);

    expect(result.state.encounter.phase).toBe("complete");
    expect(result.state.encounter.waveNumber).toBe(5);
    expect(result.state.encounter.enemiesEscaped).toBe(1);
    expect(result.state.encounter.totalEnemiesDefeated).toBe(59);
    expect(result.state.encounter.totalEnemiesEscaped).toBe(1);
    expect(result.state.status).toBe("running");

    expect(
      result.events.filter(
        (event) => event.type === "wave_completed" || event.type === "encounter_completed",
      ),
    ).toEqual([
      {
        type: "wave_completed",
        tick: 0,
        waveNumber: 5,
        enemiesDefeated: 15,
        enemiesEscaped: 1,
        totalEnemiesDefeated: 59,
        totalEnemiesEscaped: 1,
      },
      {
        type: "encounter_completed",
        tick: 0,
        totalEnemiesDefeated: 59,
        totalEnemiesEscaped: 1,
      },
    ]);
  });

  it("continues ordinary deterministic simulation after encounter completion", () => {
    const completed = stepGame(createFinalWaveStateWithEscapingScout(), NEUTRAL_TICK_FRAME).state;
    const previousScore = completed.score;

    const result = stepGame(completed, NEUTRAL_TICK_FRAME);

    expect(result.state.status).toBe("running");
    expect(result.state.encounter.phase).toBe("complete");
    expect(result.state.tick).toBe(completed.tick + 1);
    expect(result.state.score).toBeGreaterThan(previousScore);
  });

  it("never spawns or consumes RNG after encounter completion", () => {
    const completed = stepGame(createFinalWaveStateWithEscapingScout(), NEUTRAL_TICK_FRAME).state;
    const previousRngState = completed.rngState;

    const result = stepGame(completed, NEUTRAL_TICK_FRAME);

    expect(result.state.rngState).toBe(previousRngState);
    expect(result.state.enemies).toEqual([]);
    expect(
      result.events.some(
        (event) => event.type === "enemy_spawned" || event.type === "wave_started",
      ),
    ).toBe(false);
  });

  it("uses the input-state tick for escape and completion events", () => {
    const state = createFinalWaveStateWithEscapingScout();
    state.tick = 37;

    const result = stepGame(state, NEUTRAL_TICK_FRAME);
    const transitionEvents = result.events.filter(
      (event) =>
        event.type === "enemy_escaped" ||
        event.type === "wave_completed" ||
        event.type === "encounter_completed",
    );

    expect(transitionEvents).toHaveLength(3);
    expect(transitionEvents.every((event) => event.tick === 37)).toBe(true);
  });

  it("does not mutate the previous escape or progression state", () => {
    const state = createFinalWaveStateWithEscapingScout();
    const before = structuredClone(state);

    stepGame(state, NEUTRAL_TICK_FRAME);

    expect(state).toEqual(before);
  });
});

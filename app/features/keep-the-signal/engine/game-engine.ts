import type {
  EnvironmentEvent,
  MovementAxis,
  PowerChannel,
  PowerShiftAction,
  TickFrame,
} from "./actions";
import { ENGINE_CONSTANTS } from "./constants";
import { circlesCollide } from "./collisions";
import {
  advanceEncounterIntermission,
  canSpawnEncounterEnemy,
  completeEncounterWaveIfEligible,
  decrementEncounterSpawnCooldown,
  spawnEncounterEnemy,
  validateEncounterState,
} from "./encounters";
import type { EngineEvent } from "./events";
import {
  canEnemyFire,
  createEnemyProjectileState,
  decrementEnemyFireCooldowns,
  integrateEnemyMovement,
  integrateEnemyProjectile,
  type EnemyProjectileState,
} from "./enemies";
import type { GameState, ProjectileState } from "./game-state";
import { calculateTickScore } from "./scoring";

const MAX_UINT32 = 0xffffffff;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const CONTINUOUS_INTERFERENCE_SOURCE_ID = "continuous_interference";

interface NormalizedPlayerInput {
  readonly moveX: MovementAxis;
  readonly moveY: MovementAxis;
  readonly fire: boolean;
  readonly recoveryPulse: boolean;
  readonly powerShift?: PowerShiftAction;
}

interface NormalizedTickFrame {
  readonly player: NormalizedPlayerInput;
  readonly environmentEvents: readonly unknown[];
}

interface DamageFlags {
  defenceDamaged: boolean;
  signalDamaged: boolean;
}

export class EngineInvariantError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EngineInvariantError";
    this.code = code;
  }
}

export interface ValidationResult {
  readonly valid: true;
}

export interface StepResult {
  readonly state: GameState;
  readonly events: EngineEvent[];
}

export function stepGame(
  previousState: Readonly<GameState>,
  frame: Readonly<TickFrame>,
): StepResult {
  validateGameState(previousState);

  if (previousState.status === "terminal") {
    return {
      state: structuredClone(previousState) as GameState,
      events: [],
    };
  }

  const state = structuredClone(previousState) as GameState;
  const events: EngineEvent[] = [];
  const eventTick = previousState.tick;
  const normalizedFrame = normalizeTickFrame(frame, eventTick, events);

  decrementCooldowns(state);
  state.encounter = decrementEncounterSpawnCooldown(state.encounter);
  state.enemies = decrementEnemyFireCooldowns(state.enemies);

  processPowerShift(state, normalizedFrame.player.powerShift, eventTick, events);
  processRecoveryPulse(state, normalizedFrame.player.recoveryPulse, eventTick, events);
  processFiring(state, normalizedFrame.player.fire, eventTick, events);
  applyMovementInput(state, normalizedFrame.player);

  const damageFlags: DamageFlags = {
    defenceDamaged: false,
    signalDamaged: false,
  };

  processEnvironmentEvents(
    state,
    normalizedFrame.environmentEvents,
    eventTick,
    events,
    damageFlags,
  );

  integratePlayerPosition(state);
  updateEncounterPhaseAndSpawnEligibleEnemy(state, eventTick, events);
  state.enemies = state.enemies.map(integrateEnemyMovement);
  processEnemyFiring(state, eventTick, events);
  integrateProjectiles(state, eventTick, events);
  integrateEnemyProjectiles(state, eventTick, events);
  resolvePlayerProjectileEnemyCollisions(state, eventTick, events);
  resolveEnemyProjectilePlayerCollisions(state, eventTick, events, damageFlags);
  processEnemyEscapes(state, eventTick, events, damageFlags);

  if (applyContinuousInterference(state, eventTick, events)) {
    damageFlags.signalDamaged = true;
  }

  updateDamageTimers(state, damageFlags);
  applyDefenceRecovery(state, eventTick, events);
  applySignalRecovery(state, eventTick, events);
  updateSignalCollapse(state, eventTick, events);
  updateCoherenceAndScore(state, eventTick, events);
  updateWaveCompletionState(state, eventTick, events);

  if (state.tick >= MAX_SAFE_INTEGER) {
    throw new EngineInvariantError(
      "tick_overflow",
      "The authoritative tick cannot exceed Number.MAX_SAFE_INTEGER.",
    );
  }

  state.tick += 1;

  validateGameState(state);

  return {
    state,
    events,
  };
}

export function validateGameState(state: Readonly<GameState>): ValidationResult {
  assertString(state.engineVersion, "engineVersion");
  assertString(state.rulesetVersion, "rulesetVersion");

  assertUnsignedUint32(state.seed, "seed");
  assertUnsignedUint32(state.rngState, "rngState");

  assertNonNegativeInteger(state.tick, "tick");
  assertNonNegativeInteger(state.score, "score");
  assertNonNegativeInteger(state.currentCoherenceTicks, "currentCoherenceTicks");
  assertNonNegativeInteger(state.longestCoherenceTicks, "longestCoherenceTicks");

  if (state.longestCoherenceTicks < state.currentCoherenceTicks) {
    fail(
      "coherence_order",
      "longestCoherenceTicks must be greater than or equal to currentCoherenceTicks.",
    );
  }

  if (state.status !== "running" && state.status !== "terminal") {
    fail("status", 'status must be either "running" or "terminal".');
  }

  if (state.status === "running" && state.terminalReason !== null) {
    fail("running_terminal_reason", "A running state must not have a terminal reason.");
  }

  if (state.status === "terminal" && state.terminalReason !== "signal_collapse") {
    fail("terminal_reason", 'A terminal state must have terminalReason "signal_collapse".');
  }

  validatePlayer(state);
  validatePower(state);
  validateWeapon(state);
  validateRecoveryPulse(state);
  validateDefence(state);
  validateSignal(state);
  validateInterference(state);
  validateProjectiles(state.projectiles, state.weapon.nextProjectileId);
  validateEncounterState(state.encounter, state.enemies, state.enemyProjectiles);

  return { valid: true };
}

export function serializeCanonicalState(state: Readonly<GameState>): string {
  validateGameState(state);

  const orderedProjectiles = [...state.projectiles]
    .sort((left, right) => left.id - right.id)
    .map(canonicalProjectile);

  const orderedEnemies = [...state.enemies]
    .sort((left, right) => left.id - right.id)
    .map(canonicalEnemy);

  const orderedEnemyProjectiles = [...state.enemyProjectiles]
    .sort((left, right) => left.id - right.id)
    .map(canonicalEnemyProjectile);

  return JSON.stringify({
    engineVersion: state.engineVersion,
    rulesetVersion: state.rulesetVersion,
    seed: state.seed,
    rngState: state.rngState,
    tick: state.tick,
    status: state.status,
    terminalReason: state.terminalReason,
    score: state.score,
    currentCoherenceTicks: state.currentCoherenceTicks,
    longestCoherenceTicks: state.longestCoherenceTicks,
    player: {
      positionX: state.player.positionX,
      positionY: state.player.positionY,
      velocityX: state.player.velocityX,
      velocityY: state.player.velocityY,
      radius: state.player.radius,
    },
    power: {
      weapons: state.power.weapons,
      defence: state.power.defence,
      signal: state.power.signal,
      shiftCooldownTicks: state.power.shiftCooldownTicks,
    },
    weapon: {
      fireCooldownTicks: state.weapon.fireCooldownTicks,
      nextProjectileId: state.weapon.nextProjectileId,
    },
    recoveryPulse: {
      cooldownTicks: state.recoveryPulse.cooldownTicks,
    },
    defence: {
      integrity: state.defence.integrity,
      ticksSinceDamage: state.defence.ticksSinceDamage,
      recoveryRemainder: state.defence.recoveryRemainder,
    },
    signal: {
      integrity: state.signal.integrity,
      ticksSinceDamage: state.signal.ticksSinceDamage,
      collapseTicks: state.signal.collapseTicks,
      recoveryRemainder: state.signal.recoveryRemainder,
      interferenceDamageRemainder: state.signal.interferenceDamageRemainder,
    },
    interference: {
      load: state.interference.load,
    },
    projectiles: orderedProjectiles,
    encounter: {
      phase: state.encounter.phase,
      waveNumber: state.encounter.waveNumber,
      phaseTicks: state.encounter.phaseTicks,
      spawnCooldownTicks: state.encounter.spawnCooldownTicks,
      enemiesScheduled: state.encounter.enemiesScheduled,
      enemiesSpawned: state.encounter.enemiesSpawned,
      enemiesDefeated: state.encounter.enemiesDefeated,
      enemiesEscaped: state.encounter.enemiesEscaped,
      totalEnemiesDefeated: state.encounter.totalEnemiesDefeated,
      totalEnemiesEscaped: state.encounter.totalEnemiesEscaped,
      nextEnemyId: state.encounter.nextEnemyId,
      nextEnemyProjectileId: state.encounter.nextEnemyProjectileId,
    },
    enemies: orderedEnemies,
    enemyProjectiles: orderedEnemyProjectiles,
  });
}

export function createStateDigest(state: Readonly<GameState>): string {
  const serialized = serializeCanonicalState(state);
  const bytes = new TextEncoder().encode(serialized);

  let hash = 0x811c9dc5;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function normalizeTickFrame(
  frame: Readonly<TickFrame>,
  tick: number,
  events: EngineEvent[],
): NormalizedTickFrame {
  const rawFrame: unknown = frame;
  const frameRecord = isRecord(rawFrame) ? rawFrame : {};
  const rawPlayer = isRecord(frameRecord.player) ? frameRecord.player : {};

  const moveX: MovementAxis = isMovementAxis(rawPlayer.moveX) ? rawPlayer.moveX : 0;

  const moveY: MovementAxis = isMovementAxis(rawPlayer.moveY) ? rawPlayer.moveY : 0;

  const fire = typeof rawPlayer.fire === "boolean" ? rawPlayer.fire : false;

  const recoveryPulse =
    typeof rawPlayer.recoveryPulse === "boolean" ? rawPlayer.recoveryPulse : false;

  if (!isMovementAxis(rawPlayer.moveX) || !isMovementAxis(rawPlayer.moveY)) {
    events.push({
      type: "action_rejected",
      tick,
      action: "movement",
      reason: "invalid_action",
    });
  }

  if (typeof rawPlayer.fire !== "boolean") {
    events.push({
      type: "action_rejected",
      tick,
      action: "fire",
      reason: "invalid_action",
    });
  }

  if (typeof rawPlayer.recoveryPulse !== "boolean") {
    events.push({
      type: "action_rejected",
      tick,
      action: "recovery_pulse",
      reason: "invalid_action",
    });
  }

  let powerShift: PowerShiftAction | undefined;

  if (rawPlayer.powerShift !== undefined) {
    if (isPowerShiftAction(rawPlayer.powerShift)) {
      powerShift = {
        from: rawPlayer.powerShift.from,
        to: rawPlayer.powerShift.to,
      };
    } else {
      events.push({
        type: "action_rejected",
        tick,
        action: "power_shift",
        reason: "invalid_action",
      });
    }
  }

  let environmentEvents: readonly unknown[] = [];

  if (Array.isArray(frameRecord.environmentEvents)) {
    environmentEvents = frameRecord.environmentEvents;
  } else {
    events.push({
      type: "action_rejected",
      tick,
      action: "environment_event",
      reason: "invalid_environment_event",
    });
  }

  return {
    player: {
      moveX,
      moveY,
      fire,
      recoveryPulse,
      ...(powerShift === undefined ? {} : { powerShift }),
    },
    environmentEvents,
  };
}

function decrementCooldowns(state: GameState): void {
  state.power.shiftCooldownTicks = decrementCooldown(state.power.shiftCooldownTicks);
  state.weapon.fireCooldownTicks = decrementCooldown(state.weapon.fireCooldownTicks);
  state.recoveryPulse.cooldownTicks = decrementCooldown(state.recoveryPulse.cooldownTicks);
}

function decrementCooldown(value: number): number {
  return value > 0 ? value - 1 : 0;
}

function processPowerShift(
  state: GameState,
  powerShift: PowerShiftAction | undefined,
  tick: number,
  events: EngineEvent[],
): void {
  if (powerShift === undefined) {
    return;
  }

  if (powerShift.from === powerShift.to) {
    rejectAction(events, tick, "power_shift", "same_power_channel");
    return;
  }

  if (state.power.shiftCooldownTicks > 0) {
    rejectAction(events, tick, "power_shift", "cooldown_active");
    return;
  }

  const sourceValue = state.power[powerShift.from];
  const destinationValue = state.power[powerShift.to];

  if (sourceValue - ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT < ENGINE_CONSTANTS.MIN_CHANNEL_POWER) {
    rejectAction(events, tick, "power_shift", "power_floor");
    return;
  }

  if (
    destinationValue + ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT >
    ENGINE_CONSTANTS.MAX_CHANNEL_POWER
  ) {
    rejectAction(events, tick, "power_shift", "power_ceiling");
    return;
  }

  state.power[powerShift.from] -= ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT;
  state.power[powerShift.to] += ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT;
  state.power.shiftCooldownTicks = ENGINE_CONSTANTS.POWER_SHIFT_COOLDOWN_TICKS;

  events.push({
    type: "power_shift_applied",
    tick,
    from: powerShift.from,
    to: powerShift.to,
    amount: ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT,
  });
}

function processRecoveryPulse(
  state: GameState,
  requested: boolean,
  tick: number,
  events: EngineEvent[],
): void {
  if (!requested) {
    return;
  }

  if (state.recoveryPulse.cooldownTicks > 0) {
    rejectAction(events, tick, "recovery_pulse", "cooldown_active");
    return;
  }

  const previousSignalIntegrity = state.signal.integrity;
  const signalRestored = Math.min(
    ENGINE_CONSTANTS.RECOVERY_PULSE_SIGNAL_RESTORE,
    ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY - state.signal.integrity,
  );
  const defenceRestored = Math.min(
    ENGINE_CONSTANTS.RECOVERY_PULSE_DEFENCE_RESTORE,
    ENGINE_CONSTANTS.MAX_DEFENCE_INTEGRITY - state.defence.integrity,
  );

  state.signal.integrity += signalRestored;
  state.defence.integrity += defenceRestored;
  state.recoveryPulse.cooldownTicks = ENGINE_CONSTANTS.RECOVERY_PULSE_COOLDOWN_TICKS;

  events.push({
    type: "recovery_pulse_applied",
    tick,
    signalRestored,
    defenceRestored,
  });

  if (previousSignalIntegrity === 0 && state.signal.integrity > 0) {
    state.signal.collapseTicks = 0;

    events.push({
      type: "signal_collapse_averted",
      tick,
    });
  }
}

function processFiring(
  state: GameState,
  requested: boolean,
  tick: number,
  events: EngineEvent[],
): void {
  if (!requested) {
    return;
  }

  if (state.weapon.fireCooldownTicks > 0) {
    rejectAction(events, tick, "fire", "cooldown_active");
    return;
  }

  if (state.projectiles.length >= ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES) {
    rejectAction(events, tick, "fire", "projectile_capacity");
    return;
  }

  const projectileId = state.weapon.nextProjectileId;

  state.weapon.nextProjectileId += 1;
  state.weapon.fireCooldownTicks = calculateWeaponCooldown(state.power.weapons);

  state.projectiles.push({
    id: projectileId,
    positionX: state.player.positionX,
    positionY:
      state.player.positionY - ENGINE_CONSTANTS.PLAYER_RADIUS - ENGINE_CONSTANTS.PROJECTILE_RADIUS,
    velocityX: 0,
    velocityY: -ENGINE_CONSTANTS.PROJECTILE_SPEED_PER_TICK,
    radius: ENGINE_CONSTANTS.PROJECTILE_RADIUS,
    remainingTicks: ENGINE_CONSTANTS.PROJECTILE_LIFETIME_TICKS,
  });

  events.push({
    type: "projectile_fired",
    tick,
    projectileId,
  });
}

function calculateWeaponCooldown(weaponsPower: number): number {
  return Math.max(6, 18 - Math.floor((weaponsPower - 10) / 5));
}

function applyMovementInput(state: GameState, playerInput: NormalizedPlayerInput): void {
  const diagonal = playerInput.moveX !== 0 && playerInput.moveY !== 0;

  const acceleration = diagonal
    ? ENGINE_CONSTANTS.PLAYER_DIAGONAL_ACCELERATION_PER_TICK
    : ENGINE_CONSTANTS.PLAYER_ACCELERATION_PER_TICK;

  state.player.velocityX = updateVelocityAxis(
    state.player.velocityX,
    playerInput.moveX,
    acceleration,
  );

  state.player.velocityY = updateVelocityAxis(
    state.player.velocityY,
    playerInput.moveY,
    acceleration,
  );

  const magnitude = Math.sqrt(
    state.player.velocityX * state.player.velocityX +
      state.player.velocityY * state.player.velocityY,
  );

  if (magnitude > ENGINE_CONSTANTS.PLAYER_MAX_SPEED_PER_TICK) {
    const scale = ENGINE_CONSTANTS.PLAYER_MAX_SPEED_PER_TICK / magnitude;

    state.player.velocityX = Math.trunc(state.player.velocityX * scale);
    state.player.velocityY = Math.trunc(state.player.velocityY * scale);
  }
}

function updateVelocityAxis(
  currentVelocity: number,
  input: MovementAxis,
  acceleration: number,
): number {
  if (input !== 0) {
    return currentVelocity + input * acceleration;
  }

  if (currentVelocity > 0) {
    return Math.max(0, currentVelocity - ENGINE_CONSTANTS.PLAYER_DRAG_PER_TICK);
  }

  if (currentVelocity < 0) {
    return Math.min(0, currentVelocity + ENGINE_CONSTANTS.PLAYER_DRAG_PER_TICK);
  }

  return 0;
}

function processEnvironmentEvents(
  state: GameState,
  rawEvents: readonly unknown[],
  tick: number,
  events: EngineEvent[],
  damageFlags: DamageFlags,
): void {
  const validEvents: EnvironmentEvent[] = [];

  for (const rawEvent of rawEvents) {
    const parsed = parseEnvironmentEvent(rawEvent);

    if (parsed === null) {
      rejectAction(
        events,
        tick,
        "environment_event",
        "invalid_environment_event",
        readPossibleSourceId(rawEvent),
      );
      continue;
    }

    validEvents.push(parsed);
  }

  validEvents.sort(compareEnvironmentEvents);

  const idCounts = new Map<string, number>();

  for (const event of validEvents) {
    idCounts.set(event.id, (idCounts.get(event.id) ?? 0) + 1);
  }

  for (const event of validEvents) {
    if ((idCounts.get(event.id) ?? 0) > 1) {
      rejectAction(events, tick, "environment_event", "duplicate_environment_event_id", event.id);
      continue;
    }

    if (event.type === "set_interference_load") {
      const previousLoad = state.interference.load;
      state.interference.load = event.load;

      events.push({
        type: "interference_load_changed",
        tick,
        sourceId: event.id,
        previousLoad,
        nextLoad: event.load,
      });

      continue;
    }

    if (event.type === "impact") {
      if (applyDefenceDamage(state, event.rawDamage, event.id, tick, events)) {
        damageFlags.defenceDamaged = true;
      }

      continue;
    }

    if (applyDirectSignalDamage(state, event.rawDamage, event.id, tick, events)) {
      damageFlags.signalDamaged = true;
    }
  }
}

function integratePlayerPosition(state: GameState): void {
  const minimum = ENGINE_CONSTANTS.WORLD_MIN + state.player.radius;
  const maximum = ENGINE_CONSTANTS.WORLD_MAX - state.player.radius;

  state.player.positionX += state.player.velocityX;
  state.player.positionY += state.player.velocityY;

  if (state.player.positionX < minimum) {
    state.player.positionX = minimum;

    if (state.player.velocityX < 0) {
      state.player.velocityX = 0;
    }
  } else if (state.player.positionX > maximum) {
    state.player.positionX = maximum;

    if (state.player.velocityX > 0) {
      state.player.velocityX = 0;
    }
  }

  if (state.player.positionY < minimum) {
    state.player.positionY = minimum;

    if (state.player.velocityY < 0) {
      state.player.velocityY = 0;
    }
  } else if (state.player.positionY > maximum) {
    state.player.positionY = maximum;

    if (state.player.velocityY > 0) {
      state.player.velocityY = 0;
    }
  }
}

function updateEncounterPhaseAndSpawnEligibleEnemy(
  state: GameState,
  tick: number,
  events: EngineEvent[],
): void {
  const phaseResult = advanceEncounterIntermission(state.encounter);

  state.encounter = phaseResult.encounter;

  if (phaseResult.waveStarted !== null) {
    events.push({
      type: "wave_started",
      tick,
      waveNumber: phaseResult.waveStarted,
      enemiesScheduled: state.encounter.enemiesScheduled,
    });
  }

  if (!canSpawnEncounterEnemy(state.encounter)) {
    return;
  }

  const result = spawnEncounterEnemy(state.encounter, state.rngState);

  state.encounter = result.encounter;
  state.rngState = result.nextRngState;
  state.enemies.push(result.enemy);

  events.push({
    type: "enemy_spawned",
    tick,
    enemyId: result.enemy.id,
    archetype: result.enemy.archetype,
    waveNumber: state.encounter.waveNumber,
    positionX: result.enemy.positionX,
    positionY: result.enemy.positionY,
    archetypeRoll: result.archetypeRoll,
    spawnXRoll: result.spawnXRoll,
  });
}

function processEnemyFiring(state: GameState, tick: number, events: EngineEvent[]): void {
  for (const enemy of state.enemies) {
    if (!canEnemyFire(enemy)) {
      continue;
    }

    if (state.enemyProjectiles.length >= ENGINE_CONSTANTS.MAX_ACTIVE_ENEMY_PROJECTILES) {
      enemy.fireCooldownTicks = enemy.fireIntervalTicks;

      events.push({
        type: "enemy_fire_rejected",
        tick,
        enemyId: enemy.id,
        reason: "projectile_capacity",
      });

      continue;
    }

    const projectile = createEnemyProjectileState(state.encounter.nextEnemyProjectileId, enemy);

    state.encounter.nextEnemyProjectileId += 1;
    state.enemyProjectiles.push(projectile);
    enemy.fireCooldownTicks = enemy.fireIntervalTicks;

    events.push({
      type: "enemy_fired",
      tick,
      enemyId: enemy.id,
      projectileId: projectile.id,
      projectileKind: projectile.kind,
      positionX: projectile.positionX,
      positionY: projectile.positionY,
      rawDamage: projectile.rawDamage,
    });
  }
}

function integrateEnemyProjectiles(state: GameState, tick: number, events: EngineEvent[]): void {
  const activeProjectiles: EnemyProjectileState[] = [];

  for (const projectile of state.enemyProjectiles) {
    const result = integrateEnemyProjectile(projectile);

    if (result.expiryReason !== null) {
      events.push({
        type: "enemy_projectile_expired",
        tick,
        projectileId: result.projectile.id,
        ownerEnemyId: result.projectile.ownerEnemyId,
        reason: result.expiryReason,
      });

      continue;
    }

    activeProjectiles.push(result.projectile);
  }

  state.enemyProjectiles = activeProjectiles;
}

function resolvePlayerProjectileEnemyCollisions(
  state: GameState,
  tick: number,
  events: EngineEvent[],
): void {
  const remainingProjectiles: ProjectileState[] = [];

  for (const projectile of state.projectiles) {
    const enemyIndex = state.enemies.findIndex((enemy) => circlesCollide(projectile, enemy));

    if (enemyIndex < 0) {
      remainingProjectiles.push(projectile);
      continue;
    }

    const enemy = state.enemies[enemyIndex];
    const previousIntegrity = enemy.integrity;
    const effectiveDamage = Math.min(previousIntegrity, ENGINE_CONSTANTS.PLAYER_PROJECTILE_DAMAGE);
    const nextIntegrity = previousIntegrity - effectiveDamage;

    events.push({
      type: "player_projectile_hit_enemy",
      tick,
      projectileId: projectile.id,
      enemyId: enemy.id,
      rawDamage: ENGINE_CONSTANTS.PLAYER_PROJECTILE_DAMAGE,
      effectiveDamage,
    });

    events.push({
      type: "enemy_damaged",
      tick,
      enemyId: enemy.id,
      projectileId: projectile.id,
      previousIntegrity,
      nextIntegrity,
      rawDamage: ENGINE_CONSTANTS.PLAYER_PROJECTILE_DAMAGE,
      effectiveDamage,
    });

    if (nextIntegrity > 0) {
      enemy.integrity = nextIntegrity;
      continue;
    }

    state.enemies.splice(enemyIndex, 1);
    state.encounter.enemiesDefeated += 1;
    state.encounter.totalEnemiesDefeated += 1;
    state.score += enemy.destructionScore;

    events.push({
      type: "enemy_destroyed",
      tick,
      enemyId: enemy.id,
      archetype: enemy.archetype,
      projectileId: projectile.id,
    });

    events.push({
      type: "enemy_score_awarded",
      tick,
      enemyId: enemy.id,
      amount: enemy.destructionScore,
      scoreAfter: state.score,
    });
  }

  state.projectiles = remainingProjectiles;
}

function resolveEnemyProjectilePlayerCollisions(
  state: GameState,
  tick: number,
  events: EngineEvent[],
  damageFlags: DamageFlags,
): void {
  const remainingProjectiles: EnemyProjectileState[] = [];

  for (const projectile of state.enemyProjectiles) {
    if (!circlesCollide(projectile, state.player)) {
      remainingProjectiles.push(projectile);
      continue;
    }

    const target = projectile.kind === "kinetic" ? "defence" : "signal";

    events.push({
      type: "enemy_projectile_hit_player",
      tick,
      projectileId: projectile.id,
      ownerEnemyId: projectile.ownerEnemyId,
      projectileKind: projectile.kind,
      target,
      rawDamage: projectile.rawDamage,
    });

    const sourceId = `enemy_projectile:${projectile.id}`;

    if (projectile.kind === "kinetic") {
      if (applyDefenceDamage(state, projectile.rawDamage, sourceId, tick, events)) {
        damageFlags.defenceDamaged = true;
      }

      continue;
    }

    if (applyDirectSignalDamage(state, projectile.rawDamage, sourceId, tick, events)) {
      damageFlags.signalDamaged = true;
    }
  }

  state.enemyProjectiles = remainingProjectiles;
}

function processEnemyEscapes(
  state: GameState,
  tick: number,
  events: EngineEvent[],
  damageFlags: DamageFlags,
): void {
  const remainingEnemies = [];

  for (const enemy of state.enemies) {
    if (enemy.positionY - enemy.radius <= ENGINE_CONSTANTS.WORLD_MAX) {
      remainingEnemies.push(enemy);
      continue;
    }

    state.encounter.enemiesEscaped += 1;
    state.encounter.totalEnemiesEscaped += 1;

    events.push({
      type: "enemy_escaped",
      tick,
      enemyId: enemy.id,
      archetype: enemy.archetype,
      positionY: enemy.positionY,
      defenceRawDamage: enemy.escapeDefenceDamage,
      signalRawDamage: enemy.escapeSignalDamage,
    });

    const sourcePrefix = `enemy_escape:${enemy.id}`;

    if (
      enemy.escapeDefenceDamage > 0 &&
      applyDefenceDamage(state, enemy.escapeDefenceDamage, `${sourcePrefix}:defence`, tick, events)
    ) {
      damageFlags.defenceDamaged = true;
    }

    if (
      enemy.escapeSignalDamage > 0 &&
      applyDirectSignalDamage(
        state,
        enemy.escapeSignalDamage,
        `${sourcePrefix}:signal`,
        tick,
        events,
      )
    ) {
      damageFlags.signalDamaged = true;
    }
  }

  state.enemies = remainingEnemies;
}

function updateWaveCompletionState(state: GameState, tick: number, events: EngineEvent[]): void {
  const result = completeEncounterWaveIfEligible(
    state.encounter,
    state.enemies,
    state.enemyProjectiles,
  );

  if (result.waveCompleted === null) {
    return;
  }

  state.encounter = result.encounter;

  events.push({
    type: "wave_completed",
    tick,
    waveNumber: result.waveCompleted,
    enemiesDefeated: state.encounter.enemiesDefeated,
    enemiesEscaped: state.encounter.enemiesEscaped,
    totalEnemiesDefeated: state.encounter.totalEnemiesDefeated,
    totalEnemiesEscaped: state.encounter.totalEnemiesEscaped,
  });

  if (result.encounterCompleted) {
    events.push({
      type: "encounter_completed",
      tick,
      totalEnemiesDefeated: state.encounter.totalEnemiesDefeated,
      totalEnemiesEscaped: state.encounter.totalEnemiesEscaped,
    });
  }
}

function integrateProjectiles(state: GameState, tick: number, events: EngineEvent[]): void {
  const activeProjectiles: ProjectileState[] = [];

  for (const projectile of state.projectiles) {
    const movedProjectile: ProjectileState = {
      ...projectile,
      positionX: projectile.positionX + projectile.velocityX,
      positionY: projectile.positionY + projectile.velocityY,
      remainingTicks: projectile.remainingTicks - 1,
    };

    if (movedProjectile.remainingTicks <= 0) {
      events.push({
        type: "projectile_expired",
        tick,
        projectileId: movedProjectile.id,
        reason: "lifetime",
      });

      continue;
    }

    if (projectileIsOutsideWorld(movedProjectile)) {
      events.push({
        type: "projectile_expired",
        tick,
        projectileId: movedProjectile.id,
        reason: "world_boundary",
      });

      continue;
    }

    activeProjectiles.push(movedProjectile);
  }

  state.projectiles = activeProjectiles;
}

function projectileIsOutsideWorld(projectile: Readonly<ProjectileState>): boolean {
  return (
    projectile.positionX + projectile.radius < ENGINE_CONSTANTS.WORLD_MIN ||
    projectile.positionX - projectile.radius > ENGINE_CONSTANTS.WORLD_MAX ||
    projectile.positionY + projectile.radius < ENGINE_CONSTANTS.WORLD_MIN ||
    projectile.positionY - projectile.radius > ENGINE_CONSTANTS.WORLD_MAX
  );
}

function applyDefenceDamage(
  state: GameState,
  rawDamage: number,
  sourceId: string,
  tick: number,
  events: EngineEvent[],
): boolean {
  const mitigation = Math.min(45, Math.floor(((state.power.defence - 10) * 3) / 4));

  const calculatedDamage = Math.ceil((rawDamage * (100 - mitigation)) / 100);
  const effectiveDamage = Math.min(state.defence.integrity, calculatedDamage);

  if (effectiveDamage <= 0) {
    return false;
  }

  state.defence.integrity -= effectiveDamage;
  state.defence.recoveryRemainder = 0;

  events.push({
    type: "defence_damaged",
    tick,
    sourceId,
    rawDamage,
    effectiveDamage,
  });

  return true;
}

function applyDirectSignalDamage(
  state: GameState,
  rawDamage: number,
  sourceId: string,
  tick: number,
  events: EngineEvent[],
): boolean {
  const resistance = Math.min(40, Math.floor(((state.power.signal - 10) * 2) / 3));

  const calculatedDamage = Math.ceil((rawDamage * (100 - resistance)) / 100);
  const effectiveDamage = Math.min(state.signal.integrity, calculatedDamage);

  if (effectiveDamage <= 0) {
    return false;
  }

  state.signal.integrity -= effectiveDamage;
  state.signal.recoveryRemainder = 0;

  events.push({
    type: "signal_damaged",
    tick,
    sourceId,
    source: "corruption",
    rawDamage,
    effectiveDamage,
  });

  return true;
}

function applyContinuousInterference(
  state: GameState,
  tick: number,
  events: EngineEvent[],
): boolean {
  const ratePerSecond = Math.max(0, state.interference.load - state.power.signal) * 8;

  if (ratePerSecond === 0) {
    state.signal.interferenceDamageRemainder = 0;
    return false;
  }

  const accumulated = state.signal.interferenceDamageRemainder + ratePerSecond;

  const calculatedDamage = Math.floor(accumulated / ENGINE_CONSTANTS.TICKS_PER_SECOND);

  state.signal.interferenceDamageRemainder = accumulated % ENGINE_CONSTANTS.TICKS_PER_SECOND;

  const effectiveDamage = Math.min(state.signal.integrity, calculatedDamage);

  if (effectiveDamage <= 0) {
    return false;
  }

  state.signal.integrity -= effectiveDamage;
  state.signal.recoveryRemainder = 0;

  events.push({
    type: "signal_damaged",
    tick,
    sourceId: CONTINUOUS_INTERFERENCE_SOURCE_ID,
    source: "interference",
    rawDamage: calculatedDamage,
    effectiveDamage,
  });

  return true;
}

function updateDamageTimers(state: GameState, damageFlags: Readonly<DamageFlags>): void {
  state.defence.ticksSinceDamage = damageFlags.defenceDamaged
    ? 0
    : incrementSafeInteger(state.defence.ticksSinceDamage);

  state.signal.ticksSinceDamage = damageFlags.signalDamaged
    ? 0
    : incrementSafeInteger(state.signal.ticksSinceDamage);
}

function incrementSafeInteger(value: number): number {
  return value >= MAX_SAFE_INTEGER ? MAX_SAFE_INTEGER : value + 1;
}

function applyDefenceRecovery(state: GameState, tick: number, events: EngineEvent[]): void {
  if (state.defence.integrity >= ENGINE_CONSTANTS.MAX_DEFENCE_INTEGRITY) {
    state.defence.recoveryRemainder = 0;
    return;
  }

  if (state.defence.ticksSinceDamage < ENGINE_CONSTANTS.DEFENCE_RECOVERY_DELAY_TICKS) {
    return;
  }

  const ratePerSecond = 20 + (state.power.defence - 10) * 3;
  const accumulated = state.defence.recoveryRemainder + ratePerSecond;

  const calculatedRecovery = Math.floor(accumulated / ENGINE_CONSTANTS.TICKS_PER_SECOND);

  state.defence.recoveryRemainder = accumulated % ENGINE_CONSTANTS.TICKS_PER_SECOND;

  const amount = Math.min(
    calculatedRecovery,
    ENGINE_CONSTANTS.MAX_DEFENCE_INTEGRITY - state.defence.integrity,
  );

  if (amount <= 0) {
    return;
  }

  state.defence.integrity += amount;

  if (state.defence.integrity === ENGINE_CONSTANTS.MAX_DEFENCE_INTEGRITY) {
    state.defence.recoveryRemainder = 0;
  }

  events.push({
    type: "defence_recovered",
    tick,
    amount,
  });
}

function applySignalRecovery(state: GameState, tick: number, events: EngineEvent[]): void {
  if (state.signal.integrity <= 0) {
    state.signal.recoveryRemainder = 0;
    return;
  }

  if (state.signal.integrity >= ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY) {
    state.signal.recoveryRemainder = 0;
    return;
  }

  if (
    state.signal.ticksSinceDamage < ENGINE_CONSTANTS.SIGNAL_RECOVERY_DELAY_TICKS ||
    state.interference.load > state.power.signal
  ) {
    return;
  }

  const ratePerSecond = 30 + (state.power.signal - 10) * 4;
  const accumulated = state.signal.recoveryRemainder + ratePerSecond;

  const calculatedRecovery = Math.floor(accumulated / ENGINE_CONSTANTS.TICKS_PER_SECOND);

  state.signal.recoveryRemainder = accumulated % ENGINE_CONSTANTS.TICKS_PER_SECOND;

  const amount = Math.min(
    calculatedRecovery,
    ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY - state.signal.integrity,
  );

  if (amount <= 0) {
    return;
  }

  state.signal.integrity += amount;

  if (state.signal.integrity === ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY) {
    state.signal.recoveryRemainder = 0;
  }

  events.push({
    type: "signal_recovered",
    tick,
    amount,
  });
}

function updateSignalCollapse(state: GameState, tick: number, events: EngineEvent[]): void {
  if (state.signal.integrity > 0) {
    if (state.signal.collapseTicks > 0) {
      state.signal.collapseTicks = 0;

      events.push({
        type: "signal_collapse_averted",
        tick,
      });
    }

    return;
  }

  const collapseWasInactive = state.signal.collapseTicks === 0;

  state.signal.collapseTicks = Math.min(
    ENGINE_CONSTANTS.SIGNAL_COLLAPSE_GRACE_TICKS,
    state.signal.collapseTicks + 1,
  );

  if (collapseWasInactive) {
    events.push({
      type: "signal_collapse_started",
      tick,
    });
  }

  if (state.signal.collapseTicks === ENGINE_CONSTANTS.SIGNAL_COLLAPSE_GRACE_TICKS) {
    state.status = "terminal";
    state.terminalReason = "signal_collapse";

    events.push({
      type: "game_terminated",
      tick,
      reason: "signal_collapse",
    });
  }
}

function updateCoherenceAndScore(state: GameState, tick: number, events: EngineEvent[]): void {
  if (state.signal.integrity <= 0) {
    state.currentCoherenceTicks = 0;
    return;
  }

  state.currentCoherenceTicks += 1;

  state.longestCoherenceTicks = Math.max(state.longestCoherenceTicks, state.currentCoherenceTicks);

  const scoreResult = calculateTickScore(state.signal.integrity, state.currentCoherenceTicks);

  state.score += scoreResult.amount;

  events.push({
    type: "score_added",
    tick,
    amount: scoreResult.amount,
    integrityTier: scoreResult.integrityTier,
    coherenceMultiplier: scoreResult.coherenceMultiplier,
  });
}

function parseEnvironmentEvent(value: unknown): EnvironmentEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    !Number.isSafeInteger(value.sequence) ||
    (value.sequence as number) < 0
  ) {
    return null;
  }

  if (value.type === "set_interference_load") {
    if (
      !Number.isSafeInteger(value.load) ||
      (value.load as number) < 0 ||
      (value.load as number) > 100
    ) {
      return null;
    }

    return {
      id: value.id,
      sequence: value.sequence as number,
      type: "set_interference_load",
      load: value.load as number,
    };
  }

  if (value.type === "impact" || value.type === "signal_corruption") {
    if (
      !Number.isSafeInteger(value.rawDamage) ||
      (value.rawDamage as number) < 1 ||
      (value.rawDamage as number) > 10_000
    ) {
      return null;
    }

    return {
      id: value.id,
      sequence: value.sequence as number,
      type: value.type,
      rawDamage: value.rawDamage as number,
    };
  }

  return null;
}

function compareEnvironmentEvents(left: EnvironmentEvent, right: EnvironmentEvent): number {
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  if (left.id < right.id) {
    return -1;
  }

  if (left.id > right.id) {
    return 1;
  }

  return 0;
}

function rejectAction(
  events: EngineEvent[],
  tick: number,
  action: "movement" | "power_shift" | "fire" | "recovery_pulse" | "environment_event",
  reason:
    | "cooldown_active"
    | "power_floor"
    | "power_ceiling"
    | "same_power_channel"
    | "projectile_capacity"
    | "invalid_environment_event"
    | "duplicate_environment_event_id"
    | "invalid_action",
  sourceId?: string,
): void {
  events.push({
    type: "action_rejected",
    tick,
    action,
    reason,
    ...(sourceId === undefined ? {} : { sourceId }),
  });
}

function readPossibleSourceId(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined;
  }

  return value.id;
}

function isMovementAxis(value: unknown): value is MovementAxis {
  return value === -1 || value === 0 || value === 1;
}

function isPowerChannel(value: unknown): value is PowerChannel {
  return value === "weapons" || value === "defence" || value === "signal";
}

function isPowerShiftAction(value: unknown): value is PowerShiftAction {
  return isRecord(value) && isPowerChannel(value.from) && isPowerChannel(value.to);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validatePlayer(state: Readonly<GameState>): void {
  const { player } = state;

  assertInteger(player.positionX, "player.positionX");
  assertInteger(player.positionY, "player.positionY");
  assertInteger(player.velocityX, "player.velocityX");
  assertInteger(player.velocityY, "player.velocityY");
  assertPositiveInteger(player.radius, "player.radius");

  const minimum = ENGINE_CONSTANTS.WORLD_MIN + player.radius;
  const maximum = ENGINE_CONSTANTS.WORLD_MAX - player.radius;

  assertRange(player.positionX, minimum, maximum, "player.positionX");
  assertRange(player.positionY, minimum, maximum, "player.positionY");
}

function validatePower(state: Readonly<GameState>): void {
  const { power } = state;

  assertRange(
    power.weapons,
    ENGINE_CONSTANTS.MIN_CHANNEL_POWER,
    ENGINE_CONSTANTS.MAX_CHANNEL_POWER,
    "power.weapons",
  );

  assertRange(
    power.defence,
    ENGINE_CONSTANTS.MIN_CHANNEL_POWER,
    ENGINE_CONSTANTS.MAX_CHANNEL_POWER,
    "power.defence",
  );

  assertRange(
    power.signal,
    ENGINE_CONSTANTS.MIN_CHANNEL_POWER,
    ENGINE_CONSTANTS.MAX_CHANNEL_POWER,
    "power.signal",
  );

  if (power.weapons + power.defence + power.signal !== ENGINE_CONSTANTS.TOTAL_POWER) {
    fail("power_total", `Power must total ${ENGINE_CONSTANTS.TOTAL_POWER}.`);
  }

  assertNonNegativeInteger(power.shiftCooldownTicks, "power.shiftCooldownTicks");
}

function validateWeapon(state: Readonly<GameState>): void {
  assertNonNegativeInteger(state.weapon.fireCooldownTicks, "weapon.fireCooldownTicks");

  assertPositiveInteger(state.weapon.nextProjectileId, "weapon.nextProjectileId");
}

function validateRecoveryPulse(state: Readonly<GameState>): void {
  assertNonNegativeInteger(state.recoveryPulse.cooldownTicks, "recoveryPulse.cooldownTicks");
}

function validateDefence(state: Readonly<GameState>): void {
  assertRange(
    state.defence.integrity,
    0,
    ENGINE_CONSTANTS.MAX_DEFENCE_INTEGRITY,
    "defence.integrity",
  );

  assertNonNegativeInteger(state.defence.ticksSinceDamage, "defence.ticksSinceDamage");

  assertRange(
    state.defence.recoveryRemainder,
    0,
    ENGINE_CONSTANTS.TICKS_PER_SECOND - 1,
    "defence.recoveryRemainder",
  );
}

function validateSignal(state: Readonly<GameState>): void {
  assertRange(state.signal.integrity, 0, ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY, "signal.integrity");

  assertNonNegativeInteger(state.signal.ticksSinceDamage, "signal.ticksSinceDamage");

  assertRange(
    state.signal.collapseTicks,
    0,
    ENGINE_CONSTANTS.SIGNAL_COLLAPSE_GRACE_TICKS,
    "signal.collapseTicks",
  );

  assertRange(
    state.signal.recoveryRemainder,
    0,
    ENGINE_CONSTANTS.TICKS_PER_SECOND - 1,
    "signal.recoveryRemainder",
  );

  assertRange(
    state.signal.interferenceDamageRemainder,
    0,
    ENGINE_CONSTANTS.TICKS_PER_SECOND - 1,
    "signal.interferenceDamageRemainder",
  );

  if (state.signal.integrity > 0 && state.signal.collapseTicks !== 0) {
    fail(
      "collapse_with_signal",
      "collapseTicks must be zero while Signal integrity is above zero.",
    );
  }

  if (state.status === "terminal") {
    if (state.signal.integrity !== 0) {
      fail("terminal_signal", "A terminal state must have zero Signal integrity.");
    }

    if (state.signal.collapseTicks !== ENGINE_CONSTANTS.SIGNAL_COLLAPSE_GRACE_TICKS) {
      fail("terminal_collapse_ticks", "A terminal state must be at the collapse grace boundary.");
    }
  }
}

function validateInterference(state: Readonly<GameState>): void {
  assertRange(state.interference.load, 0, 100, "interference.load");
}

function validateProjectiles(
  projectiles: readonly ProjectileState[],
  nextProjectileId: number,
): void {
  if (projectiles.length > ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES) {
    fail(
      "projectile_capacity",
      `Projectile count must not exceed ${ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES}.`,
    );
  }

  let previousId = 0;

  for (const projectile of projectiles) {
    assertPositiveInteger(projectile.id, "projectile.id");

    if (projectile.id <= previousId) {
      fail("projectile_order", "Projectile IDs must be unique and ordered in ascending order.");
    }

    if (projectile.id >= nextProjectileId) {
      fail("projectile_next_id", "Every active projectile ID must be lower than nextProjectileId.");
    }

    assertInteger(projectile.positionX, "projectile.positionX");
    assertInteger(projectile.positionY, "projectile.positionY");
    assertInteger(projectile.velocityX, "projectile.velocityX");
    assertInteger(projectile.velocityY, "projectile.velocityY");
    assertPositiveInteger(projectile.radius, "projectile.radius");
    assertPositiveInteger(projectile.remainingTicks, "projectile.remainingTicks");

    previousId = projectile.id;
  }
}

function canonicalProjectile(projectile: Readonly<ProjectileState>): Record<string, number> {
  return {
    id: projectile.id,
    positionX: projectile.positionX,
    positionY: projectile.positionY,
    velocityX: projectile.velocityX,
    velocityY: projectile.velocityY,
    radius: projectile.radius,
    remainingTicks: projectile.remainingTicks,
  };
}

function canonicalEnemy(enemy: Readonly<GameState["enemies"][number]>): Record<string, unknown> {
  return {
    id: enemy.id,
    archetype: enemy.archetype,
    positionX: enemy.positionX,
    positionY: enemy.positionY,
    velocityX: enemy.velocityX,
    velocityY: enemy.velocityY,
    radius: enemy.radius,
    integrity: enemy.integrity,
    maximumIntegrity: enemy.maximumIntegrity,
    fireCooldownTicks: enemy.fireCooldownTicks,
    fireIntervalTicks: enemy.fireIntervalTicks,
    destructionScore: enemy.destructionScore,
    escapeDefenceDamage: enemy.escapeDefenceDamage,
    escapeSignalDamage: enemy.escapeSignalDamage,
  };
}

function canonicalEnemyProjectile(
  projectile: Readonly<GameState["enemyProjectiles"][number]>,
): Record<string, unknown> {
  return {
    id: projectile.id,
    ownerEnemyId: projectile.ownerEnemyId,
    kind: projectile.kind,
    positionX: projectile.positionX,
    positionY: projectile.positionY,
    velocityX: projectile.velocityX,
    velocityY: projectile.velocityY,
    radius: projectile.radius,
    rawDamage: projectile.rawDamage,
    remainingTicks: projectile.remainingTicks,
  };
}

function assertString(value: unknown, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    fail("string", `${label} must be a non-empty string.`);
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    fail("integer", `${label} must be a safe integer.`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  assertInteger(value, label);

  if (value <= 0) {
    fail("positive_integer", `${label} must be greater than zero.`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  assertInteger(value, label);

  if (value < 0) {
    fail("non_negative_integer", `${label} must not be negative.`);
  }
}

function assertUnsignedUint32(value: number, label: string): void {
  assertRange(value, 0, MAX_UINT32, label);
}

function assertRange(value: number, minimum: number, maximum: number, label: string): void {
  assertInteger(value, label);

  if (value < minimum || value > maximum) {
    fail("range", `${label} must be between ${minimum} and ${maximum}.`);
  }
}

function fail(code: string, message: string): never {
  throw new EngineInvariantError(code, message);
}

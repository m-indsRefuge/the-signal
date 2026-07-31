import { ENGINE_CONSTANTS } from "./constants";
import { createInitialEncounterState, type EncounterState } from "./encounters";
import type { EnemyProjectileState, EnemyState } from "./enemies";
import { normalizeSeed } from "./seeded-random";

export type GameStatus = "running" | "terminal";

export type TerminalReason = "signal_collapse" | null;

export interface ProjectileState {
  id: number;
  positionX: number;
  positionY: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  remainingTicks: number;
}

export interface GameState {
  engineVersion: string;
  rulesetVersion: string;
  seed: number;
  rngState: number;

  tick: number;
  status: GameStatus;
  terminalReason: TerminalReason;

  score: number;
  currentCoherenceTicks: number;
  longestCoherenceTicks: number;

  player: {
    positionX: number;
    positionY: number;
    velocityX: number;
    velocityY: number;
    radius: number;
  };

  power: {
    weapons: number;
    defence: number;
    signal: number;
    shiftCooldownTicks: number;
  };

  weapon: {
    fireCooldownTicks: number;
    nextProjectileId: number;
  };

  recoveryPulse: {
    cooldownTicks: number;
  };

  defence: {
    integrity: number;
    ticksSinceDamage: number;
    recoveryRemainder: number;
  };

  signal: {
    integrity: number;
    ticksSinceDamage: number;
    collapseTicks: number;
    recoveryRemainder: number;
    interferenceDamageRemainder: number;
  };

  interference: {
    load: number;
  };

  projectiles: ProjectileState[];

  encounter: EncounterState;
  enemies: EnemyState[];
  enemyProjectiles: EnemyProjectileState[];
}

export interface CreateInitialGameStateOptions {
  readonly seed: number;
}

export function createInitialGameState(options: CreateInitialGameStateOptions): GameState {
  const seed = normalizeSeed(options.seed);

  return {
    engineVersion: ENGINE_CONSTANTS.ENGINE_VERSION,
    rulesetVersion: ENGINE_CONSTANTS.RULESET_VERSION,
    seed,
    rngState: seed,

    tick: 0,
    status: "running",
    terminalReason: null,

    score: 0,
    currentCoherenceTicks: 0,
    longestCoherenceTicks: 0,

    player: {
      positionX: ENGINE_CONSTANTS.PLAYER_START_X,
      positionY: ENGINE_CONSTANTS.PLAYER_START_Y,
      velocityX: 0,
      velocityY: 0,
      radius: ENGINE_CONSTANTS.PLAYER_RADIUS,
    },

    power: {
      weapons: ENGINE_CONSTANTS.INITIAL_WEAPONS_POWER,
      defence: ENGINE_CONSTANTS.INITIAL_DEFENCE_POWER,
      signal: ENGINE_CONSTANTS.INITIAL_SIGNAL_POWER,
      shiftCooldownTicks: 0,
    },

    weapon: {
      fireCooldownTicks: 0,
      nextProjectileId: 1,
    },

    recoveryPulse: {
      cooldownTicks: 0,
    },

    defence: {
      integrity: ENGINE_CONSTANTS.MAX_DEFENCE_INTEGRITY,
      ticksSinceDamage: 0,
      recoveryRemainder: 0,
    },

    signal: {
      integrity: ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY,
      ticksSinceDamage: 0,
      collapseTicks: 0,
      recoveryRemainder: 0,
      interferenceDamageRemainder: 0,
    },

    interference: {
      load: 0,
    },

    projectiles: [],

    encounter: createInitialEncounterState(),
    enemies: [],
    enemyProjectiles: [],
  };
}

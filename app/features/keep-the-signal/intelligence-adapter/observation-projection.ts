import {
  ENGINE_CONSTANTS,
  createStateDigest,
  validateGameState,
  type EnemyArchetype,
  type EnemyProjectileKind,
  type EngineEvent,
  type GameState,
} from "../engine";
import { projectKtsActionSpace } from "./action-space";
import {
  KtsObservationAdapterError,
  createKtsObservationFailure,
  type KtsObservationProjectionResult,
} from "./observation-failures";
import { projectKtsEventWindow } from "./event-window";
import {
  KTS_OBSERVATION_ADAPTER_ID,
  KTS_OBSERVATION_ADAPTER_VERSION,
  KTS_OBSERVATION_SCHEMA_ID,
  KTS_OBSERVATION_SCHEMA_VERSION,
  canonicalSerializeKtsObservation,
  deepFreezeKtsValue,
  isKtsJsonCompatible,
  isKtsObservationId,
  isKtsObservationLevel,
  movementDirection,
  toBasisPoints,
  validateKtsObservationBudget,
  type KtsCollectionProjectionMetadata,
  type KtsEnemyObservation,
  type KtsEnemyProjectileObservation,
  type KtsLevelOneSummary,
  type KtsObservationMetadata,
  type KtsObservationPacket,
  type KtsObservationRequest,
  type KtsPlayerProjectileObservation,
} from "./observation-contract";

export function projectKtsObservation(
  state: Readonly<GameState>,
  events: readonly EngineEvent[],
  request: Readonly<KtsObservationRequest>,
): KtsObservationProjectionResult {
  const context = readSafeContext(state, request);

  try {
    validateRequest(request);
    validateGameState(state);

    const sourceStateDigest = createStateDigest(state);
    const eventWindow = projectKtsEventWindow(
      events,
      state.tick,
      request.budget,
      request.source?.eventWindowStartTick,
    );
    const entities = projectEntities(state, request.budget);
    const actionSpace = projectKtsActionSpace(state);
    const metadata = buildMetadata(state, request, sourceStateDigest);

    const base = {
      metadata,
      lifecycle: {
        status: state.status,
        terminalReason: state.terminalReason,
        encounterPhase: state.encounter.phase,
        encounterComplete: state.encounter.phase === "complete",
        tick: state.tick,
      },
      player: {
        positionX: state.player.positionX,
        positionY: state.player.positionY,
        velocityX: state.player.velocityX,
        velocityY: state.player.velocityY,
        radius: state.player.radius,
        moving: state.player.velocityX !== 0 || state.player.velocityY !== 0,
        horizontalDirection: movementDirection(state.player.velocityX),
        verticalDirection: movementDirection(state.player.velocityY),
      },
      resources: {
        power: {
          weapons: state.power.weapons,
          defence: state.power.defence,
          signal: state.power.signal,
          shiftCooldownTicks: state.power.shiftCooldownTicks,
        },
        defence: {
          integrity: state.defence.integrity,
          ticksSinceDamage: state.defence.ticksSinceDamage,
          integrityBasisPoints: toBasisPoints(
            state.defence.integrity,
            ENGINE_CONSTANTS.MAX_DEFENCE_INTEGRITY,
          ),
        },
        signal: {
          integrity: state.signal.integrity,
          ticksSinceDamage: state.signal.ticksSinceDamage,
          collapseTicks: state.signal.collapseTicks,
          integrityBasisPoints: toBasisPoints(
            state.signal.integrity,
            ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY,
          ),
        },
        interference: {
          load: state.interference.load,
          loadBasisPoints: toBasisPoints(state.interference.load, 100),
        },
      },
      cooldowns: {
        fireCooldownTicks: state.weapon.fireCooldownTicks,
        powerShiftCooldownTicks: state.power.shiftCooldownTicks,
        recoveryPulseCooldownTicks: state.recoveryPulse.cooldownTicks,
      },
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
      },
      entities: {
        playerProjectiles: entities.playerProjectiles,
        enemies: entities.enemies,
        enemyProjectiles: entities.enemyProjectiles,
      },
      recentEvents: eventWindow.events,
      actionSpace,
      projection: {
        requested: {
          maximumPlayerProjectiles: request.budget.maximumPlayerProjectiles,
          maximumEnemies: request.budget.maximumEnemies,
          maximumEnemyProjectiles: request.budget.maximumEnemyProjectiles,
          maximumRecentEvents: request.budget.maximumRecentEvents,
          maximumEventAgeTicks: request.budget.maximumEventAgeTicks,
          maximumSerializedCharacters: request.budget.maximumSerializedCharacters,
        },
        entities: entities.metadata,
        events: eventWindow.metadata,
      },
    };

    const observation: KtsObservationPacket =
      request.requestedLevel === 0
        ? {
            level: 0,
            ...base,
          }
        : {
            level: 1,
            ...base,
            summary: buildLevelOneSummary(
              state,
              entities,
              eventWindow.events,
              actionSpace.readiness,
            ),
          };

    if (!isKtsJsonCompatible(observation)) {
      return createKtsObservationFailure(
        "observation_not_json",
        "serialization",
        "The projected observation is not JSON-compatible.",
        context,
      );
    }

    const immutableObservation = deepFreezeKtsValue(observation);
    const serialized = canonicalSerializeKtsObservation(immutableObservation);

    if (serialized.length > request.budget.maximumSerializedCharacters) {
      return createKtsObservationFailure(
        "projection_budget_exceeded",
        "serialization",
        "The projected observation exceeds the configured serialized-character budget.",
        {
          ...context,
          diagnostics: {
            serializedCharacters: serialized.length,
            maximumSerializedCharacters: request.budget.maximumSerializedCharacters,
          },
        },
      );
    }

    return {
      ok: true,
      observation: immutableObservation,
    };
  } catch (error) {
    if (error instanceof KtsObservationAdapterError) {
      return createKtsObservationFailure(error.code, error.stage, error.message, {
        ...context,
        ...(error.diagnostics === undefined ? {} : { diagnostics: error.diagnostics }),
      });
    }

    if (
      error instanceof Error &&
      (error.name === "EngineInvariantError" || error.name === "EncounterInvariantError")
    ) {
      return createKtsObservationFailure(
        "invalid_engine_state",
        "state_validation",
        "The supplied Keep the Signal state failed authoritative engine validation.",
        context,
      );
    }

    return createKtsObservationFailure(
      "adapter_internal_failure",
      "internal",
      "The observation adapter could not complete the projection.",
      context,
    );
  }
}

function validateRequest(request: Readonly<KtsObservationRequest>): void {
  if (typeof request !== "object" || request === null) {
    throw new KtsObservationAdapterError(
      "invalid_observation_request",
      "request",
      "The observation request must be an object.",
    );
  }

  if (!isKtsObservationId(request.observationId)) {
    throw new KtsObservationAdapterError(
      "invalid_observation_id",
      "request",
      "The observation ID is invalid.",
    );
  }

  if (!isKtsObservationLevel(request.requestedLevel)) {
    throw new KtsObservationAdapterError(
      "invalid_observation_level",
      "request",
      "The requested observation level is not supported.",
    );
  }

  if (!validateKtsObservationBudget(request.budget)) {
    throw new KtsObservationAdapterError(
      "invalid_budget",
      "request",
      "The observation budget is invalid.",
    );
  }

  const source = request.source;

  if (source === undefined) {
    return;
  }

  if (typeof source !== "object" || source === null) {
    throw new KtsObservationAdapterError(
      "invalid_observation_request",
      "request",
      "Observation source metadata must be an object when supplied.",
    );
  }

  for (const [key, value] of [
    ["sourceLabel", source.sourceLabel],
    ["sessionId", source.sessionId],
    ["episodeId", source.episodeId],
    ["previousObservationId", source.previousObservationId],
  ] as const) {
    if (
      value !== undefined &&
      (typeof value !== "string" || value.length === 0 || value.length > 256)
    ) {
      throw new KtsObservationAdapterError(
        "invalid_observation_request",
        "request",
        `${key} must be a non-empty string no longer than 256 characters.`,
      );
    }
  }

  if (
    source.eventWindowStartTick !== undefined &&
    (!Number.isSafeInteger(source.eventWindowStartTick) || source.eventWindowStartTick < 0)
  ) {
    throw new KtsObservationAdapterError(
      "invalid_observation_request",
      "request",
      "eventWindowStartTick must be a non-negative safe integer.",
    );
  }
}

function buildMetadata(
  state: Readonly<GameState>,
  request: Readonly<KtsObservationRequest>,
  sourceStateDigest: string,
): KtsObservationMetadata {
  return {
    observationId: request.observationId,
    observationSchemaId: KTS_OBSERVATION_SCHEMA_ID,
    observationSchemaVersion: KTS_OBSERVATION_SCHEMA_VERSION,
    adapterId: KTS_OBSERVATION_ADAPTER_ID,
    adapterVersion: KTS_OBSERVATION_ADAPTER_VERSION,
    requestedLevel: request.requestedLevel,
    sourceStateDigest,
    engineVersion: state.engineVersion,
    rulesetVersion: state.rulesetVersion,
    seed: state.seed,
    tick: state.tick,
    ...(request.source?.sourceLabel === undefined
      ? {}
      : { sourceLabel: request.source.sourceLabel }),
    ...(request.source?.sessionId === undefined ? {} : { sessionId: request.source.sessionId }),
    ...(request.source?.episodeId === undefined ? {} : { episodeId: request.source.episodeId }),
    ...(request.source?.previousObservationId === undefined
      ? {}
      : { previousObservationId: request.source.previousObservationId }),
  };
}

function projectEntities(
  state: Readonly<GameState>,
  budget: Readonly<KtsObservationRequest["budget"]>,
): {
  readonly playerProjectiles: readonly KtsPlayerProjectileObservation[];
  readonly enemies: readonly KtsEnemyObservation[];
  readonly enemyProjectiles: readonly KtsEnemyProjectileObservation[];
  readonly metadata: {
    readonly playerProjectiles: KtsCollectionProjectionMetadata;
    readonly enemies: KtsCollectionProjectionMetadata;
    readonly enemyProjectiles: KtsCollectionProjectionMetadata;
  };
} {
  const playerProjectiles = [...state.projectiles]
    .sort((left, right) => left.id - right.id)
    .slice(0, budget.maximumPlayerProjectiles)
    .map((projectile) => ({
      id: projectile.id,
      positionX: projectile.positionX,
      positionY: projectile.positionY,
      velocityX: projectile.velocityX,
      velocityY: projectile.velocityY,
      radius: projectile.radius,
      remainingTicks: projectile.remainingTicks,
    }));

  const enemyCandidates = state.enemies
    .map((enemy) => ({
      enemy,
      squaredDistance: squaredDistance(
        state.player.positionX,
        state.player.positionY,
        enemy.positionX,
        enemy.positionY,
      ),
    }))
    .sort(
      (left, right) =>
        left.squaredDistance - right.squaredDistance || left.enemy.id - right.enemy.id,
    )
    .slice(0, budget.maximumEnemies)
    .sort((left, right) => left.enemy.id - right.enemy.id);

  const enemies = enemyCandidates.map(({ enemy, squaredDistance }) => ({
    id: enemy.id,
    archetype: enemy.archetype,
    positionX: enemy.positionX,
    positionY: enemy.positionY,
    velocityX: enemy.velocityX,
    velocityY: enemy.velocityY,
    radius: enemy.radius,
    integrity: enemy.integrity,
    maximumIntegrity: enemy.maximumIntegrity,
    integrityBasisPoints: toBasisPoints(enemy.integrity, enemy.maximumIntegrity),
    fireCooldownTicks: enemy.fireCooldownTicks,
    fireIntervalTicks: enemy.fireIntervalTicks,
    fireReady: enemy.fireIntervalTicks > 0 && enemy.fireCooldownTicks === 0,
    squaredDistanceFromPlayer: squaredDistance,
  }));

  const enemyProjectileCandidates = state.enemyProjectiles
    .map((projectile) => ({
      projectile,
      squaredDistance: squaredDistance(
        state.player.positionX,
        state.player.positionY,
        projectile.positionX,
        projectile.positionY,
      ),
    }))
    .sort(
      (left, right) =>
        left.squaredDistance - right.squaredDistance || left.projectile.id - right.projectile.id,
    )
    .slice(0, budget.maximumEnemyProjectiles)
    .sort((left, right) => left.projectile.id - right.projectile.id);

  const enemyProjectiles = enemyProjectileCandidates.map(({ projectile, squaredDistance }) => ({
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
    squaredDistanceFromPlayer: squaredDistance,
  }));

  return deepFreezeKtsValue({
    playerProjectiles,
    enemies,
    enemyProjectiles,
    metadata: {
      playerProjectiles: collectionMetadata(
        state.projectiles.length,
        playerProjectiles.length,
        "ascending_id",
      ),
      enemies: collectionMetadata(
        state.enemies.length,
        enemies.length,
        "nearest_then_id_selection__ascending_id_output",
      ),
      enemyProjectiles: collectionMetadata(
        state.enemyProjectiles.length,
        enemyProjectiles.length,
        "nearest_then_id_selection__ascending_id_output",
      ),
    },
  });
}

function collectionMetadata(
  sourceCount: number,
  includedCount: number,
  selectionPolicy: string,
): KtsCollectionProjectionMetadata {
  const omittedCount = sourceCount - includedCount;

  return {
    sourceCount,
    includedCount,
    omittedCount,
    truncated: omittedCount > 0,
    selectionPolicy,
  };
}

function buildLevelOneSummary(
  state: Readonly<GameState>,
  entities: ReturnType<typeof projectEntities>,
  recentEvents: readonly { readonly type: string }[],
  readiness: {
    readonly fireReady: boolean;
    readonly powerShiftReady: boolean;
    readonly recoveryPulseReady: boolean;
  },
): KtsLevelOneSummary {
  const enemyCountsByArchetype: Record<EnemyArchetype, number> = {
    scout: 0,
    interceptor: 0,
    disruptor: 0,
  };

  for (const enemy of state.enemies) {
    enemyCountsByArchetype[enemy.archetype] += 1;
  }

  const enemyProjectileCountsByKind: Record<EnemyProjectileKind, number> = {
    kinetic: 0,
    corruption: 0,
  };

  for (const projectile of state.enemyProjectiles) {
    enemyProjectileCountsByKind[projectile.kind] += 1;
  }

  const nearestEnemy = nearestEntity(state.player.positionX, state.player.positionY, state.enemies);
  const nearestEnemyProjectile = nearestEntity(
    state.player.positionX,
    state.player.positionY,
    state.enemyProjectiles,
  );

  const currentWaveResolvedCount = state.encounter.enemiesDefeated + state.encounter.enemiesEscaped;
  const currentWaveRemainingCount = state.encounter.enemiesScheduled - currentWaveResolvedCount;
  const encounterTotalResolvedCount =
    state.encounter.totalEnemiesDefeated + state.encounter.totalEnemiesEscaped;

  const recentEventCountsByType: Record<string, number> = {};

  for (const event of recentEvents) {
    recentEventCountsByType[event.type] = (recentEventCountsByType[event.type] ?? 0) + 1;
  }

  return deepFreezeKtsValue({
    enemyCountsByArchetype,
    enemyProjectileCountsByKind,
    playerProjectileCount: state.projectiles.length,
    currentWaveResolvedCount,
    currentWaveRemainingCount,
    encounterTotalResolvedCount,
    waveProgressBasisPoints: toBasisPoints(
      currentWaveResolvedCount,
      state.encounter.enemiesScheduled,
    ),
    fireReady: readiness.fireReady,
    powerShiftReady: readiness.powerShiftReady,
    recoveryPulseReady: readiness.recoveryPulseReady,
    nearestEnemy,
    nearestEnemyProjectile,
    activeEntityCounts: {
      source: {
        playerProjectiles: state.projectiles.length,
        enemies: state.enemies.length,
        enemyProjectiles: state.enemyProjectiles.length,
      },
      included: {
        playerProjectiles: entities.playerProjectiles.length,
        enemies: entities.enemies.length,
        enemyProjectiles: entities.enemyProjectiles.length,
      },
    },
    recentEventCountsByType,
  });
}

function nearestEntity(
  playerX: number,
  playerY: number,
  entities: readonly {
    readonly id: number;
    readonly positionX: number;
    readonly positionY: number;
  }[],
): { readonly id: number; readonly squaredDistance: number } | null {
  let nearest: { readonly id: number; readonly squaredDistance: number } | null = null;

  for (const entity of entities) {
    const distance = squaredDistance(playerX, playerY, entity.positionX, entity.positionY);

    if (
      nearest === null ||
      distance < nearest.squaredDistance ||
      (distance === nearest.squaredDistance && entity.id < nearest.id)
    ) {
      nearest = {
        id: entity.id,
        squaredDistance: distance,
      };
    }
  }

  return nearest;
}

function squaredDistance(leftX: number, leftY: number, rightX: number, rightY: number): number {
  const deltaX = leftX - rightX;
  const deltaY = leftY - rightY;
  const value = deltaX * deltaX + deltaY * deltaY;

  if (!Number.isSafeInteger(value)) {
    throw new KtsObservationAdapterError(
      "adapter_internal_failure",
      "state_projection",
      "Entity distance exceeded safe-integer limits.",
    );
  }

  return value;
}

function readSafeContext(
  state: Readonly<GameState>,
  request: Readonly<KtsObservationRequest>,
): {
  readonly observationId?: string;
  readonly stateTick?: number;
} {
  const observationId =
    typeof request === "object" &&
    request !== null &&
    typeof request.observationId === "string" &&
    request.observationId.length > 0
      ? request.observationId
      : undefined;

  const stateTick =
    typeof state === "object" &&
    state !== null &&
    Number.isSafeInteger((state as { tick?: unknown }).tick) &&
    (state as { tick: number }).tick >= 0
      ? (state as { tick: number }).tick
      : undefined;

  return {
    ...(observationId === undefined ? {} : { observationId }),
    ...(stateTick === undefined ? {} : { stateTick }),
  };
}

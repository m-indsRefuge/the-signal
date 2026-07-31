import {
  ENGINE_CONSTANTS,
  type EnemyArchetype,
  type EnemyProjectileKind,
  type EngineEvent,
  type GameState,
} from "../engine";
import {
  createKtsWorldTransform,
  interpolateWorldPosition,
  worldLengthToScreen,
  worldToScreen,
  type KtsPresentationFrame,
  type KtsPresentationViewport,
  type KtsScreenPoint,
  type KtsWorldTransform,
} from "./presentation-frame";

export const KTS_MAX_VISUAL_EFFECTS = 24;

const PALETTE = Object.freeze({
  background: "#020405",
  field: "#05090a",
  grid: "rgba(102, 224, 215, 0.08)",
  boundary: "rgba(162, 241, 233, 0.44)",
  signal: "#63e0d4",
  signalSoft: "rgba(99, 224, 212, 0.35)",
  warm: "#ece6d5",
  warning: "#e1aa5b",
  danger: "#df6b5d",
  muted: "rgba(236, 230, 213, 0.42)",
});

export interface KtsCanvasEntityGeometry {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface KtsCanvasEnemyGeometry extends KtsCanvasEntityGeometry {
  readonly archetype: EnemyArchetype;
  readonly integrityRatio: number;
}

export interface KtsCanvasEnemyProjectileGeometry extends KtsCanvasEntityGeometry {
  readonly kind: EnemyProjectileKind;
}

export interface KtsCanvasGeometry {
  readonly player: KtsCanvasEntityGeometry;
  readonly enemies: readonly KtsCanvasEnemyGeometry[];
  readonly playerProjectiles: readonly KtsCanvasEntityGeometry[];
  readonly enemyProjectiles: readonly KtsCanvasEnemyProjectileGeometry[];
}

export type KtsVisualEffectKind =
  | "player-fire"
  | "impact-ring"
  | "enemy-destruction"
  | "defence-hit"
  | "signal-hit"
  | "collapse-warning"
  | "wave-transmission"
  | "wave-sweep"
  | "encounter-convergence";

export interface KtsVisualEffect {
  readonly id: string;
  readonly kind: KtsVisualEffectKind;
  readonly sourceTick: number;
  readonly ageTicks: number;
  readonly lifetimeTicks: number;
  readonly progress: number;
  readonly x: number | null;
  readonly y: number | null;
  readonly intensity: number;
  readonly simplified: boolean;
}

export interface KtsCanvasRenderSummary {
  readonly transform: KtsWorldTransform;
  readonly playerCount: 1;
  readonly enemyCount: number;
  readonly playerProjectileCount: number;
  readonly enemyProjectileCount: number;
  readonly effectCount: number;
}

export function configureKtsCanvas(
  canvas: HTMLCanvasElement,
  viewport: Readonly<KtsPresentationViewport>,
): KtsWorldTransform {
  const transform = createKtsWorldTransform(viewport);

  if (canvas.width !== transform.backingWidth) {
    canvas.width = transform.backingWidth;
  }

  if (canvas.height !== transform.backingHeight) {
    canvas.height = transform.backingHeight;
  }

  canvas.style.width = `${transform.cssWidth}px`;
  canvas.style.height = `${transform.cssHeight}px`;

  return transform;
}

export function projectKtsCanvasGeometry(frame: Readonly<KtsPresentationFrame>): KtsCanvasGeometry {
  const previous = frame.previousState;
  const current = frame.currentState;
  const alpha = frame.interpolationAlpha;

  const playerPosition = interpolateWorldPosition(
    previous.player.positionX,
    previous.player.positionY,
    current.player.positionX,
    current.player.positionY,
    alpha,
  );

  return Object.freeze({
    player: Object.freeze({
      id: 0,
      x: playerPosition.x,
      y: playerPosition.y,
      radius: current.player.radius,
    }),
    enemies: Object.freeze(
      current.enemies.map((enemy) => {
        const earlier = previous.enemies.find((candidate) => candidate.id === enemy.id);
        const position = earlier
          ? interpolateWorldPosition(
              earlier.positionX,
              earlier.positionY,
              enemy.positionX,
              enemy.positionY,
              alpha,
            )
          : Object.freeze({ x: enemy.positionX, y: enemy.positionY });

        return Object.freeze({
          id: enemy.id,
          archetype: enemy.archetype,
          x: position.x,
          y: position.y,
          radius: enemy.radius,
          integrityRatio: clampRatio(enemy.integrity / enemy.maximumIntegrity),
        });
      }),
    ),
    playerProjectiles: Object.freeze(
      current.projectiles.map((projectile) => {
        const earlier = previous.projectiles.find((candidate) => candidate.id === projectile.id);
        const position = earlier
          ? interpolateWorldPosition(
              earlier.positionX,
              earlier.positionY,
              projectile.positionX,
              projectile.positionY,
              alpha,
            )
          : Object.freeze({ x: projectile.positionX, y: projectile.positionY });

        return Object.freeze({
          id: projectile.id,
          x: position.x,
          y: position.y,
          radius: projectile.radius,
        });
      }),
    ),
    enemyProjectiles: Object.freeze(
      current.enemyProjectiles.map((projectile) => {
        const earlier = previous.enemyProjectiles.find(
          (candidate) => candidate.id === projectile.id,
        );
        const position = earlier
          ? interpolateWorldPosition(
              earlier.positionX,
              earlier.positionY,
              projectile.positionX,
              projectile.positionY,
              alpha,
            )
          : Object.freeze({ x: projectile.positionX, y: projectile.positionY });

        return Object.freeze({
          id: projectile.id,
          kind: projectile.kind,
          x: position.x,
          y: position.y,
          radius: projectile.radius,
        });
      }),
    ),
  });
}

export function deriveKtsVisualEffects(
  frame: Readonly<KtsPresentationFrame>,
): readonly KtsVisualEffect[] {
  const effects: KtsVisualEffect[] = [];

  for (const event of frame.recentEvents) {
    const effect = effectFromEvent(frame, event);

    if (effect !== null) {
      effects.push(effect);
    }
  }

  return Object.freeze(effects.slice(-KTS_MAX_VISUAL_EFFECTS));
}

export function renderKtsCanvas(
  context: CanvasRenderingContext2D,
  frame: Readonly<KtsPresentationFrame>,
): KtsCanvasRenderSummary {
  const transform = frame.transform;
  const geometry = projectKtsCanvasGeometry(frame);
  const effects = deriveKtsVisualEffects(frame);

  context.save();
  context.setTransform(transform.devicePixelRatio, 0, 0, transform.devicePixelRatio, 0, 0);
  context.clearRect(0, 0, transform.cssWidth, transform.cssHeight);
  context.fillStyle = PALETTE.background;
  context.fillRect(0, 0, transform.cssWidth, transform.cssHeight);

  drawField(context, transform);
  drawEffects(context, transform, effects);
  drawPlayerProjectiles(context, transform, geometry.playerProjectiles);
  drawEnemyProjectiles(context, transform, geometry.enemyProjectiles);
  drawEnemies(context, transform, geometry.enemies);
  drawPlayer(context, transform, geometry.player, frame.currentState);
  drawSignalWarning(context, transform, frame.currentState);

  context.restore();

  return Object.freeze({
    transform,
    playerCount: 1,
    enemyCount: geometry.enemies.length,
    playerProjectileCount: geometry.playerProjectiles.length,
    enemyProjectileCount: geometry.enemyProjectiles.length,
    effectCount: effects.length,
  });
}

function drawField(context: CanvasRenderingContext2D, transform: KtsWorldTransform): void {
  context.fillStyle = PALETTE.field;
  context.fillRect(transform.fieldX, transform.fieldY, transform.fieldSize, transform.fieldSize);

  context.strokeStyle = PALETTE.grid;
  context.lineWidth = 1;

  for (let index = 1; index < 10; index += 1) {
    const offset = (transform.fieldSize * index) / 10;

    context.beginPath();
    context.moveTo(transform.fieldX + offset, transform.fieldY);
    context.lineTo(transform.fieldX + offset, transform.fieldY + transform.fieldSize);
    context.stroke();

    context.beginPath();
    context.moveTo(transform.fieldX, transform.fieldY + offset);
    context.lineTo(transform.fieldX + transform.fieldSize, transform.fieldY + offset);
    context.stroke();
  }

  context.strokeStyle = PALETTE.boundary;
  context.lineWidth = 1.5;
  context.strokeRect(transform.fieldX, transform.fieldY, transform.fieldSize, transform.fieldSize);
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  transform: KtsWorldTransform,
  player: KtsCanvasEntityGeometry,
  state: Readonly<GameState>,
): void {
  const point = worldToScreen(transform, player.x, player.y);
  const radius = Math.max(5, worldLengthToScreen(transform, player.radius));
  const signalRatio = clampRatio(state.signal.integrity / ENGINE_CONSTANTS.MAX_SIGNAL_INTEGRITY);

  context.save();
  context.translate(point.x, point.y);
  context.strokeStyle = PALETTE.warm;
  context.fillStyle = "rgba(99, 224, 212, 0.12)";
  context.shadowColor = PALETTE.signal;
  context.shadowBlur = 7 * signalRatio;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -radius);
  context.lineTo(radius * 0.78, radius * 0.75);
  context.lineTo(0, radius * 0.38);
  context.lineTo(-radius * 0.78, radius * 0.75);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawEnemies(
  context: CanvasRenderingContext2D,
  transform: KtsWorldTransform,
  enemies: readonly KtsCanvasEnemyGeometry[],
): void {
  for (const enemy of enemies) {
    const point = worldToScreen(transform, enemy.x, enemy.y);
    const radius = Math.max(4, worldLengthToScreen(transform, enemy.radius));

    context.save();
    context.translate(point.x, point.y);
    context.strokeStyle = enemy.integrityRatio < 0.35 ? PALETTE.danger : PALETTE.warning;
    context.fillStyle = "rgba(225, 170, 91, 0.08)";
    context.lineWidth = 1.4;

    if (enemy.archetype === "scout") {
      context.beginPath();
      context.moveTo(0, radius);
      context.lineTo(radius * 0.72, -radius * 0.65);
      context.lineTo(0, -radius * 0.25);
      context.lineTo(-radius * 0.72, -radius * 0.65);
      context.closePath();
    } else if (enemy.archetype === "interceptor") {
      context.beginPath();
      context.moveTo(-radius, 0);
      context.lineTo(-radius * 0.28, -radius * 0.42);
      context.lineTo(0, radius * 0.72);
      context.lineTo(radius * 0.28, -radius * 0.42);
      context.lineTo(radius, 0);
      context.lineTo(0, -radius * 0.2);
      context.closePath();
    } else {
      context.beginPath();
      for (let index = 0; index < 6; index += 1) {
        const angle = Math.PI / 6 + (Math.PI * 2 * index) / 6;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.closePath();
      context.moveTo(-radius * 0.45, 0);
      context.lineTo(radius * 0.45, 0);
      context.moveTo(0, -radius * 0.45);
      context.lineTo(0, radius * 0.45);
    }

    context.fill();
    context.stroke();
    context.restore();
  }
}

function drawPlayerProjectiles(
  context: CanvasRenderingContext2D,
  transform: KtsWorldTransform,
  projectiles: readonly KtsCanvasEntityGeometry[],
): void {
  context.strokeStyle = PALETTE.signal;
  context.lineWidth = 1.8;
  context.lineCap = "round";

  for (const projectile of projectiles) {
    const point = worldToScreen(transform, projectile.x, projectile.y);
    const radius = Math.max(2, worldLengthToScreen(transform, projectile.radius));

    context.beginPath();
    context.moveTo(point.x, point.y + radius * 1.8);
    context.lineTo(point.x, point.y - radius * 1.8);
    context.stroke();
  }
}

function drawEnemyProjectiles(
  context: CanvasRenderingContext2D,
  transform: KtsWorldTransform,
  projectiles: readonly KtsCanvasEnemyProjectileGeometry[],
): void {
  for (const projectile of projectiles) {
    const point = worldToScreen(transform, projectile.x, projectile.y);
    const radius = Math.max(2.5, worldLengthToScreen(transform, projectile.radius));

    context.strokeStyle = projectile.kind === "kinetic" ? PALETTE.warning : PALETTE.danger;
    context.fillStyle = projectile.kind === "kinetic" ? PALETTE.warning : "transparent";
    context.lineWidth = 1.4;
    context.beginPath();

    if (projectile.kind === "kinetic") {
      context.rect(point.x - radius, point.y - radius, radius * 2, radius * 2);
      context.fill();
    } else {
      context.moveTo(point.x, point.y - radius * 1.3);
      context.lineTo(point.x + radius * 1.3, point.y);
      context.lineTo(point.x, point.y + radius * 1.3);
      context.lineTo(point.x - radius * 1.3, point.y);
      context.closePath();
    }

    context.stroke();
  }
}

function drawEffects(
  context: CanvasRenderingContext2D,
  transform: KtsWorldTransform,
  effects: readonly KtsVisualEffect[],
): void {
  for (const effect of effects) {
    const point = effectPoint(transform, effect);
    const fade = 1 - effect.progress;

    context.save();
    context.globalAlpha = Math.max(0, fade);
    context.lineWidth = effect.simplified ? 1.25 : 2;

    if (effect.kind === "player-fire") {
      context.strokeStyle = PALETTE.signal;
      context.beginPath();
      context.arc(point.x, point.y, 5 + effect.progress * 12, 0, Math.PI * 2);
      context.stroke();
    } else if (effect.kind === "impact-ring") {
      context.strokeStyle = PALETTE.warning;
      context.beginPath();
      context.arc(point.x, point.y, 7 + effect.progress * 22, 0, Math.PI * 2);
      context.stroke();
    } else if (effect.kind === "enemy-destruction") {
      context.strokeStyle = PALETTE.warm;

      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6;
        const inner = 5 + effect.progress * 8;
        const outer = 12 + effect.progress * 28;
        context.beginPath();
        context.moveTo(point.x + Math.cos(angle) * inner, point.y + Math.sin(angle) * inner);
        context.lineTo(point.x + Math.cos(angle) * outer, point.y + Math.sin(angle) * outer);
        context.stroke();
      }
    } else if (effect.kind === "defence-hit") {
      context.strokeStyle = PALETTE.warning;
      context.beginPath();
      context.arc(point.x, point.y, 12 + effect.progress * 32, 0, Math.PI * 2);
      context.stroke();
    } else if (effect.kind === "signal-hit") {
      context.strokeStyle = PALETTE.danger;
      context.beginPath();
      context.arc(point.x, point.y, 10 + effect.progress * 38, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(point.x - 20, point.y + 7);
      context.lineTo(point.x - 4, point.y - 3);
      context.lineTo(point.x + 8, point.y + 5);
      context.lineTo(point.x + 24, point.y - 8);
      context.stroke();
    } else if (effect.kind === "collapse-warning") {
      context.strokeStyle = PALETTE.danger;
      context.strokeRect(
        transform.fieldX + effect.progress * 5,
        transform.fieldY + effect.progress * 5,
        transform.fieldSize - effect.progress * 10,
        transform.fieldSize - effect.progress * 10,
      );
    } else if (effect.kind === "wave-transmission") {
      context.strokeStyle = PALETTE.signal;
      const y = transform.fieldY + transform.fieldSize * effect.progress;
      context.beginPath();
      context.moveTo(transform.fieldX, y);
      context.lineTo(transform.fieldX + transform.fieldSize, y);
      context.stroke();
    } else if (effect.kind === "wave-sweep") {
      context.strokeStyle = PALETTE.warm;
      const x = transform.fieldX + transform.fieldSize * effect.progress;
      context.beginPath();
      context.moveTo(x, transform.fieldY);
      context.lineTo(x, transform.fieldY + transform.fieldSize);
      context.stroke();
    } else {
      context.strokeStyle = PALETTE.signal;
      context.beginPath();
      context.arc(
        transform.fieldX + transform.fieldSize / 2,
        transform.fieldY + transform.fieldSize / 2,
        transform.fieldSize * (0.08 + effect.progress * 0.42),
        0,
        Math.PI * 2,
      );
      context.stroke();
    }

    context.restore();
  }
}

function drawSignalWarning(
  context: CanvasRenderingContext2D,
  transform: KtsWorldTransform,
  state: Readonly<GameState>,
): void {
  if (state.signal.collapseTicks <= 0) {
    return;
  }

  const ratio = clampRatio(
    state.signal.collapseTicks / ENGINE_CONSTANTS.SIGNAL_COLLAPSE_GRACE_TICKS,
  );
  context.save();
  context.globalAlpha = 0.22 + ratio * 0.48;
  context.strokeStyle = PALETTE.danger;
  context.lineWidth = 2;
  context.strokeRect(
    transform.fieldX + 3,
    transform.fieldY + 3,
    transform.fieldSize - 6,
    transform.fieldSize - 6,
  );
  context.restore();
}

function effectFromEvent(
  frame: Readonly<KtsPresentationFrame>,
  event: Readonly<EngineEvent>,
): KtsVisualEffect | null {
  const currentTick = frame.currentState.tick;
  const sourceTick = event.tick;
  const ageTicks = Math.max(0, currentTick - sourceTick);
  const definition = effectDefinition(event);

  if (definition === null || ageTicks > definition.lifetimeTicks) {
    return null;
  }

  if (frame.reducedMotion && definition.suppressUnderReducedMotion) {
    return null;
  }

  const worldPosition = effectWorldPosition(frame, event);

  return Object.freeze({
    id: `${sourceTick}:${event.type}:${effectIdentitySuffix(event)}`,
    kind: definition.kind,
    sourceTick,
    ageTicks,
    lifetimeTicks: definition.lifetimeTicks,
    progress: clampRatio(ageTicks / definition.lifetimeTicks),
    x: worldPosition?.x ?? null,
    y: worldPosition?.y ?? null,
    intensity: definition.intensity,
    simplified: frame.reducedMotion,
  });
}

function effectDefinition(event: Readonly<EngineEvent>): {
  readonly kind: KtsVisualEffectKind;
  readonly lifetimeTicks: number;
  readonly intensity: number;
  readonly suppressUnderReducedMotion: boolean;
} | null {
  switch (event.type) {
    case "projectile_fired":
      return effectSpec("player-fire", 8, 0.7, false);
    case "player_projectile_hit_enemy":
    case "enemy_projectile_hit_player":
      return effectSpec("impact-ring", 16, 0.8, false);
    case "enemy_destroyed":
      return effectSpec("enemy-destruction", 28, 1, true);
    case "defence_damaged":
      return effectSpec("defence-hit", 18, 0.8, false);
    case "signal_damaged":
      return effectSpec("signal-hit", 22, 1, true);
    case "signal_collapse_started":
      return effectSpec("collapse-warning", 180, 1, false);
    case "wave_started":
      return effectSpec("wave-transmission", 32, 0.8, true);
    case "wave_completed":
      return effectSpec("wave-sweep", 40, 0.9, true);
    case "encounter_completed":
      return effectSpec("encounter-convergence", 72, 1, true);
    default:
      return null;
  }
}

function effectSpec(
  kind: KtsVisualEffectKind,
  lifetimeTicks: number,
  intensity: number,
  suppressUnderReducedMotion: boolean,
): {
  readonly kind: KtsVisualEffectKind;
  readonly lifetimeTicks: number;
  readonly intensity: number;
  readonly suppressUnderReducedMotion: boolean;
} {
  return { kind, lifetimeTicks, intensity, suppressUnderReducedMotion };
}

function effectWorldPosition(
  frame: Readonly<KtsPresentationFrame>,
  event: Readonly<EngineEvent>,
): Readonly<{ x: number; y: number }> | null {
  if (event.type === "enemy_spawned") {
    return Object.freeze({ x: event.positionX, y: event.positionY });
  }

  if (
    event.type === "enemy_projectile_hit_player" ||
    event.type === "defence_damaged" ||
    event.type === "signal_damaged"
  ) {
    return Object.freeze({
      x: frame.currentState.player.positionX,
      y: frame.currentState.player.positionY,
    });
  }

  if ("enemyId" in event && typeof event.enemyId === "number") {
    const enemy =
      frame.currentState.enemies.find((candidate) => candidate.id === event.enemyId) ??
      frame.previousState.enemies.find((candidate) => candidate.id === event.enemyId);

    if (enemy !== undefined) {
      return Object.freeze({ x: enemy.positionX, y: enemy.positionY });
    }
  }

  if ("projectileId" in event && typeof event.projectileId === "number") {
    const projectile =
      frame.currentState.projectiles.find((candidate) => candidate.id === event.projectileId) ??
      frame.previousState.projectiles.find((candidate) => candidate.id === event.projectileId);

    if (projectile !== undefined) {
      return Object.freeze({ x: projectile.positionX, y: projectile.positionY });
    }
  }

  return null;
}

function effectPoint(
  transform: KtsWorldTransform,
  effect: Readonly<KtsVisualEffect>,
): KtsScreenPoint {
  if (effect.x === null || effect.y === null) {
    return Object.freeze({
      x: transform.fieldX + transform.fieldSize / 2,
      y: transform.fieldY + transform.fieldSize / 2,
    });
  }

  return worldToScreen(transform, effect.x, effect.y);
}

function effectIdentitySuffix(event: Readonly<EngineEvent>): string {
  if ("enemyId" in event) {
    return String(event.enemyId);
  }

  if ("projectileId" in event) {
    return String(event.projectileId);
  }

  if ("waveNumber" in event) {
    return String(event.waveNumber);
  }

  return "global";
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

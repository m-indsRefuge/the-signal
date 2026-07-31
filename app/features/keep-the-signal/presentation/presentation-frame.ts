import { ENGINE_CONSTANTS, type EngineEvent, type GameState } from "../engine";
import type {
  KtsRuntimeLifecycle,
  KtsRuntimeSnapshot,
  ReplayVerificationFailureReason,
} from "../runtime";

export const KTS_CANVAS_DPR_CAP = 2;
export const KTS_WORLD_SIZE = ENGINE_CONSTANTS.WORLD_MAX - ENGINE_CONSTANTS.WORLD_MIN;

export interface KtsPresentationViewport {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly devicePixelRatio: number;
}

export interface KtsWorldTransform {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly devicePixelRatio: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly fieldX: number;
  readonly fieldY: number;
  readonly fieldSize: number;
  readonly worldScale: number;
}

export interface KtsScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface KtsPresentationFrame {
  readonly previousState: Readonly<GameState>;
  readonly currentState: Readonly<GameState>;
  readonly interpolationAlpha: number;
  readonly recentEvents: readonly Readonly<EngineEvent>[];
  readonly lastTickEvents: readonly Readonly<EngineEvent>[];
  readonly lifecycle: KtsRuntimeLifecycle;
  readonly reducedMotion: boolean;
  readonly viewport: KtsPresentationViewport;
  readonly transform: KtsWorldTransform;
  readonly finalDigest: string | null;
  readonly timingInterrupted: boolean;
  readonly replayFault: ReplayVerificationFailureReason | null;
}

export function createKtsPresentationFrame(
  snapshot: Readonly<KtsRuntimeSnapshot>,
  viewport: Readonly<KtsPresentationViewport>,
  reducedMotion: boolean,
): KtsPresentationFrame {
  if (typeof reducedMotion !== "boolean") {
    throw new TypeError("reducedMotion must be a boolean.");
  }

  const normalizedViewport = normalizeKtsPresentationViewport(viewport);
  const replayFault =
    snapshot.replayVerification !== null && !snapshot.replayVerification.ok
      ? snapshot.replayVerification.reason
      : null;

  return Object.freeze({
    previousState: snapshot.previousState,
    currentState: snapshot.currentState,
    interpolationAlpha: clampInterpolationAlpha(snapshot.loop.interpolationAlpha),
    recentEvents: Object.freeze([...snapshot.recentEvents]),
    lastTickEvents: Object.freeze([...snapshot.lastTickEvents]),
    lifecycle: snapshot.lifecycle,
    reducedMotion,
    viewport: normalizedViewport,
    transform: createKtsWorldTransform(normalizedViewport),
    finalDigest: snapshot.sessionRecord?.finalDigest ?? null,
    timingInterrupted: snapshot.timingInterrupted,
    replayFault,
  });
}

export function normalizeKtsPresentationViewport(
  viewport: Readonly<KtsPresentationViewport>,
): KtsPresentationViewport {
  if (typeof viewport !== "object" || viewport === null) {
    throw new TypeError("viewport must be an object.");
  }

  assertPositiveFinite(viewport.cssWidth, "viewport.cssWidth");
  assertPositiveFinite(viewport.cssHeight, "viewport.cssHeight");
  assertPositiveFinite(viewport.devicePixelRatio, "viewport.devicePixelRatio");

  return Object.freeze({
    cssWidth: viewport.cssWidth,
    cssHeight: viewport.cssHeight,
    devicePixelRatio: Math.min(KTS_CANVAS_DPR_CAP, viewport.devicePixelRatio),
  });
}

export function createKtsWorldTransform(
  viewport: Readonly<KtsPresentationViewport>,
): KtsWorldTransform {
  const normalized = normalizeKtsPresentationViewport(viewport);
  const shortestSide = Math.min(normalized.cssWidth, normalized.cssHeight);
  const outerMargin = Math.min(32, shortestSide * 0.04);
  const availableWidth = Math.max(1, normalized.cssWidth - outerMargin * 2);
  const availableHeight = Math.max(1, normalized.cssHeight - outerMargin * 2);
  const fieldSize = Math.max(1, Math.min(availableWidth, availableHeight));
  const fieldX = (normalized.cssWidth - fieldSize) / 2;
  const fieldY = (normalized.cssHeight - fieldSize) / 2;

  return Object.freeze({
    cssWidth: normalized.cssWidth,
    cssHeight: normalized.cssHeight,
    devicePixelRatio: normalized.devicePixelRatio,
    backingWidth: Math.max(1, Math.round(normalized.cssWidth * normalized.devicePixelRatio)),
    backingHeight: Math.max(1, Math.round(normalized.cssHeight * normalized.devicePixelRatio)),
    fieldX,
    fieldY,
    fieldSize,
    worldScale: fieldSize / KTS_WORLD_SIZE,
  });
}

export function worldToScreen(
  transform: Readonly<KtsWorldTransform>,
  worldX: number,
  worldY: number,
): KtsScreenPoint {
  assertFinite(worldX, "worldX");
  assertFinite(worldY, "worldY");

  return Object.freeze({
    x: transform.fieldX + (worldX - ENGINE_CONSTANTS.WORLD_MIN) * transform.worldScale,
    y: transform.fieldY + (worldY - ENGINE_CONSTANTS.WORLD_MIN) * transform.worldScale,
  });
}

export function worldLengthToScreen(
  transform: Readonly<KtsWorldTransform>,
  worldLength: number,
): number {
  assertFinite(worldLength, "worldLength");
  return worldLength * transform.worldScale;
}

export function interpolateWorldPosition(
  previousX: number,
  previousY: number,
  currentX: number,
  currentY: number,
  alpha: number,
): Readonly<{ x: number; y: number }> {
  assertFinite(previousX, "previousX");
  assertFinite(previousY, "previousY");
  assertFinite(currentX, "currentX");
  assertFinite(currentY, "currentY");

  const normalizedAlpha = clampInterpolationAlpha(alpha);

  return Object.freeze({
    x: previousX + (currentX - previousX) * normalizedAlpha,
    y: previousY + (currentY - previousY) * normalizedAlpha,
  });
}

export function clampInterpolationAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) {
    return 0;
  }

  return Math.min(1, Math.max(0, alpha));
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

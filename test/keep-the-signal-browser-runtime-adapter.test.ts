import { describe, expect, it, vi } from "vitest";

import {
  ENGINE_CONSTANTS,
  type EngineEvent,
  type GameState,
  type StepResult,
} from "../app/features/keep-the-signal/engine";
import {
  type KtsAudioSnapshot,
  type KtsProceduralAudio,
} from "../app/features/keep-the-signal/presentation";
import {
  FIXED_STEP_LOOP_CONFIG,
  KTS_BROWSER_HUD_PUBLISH_INTERVAL_TICKS,
  createKtsBrowserRuntimeAdapter,
  createKtsSessionController,
  type KtsBrowserEnvironment,
} from "../app/features/keep-the-signal/runtime";

const TICK_MS = FIXED_STEP_LOOP_CONFIG.tickDurationMs;

describe("Keep the Signal KTS-I3 browser runtime adapter", () => {
  it("uses a six-tick bounded HUD publication interval", () => {
    expect(KTS_BROWSER_HUD_PUBLISH_INTERVAL_TICKS).toBe(6);
  });

  it("rejects non-object options", () => {
    expect(() => createKtsBrowserRuntimeAdapter(null as never)).toThrow(
      "options must be an object",
    );
  });

  it("rejects a missing controller", () => {
    expect(() =>
      createKtsBrowserRuntimeAdapter({
        controller: null as never,
        canvas: fakeCanvas(),
        context: fakeContext(),
        environment: new FakeEnvironment(),
      }),
    ).toThrow("controller is required");
  });

  it("rejects a missing canvas", () => {
    expect(() =>
      createKtsBrowserRuntimeAdapter({
        controller: createKtsSessionController({ seed: 1 }),
        canvas: null as never,
        context: fakeContext(),
        environment: new FakeEnvironment(),
      }),
    ).toThrow("canvas is required");
  });

  it("rejects a canvas without a 2D context", () => {
    const canvas = fakeCanvas();
    canvas.getContext = (): null => null;

    expect(() =>
      createKtsBrowserRuntimeAdapter({
        controller: createKtsSessionController({ seed: 1 }),
        canvas,
        environment: new FakeEnvironment(),
      }),
    ).toThrow("Canvas 2D");
  });

  it("begins unmounted without creating an animation loop", () => {
    const harness = createHarness();
    const snapshot = harness.adapter.snapshot();

    expect(snapshot.mounted).toBe(false);
    expect(snapshot.animationFrameScheduled).toBe(false);
    expect(snapshot.renderCount).toBe(0);
    expect(harness.environment.pendingFrames()).toBe(0);
  });

  it("mounts browser listeners and renders the idle state once", () => {
    const harness = createHarness();
    const snapshot = harness.adapter.mount();

    expect(snapshot.mounted).toBe(true);
    expect(snapshot.renderCount).toBe(1);
    expect(snapshot.hud.lifecycle).toBe("idle");
    expect(harness.environment.windowListenerCount()).toBe(4);
    expect(harness.environment.documentListenerCount()).toBe(1);
    expect(harness.environment.pendingFrames()).toBe(0);
  });

  it("mounts idempotently", () => {
    const harness = createHarness();

    harness.adapter.mount();
    const second = harness.adapter.mount();

    expect(second.renderCount).toBe(1);
    expect(harness.environment.windowListenerCount()).toBe(4);
  });

  it("starts the authoritative session and schedules one frame", () => {
    const harness = createHarness();
    harness.adapter.mount();

    const snapshot = harness.adapter.start(0);

    expect(snapshot.runtime.lifecycle).toBe("playing");
    expect(harness.environment.pendingFrames()).toBe(1);
  });

  it("advances and renders from requestAnimationFrame timestamps", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    harness.environment.fireNext(TICK_MS);
    const snapshot = harness.adapter.snapshot();

    expect(snapshot.runtime.currentState.tick).toBe(1);
    expect(snapshot.renderCount).toBe(3);
    expect(harness.environment.pendingFrames()).toBe(1);
  });

  it("keeps exactly one animation callback scheduled while active", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    harness.environment.fireNext(TICK_MS);
    harness.environment.fireNext(TICK_MS * 2);

    expect(harness.environment.pendingFrames()).toBe(1);
  });

  it("cancels animation when manually paused", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    const snapshot = harness.adapter.pause();

    expect(snapshot.runtime.lifecycle).toBe("paused");
    expect(harness.environment.pendingFrames()).toBe(0);
  });

  it("schedules animation again only after explicit resume", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);
    harness.adapter.pause();

    const snapshot = harness.adapter.resume(1_000);

    expect(snapshot.runtime.lifecycle).toBe("playing");
    expect(harness.environment.pendingFrames()).toBe(1);
  });

  it("toggles pause and reconciles animation scheduling", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    harness.adapter.togglePause(100);
    expect(harness.environment.pendingFrames()).toBe(0);

    harness.adapter.togglePause(200);
    expect(harness.environment.pendingFrames()).toBe(1);
  });

  it("pauses on hidden documents, cancels animation, and suspends audio", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);
    harness.environment.hidden = true;

    harness.environment.dispatchDocument("visibilitychange");
    const snapshot = harness.adapter.snapshot();

    expect(snapshot.runtime.lifecycle).toBe("paused");
    expect(snapshot.runtime.loop.pauseReason).toBe("hidden");
    expect(harness.environment.pendingFrames()).toBe(0);
    expect(harness.audio.suspendCalls).toBe(1);
  });

  it("never auto-resumes when the document becomes visible", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);
    harness.environment.hidden = true;
    harness.environment.dispatchDocument("visibilitychange");
    harness.environment.hidden = false;

    harness.environment.dispatchDocument("visibilitychange");

    expect(harness.adapter.snapshot().runtime.lifecycle).toBe("paused");
    expect(harness.environment.pendingFrames()).toBe(0);
  });

  it("clears held input on browser blur without pausing", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);
    harness.adapter.pressHeld("left", "pointer:left");

    harness.environment.dispatchWindow("blur");
    const snapshot = harness.adapter.snapshot();

    expect(snapshot.runtime.lifecycle).toBe("playing");
    expect(snapshot.runtime.input.left).toBe(false);
  });

  it("routes keyboard input and prevents browser defaults when requested", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);
    const preventDefault = vi.fn();

    harness.environment.dispatchWindow("keydown", {
      code: "ArrowLeft",
      repeat: false,
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(harness.adapter.snapshot().runtime.input.left).toBe(true);
  });

  it("routes keyboard release through the accepted input controller", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    harness.environment.dispatchWindow("keydown", keyboardEvent("KeyA"));
    harness.environment.dispatchWindow("keyup", keyboardEvent("KeyA"));

    expect(harness.adapter.snapshot().runtime.input.left).toBe(false);
  });

  it("renders immediately when the viewport changes", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.environment.viewport = {
      cssWidth: 640,
      cssHeight: 480,
      devicePixelRatio: 3,
    };

    harness.environment.dispatchWindow("resize");
    const snapshot = harness.adapter.snapshot();

    expect(snapshot.viewport.cssWidth).toBe(640);
    expect(snapshot.viewport.cssHeight).toBe(480);
    expect(snapshot.presentation.transform.devicePixelRatio).toBe(2);
  });

  it("updates reduced-motion presentation without changing game state", () => {
    const harness = createHarness();
    harness.adapter.mount();
    const tick = harness.adapter.snapshot().runtime.currentState.tick;
    harness.environment.reducedMotion = true;

    harness.environment.dispatchReducedMotion();
    const snapshot = harness.adapter.snapshot();

    expect(snapshot.reducedMotion).toBe(true);
    expect(snapshot.presentation.reducedMotion).toBe(true);
    expect(snapshot.runtime.currentState.tick).toBe(tick);
  });

  it("publishes HUD subscribers at ten hertz during ordinary play", () => {
    const harness = createHarness({ step: quietStep });
    const subscriber = vi.fn();
    harness.adapter.subscribe(subscriber);
    harness.adapter.mount();
    harness.adapter.start(0);
    subscriber.mockClear();

    for (let tick = 1; tick <= 5; tick += 1) {
      harness.environment.fireNext(TICK_MS * tick);
    }

    expect(subscriber).toHaveBeenCalledTimes(0);

    harness.environment.fireNext(TICK_MS * 6);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("publishes meaningful event changes immediately", () => {
    const harness = createHarness({ step: eventStep });
    const subscriber = vi.fn();
    harness.adapter.subscribe(subscriber);
    harness.adapter.mount();
    harness.adapter.start(0);
    subscriber.mockClear();

    harness.environment.fireNext(TICK_MS);

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(harness.adapter.snapshot().runtime.recentEvents).toHaveLength(1);
  });

  it("feeds bounded recent events to procedural audio", () => {
    const harness = createHarness({ step: eventStep });
    harness.adapter.mount();
    harness.adapter.start(0);

    harness.environment.fireNext(TICK_MS);

    expect(harness.audio.consumeCalls).toBeGreaterThan(0);
    expect(harness.audio.lastConsumed[0]?.type).toBe("wave_started");
  });

  it("unlocks audio only through the explicit adapter action", async () => {
    const harness = createHarness();

    expect(harness.audio.unlockCalls).toBe(0);
    const snapshot = await harness.adapter.unlockAudio();

    expect(harness.audio.unlockCalls).toBe(1);
    expect(snapshot.audio.status).toBe("ready");
  });

  it("proxies mute and volume without advancing the engine", () => {
    const harness = createHarness();
    const tick = harness.adapter.snapshot().runtime.currentState.tick;

    const muted = harness.adapter.setMuted(true);
    const volume = harness.adapter.setMasterVolume(0.25);

    expect(muted.audio.muted).toBe(true);
    expect(volume.audio.masterVolume).toBe(0.25);
    expect(volume.runtime.currentState.tick).toBe(tick);
  });

  it("proxies pointer-held controls only during live play", () => {
    const harness = createHarness();
    harness.adapter.mount();

    expect(harness.adapter.pressHeld("fire", "pointer:fire")).toBe(false);
    harness.adapter.start(0);
    expect(harness.adapter.pressHeld("fire", "pointer:fire")).toBe(true);
    expect(harness.adapter.snapshot().runtime.input.fire).toBe(true);
    expect(harness.adapter.releaseHeld("fire", "pointer:fire")).toBe(true);
  });

  it("releases all controls owned by one pointer source", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);
    harness.adapter.pressHeld("left", "pointer:move");
    harness.adapter.pressHeld("fire", "pointer:move");

    expect(harness.adapter.releaseSource("pointer:move")).toBe(true);
    expect(harness.adapter.snapshot().runtime.input.left).toBe(false);
    expect(harness.adapter.snapshot().runtime.input.fire).toBe(false);
  });

  it("proxies recovery and power-shift queues", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    expect(harness.adapter.queueRecoveryPulse()).toBe(true);
    expect(harness.adapter.queuePowerShift({ from: "defence", to: "weapons" })).toBe(true);
    expect(harness.adapter.snapshot().runtime.input.recoveryPulseQueued).toBe(true);
    expect(harness.adapter.snapshot().runtime.input.queuedPowerShifts).toHaveLength(1);
  });

  it("restarts with the same seed and schedules a fresh run", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);
    harness.environment.fireNext(TICK_MS);
    const seed = harness.adapter.snapshot().runtime.seed;

    const snapshot = harness.adapter.restartSameSeed(1_000);

    expect(snapshot.runtime.seed).toBe(seed);
    expect(snapshot.runtime.currentState.tick).toBe(0);
    expect(harness.environment.pendingFrames()).toBe(1);
  });

  it("restarts with an explicitly injected seed", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    const snapshot = harness.adapter.restartWithSeed(42, 1_000);

    expect(snapshot.runtime.seed).toBe(42);
    expect(snapshot.runtime.currentState.tick).toBe(0);
  });

  it("stops scheduling after an authoritative completion tick", () => {
    const harness = createHarness({ step: completionStep });
    harness.adapter.mount();
    harness.adapter.start(0);

    harness.environment.fireNext(TICK_MS);
    const snapshot = harness.adapter.snapshot();

    expect(snapshot.runtime.lifecycle).toBe("completed");
    expect(harness.environment.pendingFrames()).toBe(0);
  });

  it("starts and exits deterministic replay through the adapter", () => {
    const harness = createHarness({ step: completionStep });
    harness.adapter.mount();
    harness.adapter.start(0);
    harness.environment.fireNext(TICK_MS);

    const replay = harness.adapter.startReplay(1_000);
    expect(replay.runtime.lifecycle).toBe("replaying");
    expect(harness.environment.pendingFrames()).toBe(1);

    const exited = harness.adapter.exitReplay();
    expect(exited.runtime.lifecycle).toBe("completed");
    expect(harness.environment.pendingFrames()).toBe(0);
  });

  it("renders explicitly without mounting or advancing", () => {
    const harness = createHarness();
    const snapshot = harness.adapter.renderNow();

    expect(snapshot.renderCount).toBe(1);
    expect(snapshot.runtime.currentState.tick).toBe(0);
    expect(harness.environment.pendingFrames()).toBe(0);
  });

  it("supports deterministic subscription removal", () => {
    const harness = createHarness();
    const subscriber = vi.fn();
    const unsubscribe = harness.adapter.subscribe(subscriber);

    harness.adapter.mount();
    expect(subscriber).toHaveBeenCalledTimes(1);
    unsubscribe();
    harness.adapter.renderNow();
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-function subscriber", () => {
    const harness = createHarness();

    expect(() => harness.adapter.subscribe(null as never)).toThrow("subscriber must be a function");
  });

  it("unmounts listeners without disposing controller or audio", () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    const snapshot = harness.adapter.unmount();

    expect(snapshot.mounted).toBe(false);
    expect(snapshot.disposed).toBe(false);
    expect(snapshot.runtime.disposed).toBe(false);
    expect(snapshot.audio.disposed).toBe(false);
    expect(harness.environment.windowListenerCount()).toBe(0);
    expect(harness.environment.documentListenerCount()).toBe(0);
  });

  it("disposes animation, listeners, controller, and audio", async () => {
    const harness = createHarness();
    harness.adapter.mount();
    harness.adapter.start(0);

    const snapshot = await harness.adapter.dispose();

    expect(snapshot.disposed).toBe(true);
    expect(snapshot.runtime.disposed).toBe(true);
    expect(snapshot.audio.disposed).toBe(true);
    expect(harness.environment.pendingFrames()).toBe(0);
    expect(harness.environment.windowListenerCount()).toBe(0);
  });

  it("disposes idempotently", async () => {
    const harness = createHarness();

    await harness.adapter.dispose();
    await harness.adapter.dispose();

    expect(harness.audio.disposeCalls).toBe(1);
  });

  it("rejects commands after disposal", async () => {
    const harness = createHarness();
    await harness.adapter.dispose();

    expect(() => harness.adapter.renderNow()).toThrow("disposed");
    expect(() => harness.adapter.start()).toThrow("disposed");
  });
});

interface HarnessOptions {
  readonly step?: (state: Readonly<GameState>, frame: unknown) => StepResult;
}

function createHarness(options: HarnessOptions = {}) {
  const environment = new FakeEnvironment();
  const audio = new FakeAudio();
  const controller = createKtsSessionController({
    seed: 1,
    step: options.step as never,
  });
  const canvas = fakeCanvas();
  const context = fakeContext();
  const adapter = createKtsBrowserRuntimeAdapter({
    controller,
    canvas,
    context,
    audio,
    environment,
  });

  return { adapter, controller, canvas, context, environment, audio };
}

class FakeEnvironment implements KtsBrowserEnvironment {
  hidden = false;
  reducedMotion = false;
  viewport = {
    cssWidth: 960,
    cssHeight: 720,
    devicePixelRatio: 1,
  };

  private currentTime = 0;
  private nextFrameHandle = 1;
  private readonly frames = new Map<number, FrameRequestCallback>();
  private readonly windowListeners = new Map<string, Set<EventListener>>();
  private readonly documentListeners = new Map<string, Set<EventListener>>();
  private readonly reducedMotionListeners = new Set<() => void>();

  requestAnimationFrame(callback: FrameRequestCallback): number {
    const handle = this.nextFrameHandle;
    this.nextFrameHandle += 1;
    this.frames.set(handle, callback);
    return handle;
  }

  cancelAnimationFrame(handle: number): void {
    this.frames.delete(handle);
  }

  now(): number {
    return this.currentTime;
  }

  getDocumentHidden(): boolean {
    return this.hidden;
  }

  getReducedMotion(): boolean {
    return this.reducedMotion;
  }

  getViewport(): {
    readonly cssWidth: number;
    readonly cssHeight: number;
    readonly devicePixelRatio: number;
  } {
    return Object.freeze({ ...this.viewport });
  }

  addWindowListener(type: string, listener: EventListener): void {
    this.addListener(this.windowListeners, type, listener);
  }

  removeWindowListener(type: string, listener: EventListener): void {
    this.windowListeners.get(type)?.delete(listener);
  }

  addDocumentListener(type: string, listener: EventListener): void {
    this.addListener(this.documentListeners, type, listener);
  }

  removeDocumentListener(type: string, listener: EventListener): void {
    this.documentListeners.get(type)?.delete(listener);
  }

  subscribeReducedMotion(listener: () => void): () => void {
    this.reducedMotionListeners.add(listener);
    return (): void => {
      this.reducedMotionListeners.delete(listener);
    };
  }

  fireNext(timestampMs: number): void {
    const next = this.frames.entries().next().value as [number, FrameRequestCallback] | undefined;

    if (next === undefined) {
      throw new Error("No animation frame is scheduled.");
    }

    const [handle, callback] = next;
    this.frames.delete(handle);
    this.currentTime = timestampMs;
    callback(timestampMs);
  }

  pendingFrames(): number {
    return this.frames.size;
  }

  dispatchWindow(type: string, event: unknown = {}): void {
    for (const listener of this.windowListeners.get(type) ?? []) {
      listener(event as Event);
    }
  }

  dispatchDocument(type: string, event: unknown = {}): void {
    for (const listener of this.documentListeners.get(type) ?? []) {
      listener(event as Event);
    }
  }

  dispatchReducedMotion(): void {
    for (const listener of this.reducedMotionListeners) {
      listener();
    }
  }

  windowListenerCount(): number {
    return [...this.windowListeners.values()].reduce(
      (total, listeners) => total + listeners.size,
      0,
    );
  }

  documentListenerCount(): number {
    return [...this.documentListeners.values()].reduce(
      (total, listeners) => total + listeners.size,
      0,
    );
  }

  private addListener(
    collection: Map<string, Set<EventListener>>,
    type: string,
    listener: EventListener,
  ): void {
    const listeners = collection.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    collection.set(type, listeners);
  }
}

class FakeAudio implements KtsProceduralAudio {
  unlockCalls = 0;
  suspendCalls = 0;
  consumeCalls = 0;
  disposeCalls = 0;
  lastConsumed: readonly Readonly<EngineEvent>[] = [];

  private status: KtsAudioSnapshot["status"] = "locked";
  private muted = false;
  private masterVolume = 0.55;
  private disposed = false;

  async unlock(): Promise<KtsAudioSnapshot> {
    this.unlockCalls += 1;
    this.status = "ready";
    return this.snapshot();
  }

  async suspend(): Promise<KtsAudioSnapshot> {
    this.suspendCalls += 1;
    this.status = "suspended";
    return this.snapshot();
  }

  setMuted(muted: boolean): KtsAudioSnapshot {
    this.muted = muted;
    return this.snapshot();
  }

  setMasterVolume(volume: number): KtsAudioSnapshot {
    this.masterVolume = volume;
    return this.snapshot();
  }

  consume(events: readonly Readonly<EngineEvent>[]): readonly never[] {
    this.consumeCalls += 1;
    this.lastConsumed = events;
    return Object.freeze([]);
  }

  async dispose(): Promise<KtsAudioSnapshot> {
    this.disposeCalls += 1;
    this.status = "disposed";
    this.disposed = true;
    return this.snapshot();
  }

  snapshot(): KtsAudioSnapshot {
    return Object.freeze({
      status: this.status,
      muted: this.muted,
      masterVolume: this.masterVolume,
      contextCreated: this.status !== "locked",
      cuesAccepted: 0,
      cuesPlayed: 0,
      lastCue: null,
      disposed: this.disposed,
    });
  }
}

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    clientWidth: 960,
    clientHeight: 720,
    parentElement: null,
    style: { width: "", height: "" },
    getContext: (): CanvasRenderingContext2D => fakeContext(),
    getBoundingClientRect: () => ({
      width: 960,
      height: 720,
    }),
  } as unknown as HTMLCanvasElement;
}

function fakeContext(): CanvasRenderingContext2D {
  const context: Record<string, unknown> = {};
  const methods = [
    "save",
    "restore",
    "setTransform",
    "clearRect",
    "fillRect",
    "strokeRect",
    "beginPath",
    "moveTo",
    "lineTo",
    "closePath",
    "stroke",
    "fill",
    "translate",
    "arc",
    "rect",
  ];

  for (const method of methods) {
    context[method] = vi.fn();
  }

  return context as unknown as CanvasRenderingContext2D;
}

function keyboardEvent(code: string) {
  return {
    code,
    repeat: false,
    preventDefault: vi.fn(),
  };
}

function eventStep(state: Readonly<GameState>): StepResult {
  const nextState = structuredClone(state) as GameState;
  nextState.tick += 1;

  const events: EngineEvent[] = [
    {
      type: "wave_started",
      tick: nextState.tick,
      waveNumber: 1,
      enemiesScheduled: 8,
    },
  ];

  return { state: nextState, events };
}

function quietStep(state: Readonly<GameState>): StepResult {
  const nextState = structuredClone(state) as GameState;
  nextState.tick += 1;

  return { state: nextState, events: [] };
}

function completionStep(state: Readonly<GameState>): StepResult {
  const nextState = structuredClone(state) as GameState;
  const finalWaveEnemyCount = ENGINE_CONSTANTS.WAVE_ENEMY_COUNTS[4];
  nextState.tick += 1;
  nextState.encounter = {
    phase: "complete",
    waveNumber: 5,
    phaseTicks: 0,
    spawnCooldownTicks: 0,
    enemiesScheduled: finalWaveEnemyCount,
    enemiesSpawned: finalWaveEnemyCount,
    enemiesDefeated: finalWaveEnemyCount,
    enemiesEscaped: 0,
    totalEnemiesDefeated: finalWaveEnemyCount,
    totalEnemiesEscaped: 0,
    nextEnemyId: finalWaveEnemyCount + 1,
    nextEnemyProjectileId: 1,
  };
  nextState.enemies = [];
  nextState.enemyProjectiles = [];

  return {
    state: nextState,
    events: [
      {
        type: "encounter_completed",
        tick: nextState.tick,
        totalEnemiesDefeated: nextState.encounter.totalEnemiesDefeated,
        totalEnemiesEscaped: nextState.encounter.totalEnemiesEscaped,
      },
    ],
  };
}

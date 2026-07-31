import type { PowerShiftAction } from "../engine";
import {
  configureKtsCanvas,
  createKtsPresentationFrame,
  createKtsProceduralAudio,
  projectKtsHud,
  renderKtsCanvas,
  type KtsAudioSnapshot,
  type KtsCanvasRenderSummary,
  type KtsHudViewModel,
  type KtsPresentationFrame,
  type KtsPresentationViewport,
  type KtsProceduralAudio,
} from "../presentation";
import type { HeldInputControl, KeyboardInputLike, KeyboardInputResult } from "./input-controller";
import type { KtsRuntimeSnapshot, KtsSessionController } from "./session-controller";

export const KTS_BROWSER_HUD_PUBLISH_INTERVAL_TICKS = 6;

export interface KtsBrowserKeyboardEvent extends KeyboardInputLike {
  preventDefault(): void;
}

export interface KtsBrowserEnvironment {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  now(): number;
  getDocumentHidden(): boolean;
  getReducedMotion(): boolean;
  getViewport(canvas: HTMLCanvasElement): KtsPresentationViewport;
  addWindowListener(type: "keydown" | "keyup" | "blur" | "resize", listener: EventListener): void;
  removeWindowListener(
    type: "keydown" | "keyup" | "blur" | "resize",
    listener: EventListener,
  ): void;
  addDocumentListener(type: "visibilitychange", listener: EventListener): void;
  removeDocumentListener(type: "visibilitychange", listener: EventListener): void;
  subscribeReducedMotion?(listener: () => void): () => void;
}

export interface KtsBrowserAdapterSnapshot {
  readonly mounted: boolean;
  readonly disposed: boolean;
  readonly animationFrameScheduled: boolean;
  readonly renderCount: number;
  readonly publicationCount: number;
  readonly reducedMotion: boolean;
  readonly viewport: KtsPresentationViewport;
  readonly runtime: KtsRuntimeSnapshot;
  readonly presentation: KtsPresentationFrame;
  readonly hud: KtsHudViewModel;
  readonly renderSummary: KtsCanvasRenderSummary | null;
  readonly audio: KtsAudioSnapshot;
}

export type KtsBrowserAdapterSubscriber = (snapshot: KtsBrowserAdapterSnapshot) => void;

export interface CreateKtsBrowserRuntimeAdapterOptions {
  readonly controller: KtsSessionController;
  readonly canvas: HTMLCanvasElement;
  readonly context?: CanvasRenderingContext2D;
  readonly audio?: KtsProceduralAudio;
  readonly environment?: KtsBrowserEnvironment;
}

export interface KtsBrowserRuntimeAdapter {
  mount(): KtsBrowserAdapterSnapshot;
  unmount(): KtsBrowserAdapterSnapshot;
  start(timestampMs?: number): KtsBrowserAdapterSnapshot;
  pause(): KtsBrowserAdapterSnapshot;
  resume(timestampMs?: number): KtsBrowserAdapterSnapshot;
  togglePause(timestampMs?: number): KtsBrowserAdapterSnapshot;
  restartSameSeed(timestampMs?: number): KtsBrowserAdapterSnapshot;
  restartWithSeed(seed: number, timestampMs?: number): KtsBrowserAdapterSnapshot;
  startReplay(timestampMs?: number): KtsBrowserAdapterSnapshot;
  exitReplay(): KtsBrowserAdapterSnapshot;
  pressHeld(control: HeldInputControl, sourceId: string): boolean;
  releaseHeld(control: HeldInputControl, sourceId: string): boolean;
  releaseSource(sourceId: string): boolean;
  queueRecoveryPulse(): boolean;
  queuePowerShift(powerShift: Readonly<PowerShiftAction>): boolean;
  unlockAudio(): Promise<KtsBrowserAdapterSnapshot>;
  setMuted(muted: boolean): KtsBrowserAdapterSnapshot;
  setMasterVolume(volume: number): KtsBrowserAdapterSnapshot;
  renderNow(): KtsBrowserAdapterSnapshot;
  subscribe(subscriber: KtsBrowserAdapterSubscriber): () => void;
  dispose(): Promise<KtsBrowserAdapterSnapshot>;
  snapshot(): KtsBrowserAdapterSnapshot;
}

export function createKtsBrowserRuntimeAdapter(
  options: CreateKtsBrowserRuntimeAdapterOptions,
): KtsBrowserRuntimeAdapter {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("Browser adapter options must be an object.");
  }

  if (typeof options.controller !== "object" || options.controller === null) {
    throw new TypeError("controller is required.");
  }

  if (typeof options.canvas !== "object" || options.canvas === null) {
    throw new TypeError("canvas is required.");
  }

  const environment = options.environment ?? createDefaultKtsBrowserEnvironment();
  const context = options.context ?? options.canvas.getContext("2d");

  if (context === null) {
    throw new Error("A Canvas 2D rendering context is required.");
  }

  const controller = options.controller;
  const canvas = options.canvas;
  const audio = options.audio ?? createKtsProceduralAudio();
  const subscribers = new Set<KtsBrowserAdapterSubscriber>();

  let mounted = false;
  let disposed = false;
  let frameHandle: number | null = null;
  let renderCount = 0;
  let publicationCount = 0;
  let reducedMotion = environment.getReducedMotion();
  let viewport = environment.getViewport(canvas);
  let runtime = controller.snapshot();
  let presentation = createKtsPresentationFrame(runtime, viewport, reducedMotion);
  let hud = projectKtsHud(presentation);
  let renderSummary: KtsCanvasRenderSummary | null = null;
  let lastPublishedTick = -KTS_BROWSER_HUD_PUBLISH_INTERVAL_TICKS;
  let lastPublicationSignature = "";
  let removeReducedMotionListener: (() => void) | null = null;

  const snapshot = (): KtsBrowserAdapterSnapshot =>
    Object.freeze({
      mounted,
      disposed,
      animationFrameScheduled: frameHandle !== null,
      renderCount,
      publicationCount,
      reducedMotion,
      viewport,
      runtime,
      presentation,
      hud,
      renderSummary,
      audio: audio.snapshot(),
    });

  const publish = (): KtsBrowserAdapterSnapshot => {
    publicationCount += 1;
    lastPublishedTick = runtime.currentState.tick;
    lastPublicationSignature = publicationSignature();
    const next = snapshot();

    for (const subscriber of subscribers) {
      subscriber(next);
    }

    return next;
  };

  const render = (forcePublish: boolean): KtsBrowserAdapterSnapshot => {
    runtime = controller.snapshot();
    reducedMotion = environment.getReducedMotion();
    viewport = environment.getViewport(canvas);
    configureKtsCanvas(canvas, viewport);
    presentation = createKtsPresentationFrame(runtime, viewport, reducedMotion);
    hud = projectKtsHud(presentation);
    renderSummary = renderKtsCanvas(context, presentation);
    renderCount += 1;
    audio.consume(runtime.recentEvents);

    if (forcePublish || shouldPublish()) {
      return publish();
    }

    return snapshot();
  };

  const scheduleAnimationFrame = (): void => {
    if (!mounted || disposed || frameHandle !== null || !isRuntimeActive(runtime)) {
      return;
    }

    frameHandle = environment.requestAnimationFrame(onAnimationFrame);
  };

  const cancelAnimationFrame = (): void => {
    if (frameHandle === null) {
      return;
    }

    environment.cancelAnimationFrame(frameHandle);
    frameHandle = null;
  };

  function onAnimationFrame(timestampMs: number): void {
    frameHandle = null;

    if (!mounted || disposed) {
      return;
    }

    runtime = controller.advance(timestampMs);
    render(false);
    scheduleAnimationFrame();
  }

  const onKeyDown: EventListener = (event): void => {
    const keyboardEvent = event as unknown as KtsBrowserKeyboardEvent;
    const result = controller.handleKeyDown(keyboardEvent, environment.now());
    applyKeyboardResult(keyboardEvent, result);

    if (result.handled) {
      render(true);
    }

    if (result.command === "toggle_pause") {
      reconcileAnimationFrame();
    }
  };

  const onKeyUp: EventListener = (event): void => {
    const keyboardEvent = event as unknown as KtsBrowserKeyboardEvent;
    const result = controller.handleKeyUp(keyboardEvent);
    applyKeyboardResult(keyboardEvent, result);

    if (result.handled) {
      render(true);
    }
  };

  const onBlur: EventListener = (): void => {
    controller.handleBlur();
    render(true);
  };

  const onResize: EventListener = (): void => {
    render(true);
  };

  const onVisibilityChange: EventListener = (): void => {
    const hidden = environment.getDocumentHidden();
    controller.setHidden(hidden, environment.now());

    if (hidden) {
      cancelAnimationFrame();
      void audio.suspend();
    }

    render(true);
    reconcileAnimationFrame();
  };

  const onReducedMotionChange = (): void => {
    reducedMotion = environment.getReducedMotion();
    render(true);
  };

  const mount = (): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();

    if (mounted) {
      return snapshot();
    }

    mounted = true;
    environment.addWindowListener("keydown", onKeyDown);
    environment.addWindowListener("keyup", onKeyUp);
    environment.addWindowListener("blur", onBlur);
    environment.addWindowListener("resize", onResize);
    environment.addDocumentListener("visibilitychange", onVisibilityChange);
    removeReducedMotionListener =
      environment.subscribeReducedMotion?.(onReducedMotionChange) ?? null;

    const next = render(true);
    scheduleAnimationFrame();
    return next;
  };

  const unmount = (): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();

    if (!mounted) {
      return snapshot();
    }

    cancelAnimationFrame();
    environment.removeWindowListener("keydown", onKeyDown);
    environment.removeWindowListener("keyup", onKeyUp);
    environment.removeWindowListener("blur", onBlur);
    environment.removeWindowListener("resize", onResize);
    environment.removeDocumentListener("visibilitychange", onVisibilityChange);
    removeReducedMotionListener?.();
    removeReducedMotionListener = null;
    mounted = false;
    return publish();
  };

  const start = (timestampMs = environment.now()): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    runtime = controller.start(timestampMs);
    const next = render(true);
    scheduleAnimationFrame();
    return next;
  };

  const pause = (): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    runtime = controller.pause("manual");
    cancelAnimationFrame();
    return render(true);
  };

  const resume = (timestampMs = environment.now()): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    runtime = controller.resume(timestampMs);
    const next = render(true);
    scheduleAnimationFrame();
    return next;
  };

  const togglePause = (timestampMs = environment.now()): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    runtime = controller.togglePause(timestampMs);
    reconcileAnimationFrame();
    return render(true);
  };

  const restartSameSeed = (timestampMs = environment.now()): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    runtime = controller.restartSameSeed(timestampMs);
    const next = render(true);
    scheduleAnimationFrame();
    return next;
  };

  const restartWithSeed = (
    seed: number,
    timestampMs = environment.now(),
  ): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    runtime = controller.restartWithSeed(seed, timestampMs);
    const next = render(true);
    scheduleAnimationFrame();
    return next;
  };

  const startReplay = (timestampMs = environment.now()): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    runtime = controller.startReplay(timestampMs);
    const next = render(true);
    scheduleAnimationFrame();
    return next;
  };

  const exitReplay = (): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    runtime = controller.exitReplay();
    cancelAnimationFrame();
    return render(true);
  };

  const pressHeld = (control: HeldInputControl, sourceId: string): boolean => {
    assertNotDisposed();
    const accepted = controller.pressHeld(control, sourceId);

    if (accepted) {
      render(true);
    }

    return accepted;
  };

  const releaseHeld = (control: HeldInputControl, sourceId: string): boolean => {
    assertNotDisposed();
    const accepted = controller.releaseHeld(control, sourceId);

    if (accepted) {
      render(true);
    }

    return accepted;
  };

  const releaseSource = (sourceId: string): boolean => {
    assertNotDisposed();
    const accepted = controller.releaseSource(sourceId);

    if (accepted) {
      render(true);
    }

    return accepted;
  };

  const queueRecoveryPulse = (): boolean => {
    assertNotDisposed();
    const accepted = controller.queueRecoveryPulse();

    if (accepted) {
      render(true);
    }

    return accepted;
  };

  const queuePowerShift = (powerShift: Readonly<PowerShiftAction>): boolean => {
    assertNotDisposed();
    const accepted = controller.queuePowerShift(powerShift);

    if (accepted) {
      render(true);
    }

    return accepted;
  };

  const unlockAudio = async (): Promise<KtsBrowserAdapterSnapshot> => {
    assertNotDisposed();
    await audio.unlock();
    return publish();
  };

  const setMuted = (muted: boolean): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    audio.setMuted(muted);
    return publish();
  };

  const setMasterVolume = (volume: number): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    audio.setMasterVolume(volume);
    return publish();
  };

  const renderNow = (): KtsBrowserAdapterSnapshot => {
    assertNotDisposed();
    return render(true);
  };

  const subscribe = (subscriber: KtsBrowserAdapterSubscriber): (() => void) => {
    assertNotDisposed();

    if (typeof subscriber !== "function") {
      throw new TypeError("subscriber must be a function.");
    }

    subscribers.add(subscriber);
    let subscribed = true;

    return (): void => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      subscribers.delete(subscriber);
    };
  };

  const dispose = async (): Promise<KtsBrowserAdapterSnapshot> => {
    if (disposed) {
      return snapshot();
    }

    if (mounted) {
      unmount();
    } else {
      cancelAnimationFrame();
    }

    runtime = controller.dispose();
    await audio.dispose();
    disposed = true;
    subscribers.clear();
    return snapshot();
  };

  function reconcileAnimationFrame(): void {
    runtime = controller.snapshot();

    if (isRuntimeActive(runtime)) {
      scheduleAnimationFrame();
    } else {
      cancelAnimationFrame();
    }
  }

  function shouldPublish(): boolean {
    const signature = publicationSignature();

    return (
      signature !== lastPublicationSignature ||
      runtime.currentState.tick - lastPublishedTick >= KTS_BROWSER_HUD_PUBLISH_INTERVAL_TICKS
    );
  }

  function publicationSignature(): string {
    const newestEvent = runtime.recentEvents.at(-1);
    const eventSignature =
      newestEvent === undefined ? "none" : `${newestEvent.tick}:${newestEvent.type}`;
    const replayFault =
      runtime.replayVerification !== null && !runtime.replayVerification.ok
        ? runtime.replayVerification.reason
        : "none";
    const audioSnapshot = audio.snapshot();

    return [
      runtime.lifecycle,
      runtime.timingInterrupted ? "interrupted" : "stable",
      replayFault,
      runtime.sessionRecord?.finalDigest ?? "no-digest",
      eventSignature,
      reducedMotion ? "reduced" : "full-motion",
      audioSnapshot.status,
      audioSnapshot.muted ? "muted" : "audible",
      String(audioSnapshot.masterVolume),
    ].join("|");
  }

  function assertNotDisposed(): void {
    if (disposed) {
      throw new Error("The browser runtime adapter has been disposed.");
    }
  }

  return Object.freeze({
    mount,
    unmount,
    start,
    pause,
    resume,
    togglePause,
    restartSameSeed,
    restartWithSeed,
    startReplay,
    exitReplay,
    pressHeld,
    releaseHeld,
    releaseSource,
    queueRecoveryPulse,
    queuePowerShift,
    unlockAudio,
    setMuted,
    setMasterVolume,
    renderNow,
    subscribe,
    dispose,
    snapshot,
  });
}

export function createDefaultKtsBrowserEnvironment(): KtsBrowserEnvironment {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("The default browser environment requires window and document.");
  }

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  return Object.freeze({
    requestAnimationFrame: (callback: FrameRequestCallback): number =>
      window.requestAnimationFrame(callback),
    cancelAnimationFrame: (handle: number): void => window.cancelAnimationFrame(handle),
    now: (): number => performance.now(),
    getDocumentHidden: (): boolean => document.hidden,
    getReducedMotion: (): boolean => reducedMotionQuery.matches,
    getViewport: (canvas: HTMLCanvasElement): KtsPresentationViewport => {
      const bounds = canvas.getBoundingClientRect();
      const cssWidth = positiveDimension(
        bounds.width,
        canvas.clientWidth,
        canvas.parentElement?.clientWidth,
      );
      const cssHeight = positiveDimension(
        bounds.height,
        canvas.clientHeight,
        canvas.parentElement?.clientHeight,
      );

      return Object.freeze({
        cssWidth,
        cssHeight,
        devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
      });
    },
    addWindowListener: (
      type: "keydown" | "keyup" | "blur" | "resize",
      listener: EventListener,
    ): void => window.addEventListener(type, listener),
    removeWindowListener: (
      type: "keydown" | "keyup" | "blur" | "resize",
      listener: EventListener,
    ): void => window.removeEventListener(type, listener),
    addDocumentListener: (type: "visibilitychange", listener: EventListener): void =>
      document.addEventListener(type, listener),
    removeDocumentListener: (type: "visibilitychange", listener: EventListener): void =>
      document.removeEventListener(type, listener),
    subscribeReducedMotion: (listener: () => void): (() => void) => {
      reducedMotionQuery.addEventListener("change", listener);
      return (): void => reducedMotionQuery.removeEventListener("change", listener);
    },
  });
}

function isRuntimeActive(snapshot: Readonly<KtsRuntimeSnapshot>): boolean {
  return snapshot.lifecycle === "playing" || snapshot.lifecycle === "replaying";
}

function applyKeyboardResult(
  event: Readonly<KtsBrowserKeyboardEvent>,
  result: Readonly<KeyboardInputResult>,
): void {
  if (result.preventDefault) {
    event.preventDefault();
  }
}

function positiveDimension(...candidates: readonly (number | undefined)[]): number {
  for (const candidate of candidates) {
    if (candidate !== undefined && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return 1;
}

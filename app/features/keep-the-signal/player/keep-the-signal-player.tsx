import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { PowerShiftAction } from "../engine";
import type { KtsHudMeter } from "../presentation";
import {
  createKtsBrowserRuntimeAdapter,
  createKtsSessionController,
  generateRuntimeSeed,
  type HeldInputControl,
  type KtsBrowserAdapterSnapshot,
  type KtsBrowserRuntimeAdapter,
} from "../runtime";
import {
  KTS_PLAYER_POWER_TRANSFERS,
  createKtsSeedEntryModel,
  deriveKtsPlayerActions,
  deriveKtsPlayerOverlay,
  describeKtsAudio,
  formatKtsCoherenceTicks,
  formatKtsPowerTransfer,
  ktsToneClass,
  type KtsPlayerOverlayModel,
} from "./player-surface-model";
import "./keep-the-signal-player.css";

export interface KeepTheSignalPlayerProps {
  readonly initialSeed: number;
  readonly seedNotice?: string | null;
}

export function KeepTheSignalPlayer({ initialSeed, seedNotice = null }: KeepTheSignalPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const adapterRef = useRef<KtsBrowserRuntimeAdapter | null>(null);
  const [snapshot, setSnapshot] = useState<KtsBrowserAdapterSnapshot | null>(null);
  const [seedInput, setSeedInput] = useState(String(initialSeed));
  const [seedMessage, setSeedMessage] = useState<string | null>(seedNotice);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null) {
      return;
    }

    const controller = createKtsSessionController({ seed: initialSeed });
    const adapter = createKtsBrowserRuntimeAdapter({ controller, canvas });
    adapterRef.current = adapter;
    const unsubscribe = adapter.subscribe(setSnapshot);
    setSnapshot(adapter.mount());

    return () => {
      unsubscribe();
      adapterRef.current = null;
      void adapter.dispose();
    };
  }, [initialSeed]);

  const actions = useMemo(
    () => (snapshot === null ? null : deriveKtsPlayerActions(snapshot)),
    [snapshot],
  );
  const overlay = useMemo(
    () => (snapshot === null ? null : deriveKtsPlayerOverlay(snapshot)),
    [snapshot],
  );

  const adapter = (): KtsBrowserRuntimeAdapter | null => adapterRef.current;

  const performOverlayAction = (action: KtsPlayerOverlayModel["primaryAction"] | "replay") => {
    const runtimeAdapter = adapter();

    if (runtimeAdapter === null) {
      return;
    }

    if (action === "start") {
      setSnapshot(runtimeAdapter.start());
    } else if (action === "resume") {
      setSnapshot(runtimeAdapter.resume());
    } else if (action === "restart") {
      setSnapshot(runtimeAdapter.restartSameSeed());
    } else if (action === "exit-replay") {
      setSnapshot(runtimeAdapter.exitReplay());
    } else {
      setSnapshot(runtimeAdapter.startReplay());
    }
  };

  const submitSeed = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const model = createKtsSeedEntryModel(seedInput);

    if (!model.canSubmit || model.normalizedSeed === null) {
      setSeedMessage(model.message);
      return;
    }

    const next = adapter()?.restartWithSeed(model.normalizedSeed);

    if (next !== undefined) {
      setSnapshot(next);
      setSeedInput(String(model.normalizedSeed));
      setSeedMessage(model.message);
    }
  };

  const generateSeed = () => {
    try {
      const seed = generateRuntimeSeed();
      const next = adapter()?.restartWithSeed(seed);

      if (next !== undefined) {
        setSnapshot(next);
        setSeedInput(String(seed));
        setSeedMessage("A new secure seed was generated.");
      }
    } catch (error) {
      setSeedMessage(error instanceof Error ? error.message : "Secure seed generation failed.");
    }
  };

  const pressHeld = (control: HeldInputControl, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    adapter()?.pressHeld(control, pointerSourceId(event.pointerId));
  };

  const releasePointerSource = (event: ReactPointerEvent<HTMLButtonElement>) => {
    adapter()?.releaseSource(pointerSourceId(event.pointerId));
  };

  const queuePowerShift = (powerShift: Readonly<PowerShiftAction>) => {
    adapter()?.queuePowerShift(powerShift);
  };

  return (
    <main id="main-content" className="kts-player-shell">
      <header className="kts-player-header">
        <a className="kts-player-header__mark" href="/" aria-label="Return to The Signal">
          <span aria-hidden="true">S</span>
          <span>
            <strong>The Signal</strong>
            <small>Keep the Signal / KTS-I3</small>
          </span>
        </a>

        <div className="kts-player-header__state" aria-label="Runtime state">
          <span className="kts-player-header__carrier" aria-hidden="true" />
          <span>{snapshot?.hud.lifecycleLabel ?? "Connecting"}</span>
        </div>
      </header>

      <section className="kts-player-intro" aria-labelledby="kts-player-title">
        <div>
          <p className="kts-player-kicker">BUILD 07 / DETERMINISTIC ARCADE SYSTEM</p>
          <h1 id="kts-player-title">Keep the Signal</h1>
        </div>

        <p>
          Preserve carrier coherence through five hostile waves. The model may propose strategy. The
          game system must prove it.
        </p>
      </section>

      {seedMessage !== null && (
        <p className="kts-seed-notice" role="status">
          {seedMessage}
        </p>
      )}

      <div className="kts-player-grid">
        <section className="kts-playfield-panel" aria-labelledby="kts-playfield-title">
          <div className="kts-panel-heading">
            <div>
              <p>LIVE FIELD</p>
              <h2 id="kts-playfield-title">Carrier boundary</h2>
            </div>
            <span>
              {snapshot === null ? "INITIALIZING" : `TICK ${snapshot.runtime.currentState.tick}`}
            </span>
          </div>

          <div className="kts-canvas-stage">
            <canvas
              ref={canvasRef}
              className="kts-canvas"
              aria-hidden="true"
              data-testid="kts-canvas"
            />

            {snapshot === null && (
              <div className="kts-canvas-loading" role="status">
                Establishing deterministic carrier…
              </div>
            )}

            {overlay !== null && snapshot !== null && (
              <KtsLifecycleOverlay
                model={overlay}
                canReplay={actions?.canReplay ?? false}
                onAction={performOverlayAction}
              />
            )}
          </div>

          <div className="kts-field-status" aria-label="Field status">
            <span>
              Seed <strong>{snapshot?.hud.seed ?? initialSeed}</strong>
            </span>
            <span>
              Engine <strong>{snapshot?.hud.engineVersion ?? "—"}</strong>
            </span>
            <span>
              Rules <strong>{snapshot?.hud.rulesetVersion ?? "—"}</strong>
            </span>
          </div>
        </section>

        <aside className="kts-hud" aria-labelledby="kts-hud-title">
          <div className="kts-panel-heading">
            <div>
              <p>AUTHORITATIVE STATE</p>
              <h2 id="kts-hud-title">Signal telemetry</h2>
            </div>
          </div>

          {snapshot === null ? (
            <p className="kts-hud__loading">Waiting for browser runtime.</p>
          ) : (
            <KtsHud snapshot={snapshot} />
          )}
        </aside>
      </div>

      <section className="kts-control-deck" aria-labelledby="kts-controls-title">
        <div className="kts-panel-heading kts-panel-heading--wide">
          <div>
            <p>OPERATOR INPUT</p>
            <h2 id="kts-controls-title">Control deck</h2>
          </div>
          <span>WASD / ARROWS · SPACE · R · 1–6 · ESC/P</span>
        </div>

        <div className="kts-control-grid">
          <div className="kts-direction-cluster" aria-label="Movement controls">
            <HeldControlButton
              label="Move up"
              symbol="↑"
              control="up"
              className="kts-direction-button--up"
              disabled={!actions?.canControlShip}
              onPress={pressHeld}
              onRelease={releasePointerSource}
            />
            <HeldControlButton
              label="Move left"
              symbol="←"
              control="left"
              className="kts-direction-button--left"
              disabled={!actions?.canControlShip}
              onPress={pressHeld}
              onRelease={releasePointerSource}
            />
            <HeldControlButton
              label="Move right"
              symbol="→"
              control="right"
              className="kts-direction-button--right"
              disabled={!actions?.canControlShip}
              onPress={pressHeld}
              onRelease={releasePointerSource}
            />
            <HeldControlButton
              label="Move down"
              symbol="↓"
              control="down"
              className="kts-direction-button--down"
              disabled={!actions?.canControlShip}
              onPress={pressHeld}
              onRelease={releasePointerSource}
            />
            <span className="kts-direction-cluster__core" aria-hidden="true">
              MOVE
            </span>
          </div>

          <div className="kts-primary-controls">
            <HeldControlButton
              label="Fire"
              symbol="FIRE"
              control="fire"
              className="kts-control-button--fire"
              disabled={!actions?.canControlShip}
              onPress={pressHeld}
              onRelease={releasePointerSource}
            />

            <button
              type="button"
              className="kts-control-button"
              disabled={!actions?.canQueueRecovery}
              onClick={() => adapter()?.queueRecoveryPulse()}
            >
              <span>R</span>
              Recovery pulse
            </button>

            <button
              type="button"
              className="kts-control-button"
              disabled={!actions?.canPause && !actions?.canResume}
              onClick={() => setSnapshot(adapter()?.togglePause() ?? snapshot)}
            >
              <span>P</span>
              {actions?.canResume ? "Resume" : "Pause"}
            </button>
          </div>

          <div className="kts-power-controls" aria-labelledby="kts-power-controls-title">
            <h3 id="kts-power-controls-title">Power transfer</h3>
            <div>
              {KTS_PLAYER_POWER_TRANSFERS.map((transfer) => (
                <button
                  type="button"
                  key={transfer.key}
                  disabled={!actions?.canQueuePowerShift}
                  onClick={() => queuePowerShift(transfer)}
                  aria-label={`Power transfer ${formatKtsPowerTransfer(transfer)}`}
                >
                  <span>{transfer.key}</span>
                  {formatKtsPowerTransfer(transfer)}
                </button>
              ))}
            </div>
          </div>

          <div className="kts-session-controls">
            <h3>Session</h3>
            <div className="kts-session-actions">
              {actions?.canStart && (
                <button type="button" onClick={() => setSnapshot(adapter()?.start() ?? snapshot)}>
                  Begin transmission
                </button>
              )}
              {actions?.canRestart && (
                <button
                  type="button"
                  onClick={() => setSnapshot(adapter()?.restartSameSeed() ?? snapshot)}
                >
                  Restart same seed
                </button>
              )}
              {actions?.canReplay && (
                <button
                  type="button"
                  onClick={() => setSnapshot(adapter()?.startReplay() ?? snapshot)}
                >
                  Start replay
                </button>
              )}
              {actions?.canExitReplay && (
                <button
                  type="button"
                  onClick={() => setSnapshot(adapter()?.exitReplay() ?? snapshot)}
                >
                  Exit replay
                </button>
              )}
            </div>

            <form className="kts-seed-form" onSubmit={submitSeed} noValidate>
              <label htmlFor="kts-seed-input">Seed</label>
              <div>
                <input
                  id="kts-seed-input"
                  name="seed"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={seedInput}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSeedInput(event.currentTarget.value)
                  }
                  aria-describedby="kts-seed-help"
                />
                <button type="submit">Load</button>
                <button type="button" onClick={generateSeed}>
                  Secure random
                </button>
              </div>
              <p id="kts-seed-help">Unsigned 32-bit decimal integer. Seed 0 is normalized.</p>
            </form>
          </div>

          <div className="kts-audio-controls">
            <h3>Procedural audio</h3>
            <p>{snapshot === null ? "Audio waiting" : describeKtsAudio(snapshot.audio)}</p>
            <div>
              <button
                type="button"
                disabled={snapshot?.audio.status === "unavailable"}
                onClick={() => void adapter()?.unlockAudio().then(setSnapshot)}
              >
                Enable audio
              </button>
              <button
                type="button"
                disabled={snapshot === null || snapshot.audio.status === "disposed"}
                onClick={() =>
                  setSnapshot(adapter()?.setMuted(!(snapshot?.audio.muted ?? false)) ?? snapshot)
                }
              >
                {snapshot?.audio.muted ? "Unmute" : "Mute"}
              </button>
            </div>
            <label htmlFor="kts-volume">Master volume</label>
            <input
              id="kts-volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={snapshot?.audio.masterVolume ?? 0.35}
              disabled={snapshot === null || snapshot.audio.status === "disposed"}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setSnapshot(
                  adapter()?.setMasterVolume(Number(event.currentTarget.value)) ?? snapshot,
                )
              }
            />
          </div>
        </div>
      </section>

      <section className="kts-instructions" aria-labelledby="kts-instructions-title">
        <div>
          <p className="kts-player-kicker">OPERATING NOTE</p>
          <h2 id="kts-instructions-title">Keep coherence above collapse.</h2>
        </div>
        <div>
          <p>
            Weapons destroy hostiles. Defence absorbs kinetic damage. Signal resists corruption and
            determines whether the carrier survives.
          </p>
          <p>
            Power is conserved at 100 units. Shift five units between channels, use the recovery
            pulse carefully, and remember that a hidden tab never resumes on its own.
          </p>
        </div>
      </section>

      {snapshot !== null && (
        <>
          <p className="kts-sr-only" role="status" aria-live="polite" aria-atomic="true">
            {snapshot.hud.latestAnnouncement ?? ""}
          </p>
          <p className="kts-sr-only">{snapshot.hud.accessibleSummary}</p>
        </>
      )}
    </main>
  );
}

function KtsHud({ snapshot }: { readonly snapshot: KtsBrowserAdapterSnapshot }) {
  const hud = snapshot.hud;

  return (
    <>
      <div className="kts-integrity-grid">
        <HudMeter label="Signal" meter={hud.signal} tone="signal" />
        <HudMeter label="Defence" meter={hud.defence} tone="defence" />
      </div>

      <dl className="kts-readout-grid">
        <div>
          <dt>Score</dt>
          <dd>{hud.score.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt>Wave</dt>
          <dd>
            {hud.encounter.waveNumber}/{hud.encounter.waveCount}
          </dd>
        </div>
        <div>
          <dt>Phase</dt>
          <dd>{hud.encounter.phaseLabel}</dd>
        </div>
        <div>
          <dt>Resolved</dt>
          <dd>
            {hud.encounter.enemiesResolved}/{hud.encounter.enemiesScheduled}
          </dd>
        </div>
        <div>
          <dt>Coherence</dt>
          <dd>{formatKtsCoherenceTicks(hud.currentCoherenceTicks)}</dd>
        </div>
        <div>
          <dt>Longest</dt>
          <dd>{formatKtsCoherenceTicks(hud.longestCoherenceTicks)}</dd>
        </div>
      </dl>

      <section className="kts-power-readout" aria-labelledby="kts-power-title">
        <div>
          <h3 id="kts-power-title">Power allocation</h3>
          <span>{hud.power.total}/100</span>
        </div>
        <dl>
          <div>
            <dt>Weapons</dt>
            <dd>{hud.power.weapons}</dd>
          </div>
          <div>
            <dt>Defence</dt>
            <dd>{hud.power.defence}</dd>
          </div>
          <div>
            <dt>Signal</dt>
            <dd>{hud.power.signal}</dd>
          </div>
        </dl>
      </section>

      <section className="kts-cooldowns" aria-labelledby="kts-cooldowns-title">
        <h3 id="kts-cooldowns-title">System readiness</h3>
        <div>
          <Cooldown
            label="Weapons"
            ready={hud.weaponCooldown.ready}
            ratio={hud.weaponCooldown.ratio}
          />
          <Cooldown
            label="Recovery"
            ready={hud.recoveryCooldown.ready}
            ratio={hud.recoveryCooldown.ratio}
          />
          <Cooldown
            label="Transfer"
            ready={hud.power.shiftCooldown.ready}
            ratio={hud.power.shiftCooldown.ratio}
          />
        </div>
      </section>

      <section className="kts-event-feed" aria-labelledby="kts-event-feed-title">
        <div>
          <h3 id="kts-event-feed-title">Recent events</h3>
          <span>{hud.recentEvents.length}/12</span>
        </div>
        {hud.recentEvents.length === 0 ? (
          <p>No meaningful events recorded.</p>
        ) : (
          <ol>
            {[...hud.recentEvents].reverse().map((event) => (
              <li className={ktsToneClass(event.tone)} key={event.id}>
                <span>{event.tick}</span>
                <p>{event.label}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {(hud.finalDigest !== null || hud.replayFault !== null) && (
        <section className="kts-evidence" aria-labelledby="kts-evidence-title">
          <h3 id="kts-evidence-title">Run evidence</h3>
          {hud.finalDigest !== null && (
            <p>
              Digest <code>{hud.finalDigest}</code>
            </p>
          )}
          {hud.replayFault !== null && <p className="kts-tone--danger">{hud.replayFault}</p>}
        </section>
      )}
    </>
  );
}

function HudMeter({
  label,
  meter,
  tone,
}: {
  readonly label: string;
  readonly meter: KtsHudMeter;
  readonly tone: "signal" | "defence";
}) {
  return (
    <div className={`kts-meter kts-meter--${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{meter.percent}%</strong>
      </div>
      <div
        className="kts-meter__track"
        role="meter"
        aria-label={`${label} integrity`}
        aria-valuemin={0}
        aria-valuemax={meter.maximum}
        aria-valuenow={meter.value}
        aria-valuetext={`${meter.percent} percent`}
      >
        <span style={{ transform: `scaleX(${meter.ratio})` }} />
      </div>
    </div>
  );
}

function Cooldown({
  label,
  ready,
  ratio,
}: {
  readonly label: string;
  readonly ready: boolean;
  readonly ratio: number;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{ready ? "READY" : "CHARGING"}</strong>
      <span className="kts-cooldown-track" aria-hidden="true">
        <span style={{ transform: `scaleX(${1 - ratio})` }} />
      </span>
    </div>
  );
}

function KtsLifecycleOverlay({
  model,
  canReplay,
  onAction,
}: {
  readonly model: KtsPlayerOverlayModel;
  readonly canReplay: boolean;
  readonly onAction: (action: KtsPlayerOverlayModel["primaryAction"] | "replay") => void;
}) {
  const secondaryAction = model.secondaryAction;

  return (
    <div
      className={`kts-lifecycle-overlay ${ktsToneClass(model.tone)}`}
      role="dialog"
      aria-modal="false"
      aria-label={model.title}
    >
      <p>{model.eyebrow}</p>
      <h2>{model.title}</h2>
      <p>{model.description}</p>
      <div>
        <button type="button" onClick={() => onAction(model.primaryAction)}>
          {model.primaryLabel}
        </button>
        {secondaryAction !== null && model.secondaryLabel !== null && (
          <button
            type="button"
            disabled={secondaryAction === "replay" && !canReplay}
            onClick={() => onAction(secondaryAction)}
          >
            {model.secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function HeldControlButton({
  label,
  symbol,
  control,
  className,
  disabled,
  onPress,
  onRelease,
}: {
  readonly label: string;
  readonly symbol: string;
  readonly control: HeldInputControl;
  readonly className: string;
  readonly disabled: boolean | undefined;
  readonly onPress: (
    control: HeldInputControl,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  readonly onRelease: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`kts-direction-button ${className}`}
      disabled={disabled}
      aria-label={label}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => onPress(control, event)}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onContextMenu={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}
    >
      {symbol}
    </button>
  );
}

function pointerSourceId(pointerId: number): string {
  return `pointer:${pointerId}`;
}

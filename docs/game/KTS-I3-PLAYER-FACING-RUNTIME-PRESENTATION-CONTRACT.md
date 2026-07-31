# Keep the Signal — KTS-I3 Player-Facing Runtime and Presentation Contract

**Document ID:** `KTS-I3-CONTRACT`
**Project:** The Signal
**Subsystem:** Keep the Signal
**Release:** `KTS-I3`
**Title:** Player-Facing Runtime and Presentation Integration
**Status:** Accepted by Nolan and Byte
**Contract acceptance:** `ACCEPT KTS-I3 CONTRACT`
**Acceptance timestamp:** `2026-07-31T10:37:00+02:00`
**Implementation authorized:** No
**Base branch:** `main`
**Base commit:** `7a49a0bec25deb6d05e0911b4057bca72fe67a8f`
**Target implementation branch:** `game/keep-the-signal-i3-player-runtime`
**Predecessor:** `KTS-I2 — Deterministic Encounter System`
**Accepted predecessor commit:** `a97c7fb5cc23838dcac51a9c6b4efdef6243afc2`

---

## 1. Purpose

KTS-I3 creates the first complete player-facing runtime for **Keep the Signal**.

KTS-I1 established the deterministic fixed-step engine.

KTS-I2 established the deterministic encounter system.

KTS-I3 connects that accepted engine to:

- a browser-owned fixed-step runtime;
- deterministic player-input translation;
- a dedicated game route;
- a durable visual renderer;
- an accessible heads-up display;
- keyboard, pointer, and touch controls;
- pause, restart, completion, and terminal-state flows;
- event-driven procedural audio;
- an in-memory deterministic replay;
- player-visible seed and digest evidence.

KTS-I3 must make the accepted game engine genuinely playable without transferring gameplay authority to React, the browser frame rate, the renderer, audio, or wall-clock timing.

> The model may propose strategy. The game system must prove it.

For KTS-I3:

> The browser may collect input and present state. The deterministic engine must remain the sole authority over gameplay.

This document defines the accepted contract for KTS-I3. It does not authorize implementation by itself.

---

## 2. Current architectural context

At the KTS-I3 base commit:

- the application is a React Router 8 application deployed through Cloudflare;
- the public site exposes one index route;
- the home page presents Keep the Signal as a dormant module coordinate;
- the hero owns a separate visual-only WebGL animation loop;
- the accepted game engine is fully headless;
- the engine accepts one `TickFrame` per authoritative tick;
- the engine exposes structured events and canonical state;
- no external game framework or rendering dependency is installed;
- the complete repository test total is 210 passing tests;
- the KTS-I2 permanent 7,200-frame fixture digest is `58211ef2`.

KTS-I3 must integrate with this architecture rather than replace it.

The existing hero renderer, audio source, landing-page composition, and hero stash are outside the KTS-I3 implementation scope.

---

## 3. Product outcome

After KTS-I3, a visitor must be able to:

1. enter Keep the Signal from the home page;
2. understand the objective and controls;
3. start a deterministic run;
4. move the player craft;
5. fire;
6. apply all six legal directed power transfers;
7. activate the recovery pulse;
8. observe enemies, projectiles, damage, power, Signal, Defence, waves, score, and coherence;
9. pause and resume;
10. complete the five-wave encounter or reach Signal collapse;
11. inspect the seed and final digest;
12. restart the same seed;
13. start a new seed;
14. replay the completed run from its recorded tick frames;
15. use the experience with keyboard, pointer, or touch;
16. use a reduced-motion presentation;
17. use the game without an internet connection after the application has loaded.

The KTS-I3 experience must feel like a production-minded first playable release, not a temporary developer harness.

---

## 4. Core architectural doctrine

### 4.1 Engine authority

The accepted engine remains authoritative over:

- movement;
- velocity;
- projectile creation;
- projectile motion;
- enemy spawning;
- enemy movement;
- enemy firing;
- collisions;
- damage;
- recovery;
- power allocation;
- cooldowns;
- score;
- coherence;
- wave progression;
- encounter completion;
- Signal collapse;
- terminal state;
- seeded randomness;
- canonical state;
- final digest.

The runtime and presentation layers must never independently determine or correct these outcomes.

### 4.2 Presentation non-authority

The renderer may:

- interpolate already accepted positions;
- animate event-derived effects;
- display state;
- display input intent;
- display cooldown progress;
- display recent engine events;
- play sounds derived from engine events.

The renderer must not:

- move entities;
- resolve collisions;
- infer damage;
- create enemies;
- create projectiles;
- change integrity;
- change power;
- change score;
- change cooldowns;
- advance waves;
- create engine events;
- modify engine state.

### 4.3 Deterministic input boundary

Browser input is not sent directly into mutable game state.

Browser input must be normalized into exact `TickFrame` values.

For the same:

- engine version;
- ruleset version;
- seed;
- ordered tick-frame sequence;

the authoritative state, event sequence, canonical state, and digest must remain identical.

### 4.4 Separation from the hero

The existing hero animation loop is a public-site visual system.

The KTS-I3 runtime must:

- use its own route;
- use its own game loop;
- use its own renderer;
- use its own audio controller;
- not import hero renderer internals;
- not reuse hero pointer-tracking state;
- not modify hero timing;
- not apply the hero stash;
- not make the hero responsible for game lifecycle.

Visual principles may be shared through design tokens, but runtime ownership must remain separate.

---

## 5. Route and navigation contract

### 5.1 Dedicated route

KTS-I3 must add:

```text
/keep-the-signal
```

The route must be registered through the existing React Router route configuration.

### 5.2 Home-page module activation

The home-page Keep the Signal module must change from a dormant coordinate into an active destination.

Required changes:

- module state changes from `dormant` to `online`;
- description states that the deterministic encounter is playable;
- the card or its explicit action links to `/keep-the-signal`;
- the card remains visually consistent with the existing module index;
- Archive, Dev-Journal, and Transmissions behaviour remains unchanged.

### 5.3 Game-route metadata

The game route must define:

- page title;
- description;
- Open Graph title;
- Open Graph description;
- canonical game identity appropriate to The Signal.

### 5.4 Return path

The game route must provide a clear route back to `/`.

Leaving the route must cleanly dispose of:

- animation frames;
- input listeners;
- audio context ownership;
- resize observers;
- game-loop state;
- pending effects.

---

## 6. Runtime state model

KTS-I3 must define a browser-session state separate from `GameState`.

Minimum runtime lifecycle:

```text
idle
playing
paused
completed
terminal
replaying
```

### 6.1 Idle

In `idle`:

- no authoritative ticks advance;
- the seed is visible;
- the objective is visible;
- controls are visible;
- the player may start the run;
- audio remains inactive until a user gesture.

### 6.2 Playing

In `playing`:

- the fixed-step accumulator advances the engine;
- live player input is sampled;
- accepted tick frames are appended to the session record;
- current and previous authoritative states are retained for rendering;
- engine events are passed to presentation adapters.

### 6.3 Paused

In `paused`:

- no authoritative tick advances;
- the current state remains visible;
- input state is cleared;
- queued one-shot actions are cleared;
- audio is suspended or silenced;
- the user may resume, restart, return home, or replay an already completed record.

### 6.4 Completed

`completed` is entered when:

```text
gameState.encounter.phase === "complete"
```

The engine remains `running`; the browser runtime identifies encounter completion as the end of the playable KTS-I3 run.

In `completed`:

- no further authoritative ticks advance;
- the final digest is displayed;
- the seed is displayed;
- final score and coherence are displayed;
- defeated and escaped totals are displayed;
- same-seed restart is available;
- new-seed restart is available;
- deterministic replay is available.

### 6.5 Terminal

`terminal` is entered when:

```text
gameState.status === "terminal"
```

In `terminal`:

- no further authoritative ticks advance;
- Signal collapse is presented clearly;
- the final digest is displayed;
- restart and replay actions remain available.

### 6.6 Replaying

In `replaying`:

- recorded `TickFrame` values are fed to a new engine state created with the recorded seed;
- live gameplay input is disabled;
- pause and exit-replay remain available;
- the replay must produce the same final canonical state and digest as the recorded run;
- replay failure must be surfaced as a deterministic-integrity fault, not silently ignored.

---

## 7. Fixed-step browser loop

### 7.1 Authoritative frequency

The runtime must drive the accepted engine at:

```text
60 authoritative ticks per second
```

The tick duration is:

```text
1000 / 60 milliseconds
```

### 7.2 Clock source

`requestAnimationFrame` and `performance.now()` may be used only by the browser runtime.

They may schedule when ticks are processed.

They must not enter authoritative state or engine calculations.

### 7.3 Accumulator

The runtime must use an accumulator:

```text
elapsed wall time
    -> accumulator
    -> zero or more fixed engine ticks
    -> interpolation fraction
    -> one render
```

### 7.4 No tick fabrication

Every authoritative advancement must call `stepGame` exactly once with exactly one normalized `TickFrame`.

The runtime must not:

- combine multiple logical ticks into one engine call;
- call `stepGame` with fractional time;
- skip an accepted queued tick;
- advance state from rendering code.

### 7.5 Backlog control

The runtime must prevent an uncontrolled spiral of death.

Required behaviour:

- process at most 8 authoritative ticks during one animation-frame callback;
- retain unprocessed accumulator time rather than inventing a state jump;
- if backlog reaches 120 ticks, enter `paused`;
- show a timing-interruption notice;
- clear held input before resume;
- never silently discard authoritative ticks while a session remains in `playing`.

### 7.6 Tab visibility

When `document.visibilityState` becomes `hidden`:

- the runtime must automatically pause;
- held input must be cleared;
- one-shot input queues must be cleared;
- audio must suspend;
- no background ticks may advance.

The user must explicitly resume after returning.

### 7.7 Focus loss

On window blur:

- held input must be cleared immediately;
- queued one-shot actions must be cleared;
- the session may continue only if the document remains visible;
- movement must not become stuck.

---

## 8. Input contract

### 8.1 Input classes

Inputs are divided into:

**Held inputs**

- horizontal movement;
- vertical movement;
- fire.

**One-shot inputs**

- recovery pulse;
- one directed power shift;
- pause/resume;
- restart;
- replay control.

### 8.2 Tick sampling

At each authoritative tick:

- held movement state becomes `moveX` and `moveY`;
- held fire state becomes `fire`;
- at most one queued recovery pulse is consumed;
- at most one queued power shift is consumed;
- `environmentEvents` is an empty array in KTS-I3.

### 8.3 Opposing movement keys

If opposing movement directions are simultaneously active:

- left and right resolve to `0`;
- up and down resolve to `0`.

Last-key-wins behaviour is prohibited because it is more difficult to reproduce consistently across keyboard, pointer, and touch sources.

### 8.4 One-shot queue bounds

The runtime must prevent unbounded input accumulation.

Maximum queued one-shot actions:

- recovery pulse: 1;
- power shifts: 6.

When the queue is full, additional browser actions are ignored by the input adapter.

The engine remains responsible for accepting or rejecting the resulting legal action.

### 8.5 Keyboard mapping

Required keyboard controls:

| Action            | Primary  | Alternate    |
| ----------------- | -------- | ------------ |
| Move left         | `A`      | `ArrowLeft`  |
| Move right        | `D`      | `ArrowRight` |
| Move up           | `W`      | `ArrowUp`    |
| Move down         | `S`      | `ArrowDown`  |
| Fire              | `Space`  | —            |
| Recovery pulse    | `R`      | —            |
| Pause/resume      | `Escape` | `P`          |
| Defence → Weapons | `1`      | —            |
| Signal → Weapons  | `2`      | —            |
| Weapons → Defence | `3`      | —            |
| Signal → Defence  | `4`      | —            |
| Weapons → Signal  | `5`      | —            |
| Defence → Signal  | `6`      | —            |

Keyboard events must use `KeyboardEvent.code`, not locale-dependent printable characters.

Repeated keydown events must not enqueue repeated one-shot actions.

### 8.6 Pointer controls

The HUD must expose explicit pointer-operable controls for:

- all six directed power shifts;
- recovery pulse;
- pause/resume;
- start;
- restart same seed;
- new seed;
- replay;
- return home;
- mute/unmute.

Pointer controls must not require hover.

### 8.7 Touch controls

When a coarse pointer is detected, the game must expose:

- a directional pad;
- a fire control supporting press-and-hold;
- a recovery-pulse button;
- a compact power-routing panel;
- pause control.

Touch controls must support pointer capture and must clear state on:

- pointer up;
- pointer cancel;
- visibility change;
- route unmount.

### 8.8 Browser-default prevention

While the game surface has active play focus:

- arrow-key scrolling must be prevented;
- Space scrolling must be prevented;
- browser shortcuts unrelated to game controls must remain unaffected;
- input prevention must not apply globally when the user is outside the game surface.

---

## 9. Seed contract

### 9.1 Session seed

Every run must have an explicit unsigned 32-bit seed.

The seed must be:

- visible before the run;
- visible during pause;
- visible at completion or terminal state;
- included in the in-memory replay record.

### 9.2 Seed sources

The player may:

- enter a seed manually;
- restart the current seed;
- request a new seed.

A new seed may be created in the browser runtime using:

```text
crypto.getRandomValues
```

`Math.random` is prohibited.

### 9.3 URL seed

The game route must accept:

```text
/keep-the-signal?seed=<unsigned-32-bit-integer>
```

Invalid seeds must:

- not reach the engine;
- produce an accessible validation message;
- fall back only after explicit user action.

### 9.4 Determinism boundary

Browser seed generation is non-authoritative setup.

Once the seed is supplied to `createInitialGameState`, all game randomness must continue through the accepted seeded engine RNG only.

---

## 10. In-memory session and replay record

### 10.1 Session record

KTS-I3 must maintain an in-memory record:

```ts
interface KtsSessionRecord {
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly seed: number;
  readonly frames: readonly TickFrame[];
  readonly finalCanonicalState: string | null;
  readonly finalDigest: string | null;
  readonly outcome: "completed" | "terminal" | null;
}
```

Equivalent naming is permitted if the semantics remain exact.

### 10.2 Recording rule

Exactly one normalized `TickFrame` must be recorded for every accepted live authoritative tick.

The record must not contain:

- render frames;
- wall-clock timestamps;
- pointer coordinates;
- DOM events;
- audio state;
- interpolation values.

### 10.3 Replay proof

At replay completion:

- replay final canonical state must equal recorded final canonical state;
- replay final digest must equal recorded final digest;
- mismatch enters a visible integrity-fault state;
- mismatch must fail automated tests.

### 10.4 Persistence boundary

KTS-I3 replay is memory-only.

Deferred:

- localStorage;
- IndexedDB;
- D1;
- R2;
- replay downloads;
- replay uploads;
- shared replay URLs;
- historical run archive.

The runtime architecture must not prevent these future capabilities.

---

## 11. Renderer contract

### 11.1 Technology

The first player-facing renderer must use:

```text
HTML Canvas 2D
```

No game-rendering dependency is authorized.

Canvas 2D is accepted as a durable production renderer for the initial retro-vector presentation, not as a throwaway prototype.

### 11.2 Renderer boundary

The renderer receives a presentation frame containing:

- previous authoritative state;
- current authoritative state;
- interpolation alpha;
- recent engine events;
- runtime lifecycle;
- reduced-motion state;
- viewport dimensions.

It must not receive a mutable engine controller.

### 11.3 World projection

The authoritative world remains:

```text
0..1,000,000 on both axes
```

The renderer must:

- preserve world proportions;
- use one canonical world-to-screen transform;
- letterbox as necessary;
- center the playable field;
- expose the field boundary;
- use device-pixel-ratio scaling;
- cap rendering DPR at 2.

### 11.4 Interpolation

Interpolation may be applied only to visible positions:

- player;
- enemies;
- player projectiles;
- enemy projectiles.

Required rules:

- match entities by stable ID;
- interpolate between previous and current positions;
- spawned entities render at current position;
- removed entities are absent from authoritative geometry;
- event-derived destruction effects may outlive the removed entity visually;
- integrity, score, wave, cooldowns, and power use current authoritative values;
- interpolation alpha is clamped to `0..1`.

### 11.5 Visual effects

Permitted event-derived effects include:

- projectile flashes;
- impact rings;
- destruction fragments;
- corruption distortion;
- Defence hit pulse;
- Signal collapse warning;
- wave-start transmission;
- wave-complete sweep;
- encounter-complete convergence.

Effects must be:

- bounded in duration;
- bounded in count;
- derived from structured engine events;
- presentation-only;
- absent or simplified under reduced motion.

### 11.6 Visual identity

KTS-I3 must extend The Signal’s established visual language:

- deep black field;
- warm off-white system text;
- cyan/teal Signal accents;
- restrained red or amber danger accents;
- vector-grid or instrument-panel character;
- retro-computing typography;
- controlled glow;
- minimal ornamental noise;
- no generic mobile-game visual language.

The game must feel like a playable subsystem discovered inside The Signal.

### 11.7 Entity readability

Each archetype must be distinguishable without relying only on colour.

Minimum differentiation:

- Scout: small, fast, simple silhouette;
- Interceptor: lateral or winged silhouette;
- Disruptor: larger, heavier, interference-marked silhouette.

Projectile kinds must also differ by shape or motion treatment.

### 11.8 Resize behaviour

The renderer must support:

- initial sizing;
- desktop resize;
- mobile rotation;
- DPR change;
- route re-entry.

Resize must never alter authoritative state.

---

## 12. React presentation architecture

### 12.1 Component boundary

React owns:

- route composition;
- runtime lifecycle UI;
- HUD;
- accessible state mirrors;
- control panels;
- overlays;
- canvas mounting;
- mute state;
- seed form.

React must not own authoritative per-tick state transitions through a reducer that reimplements engine logic.

### 12.2 Render cadence

Authoritative states may be held in refs inside the runtime controller.

React state updates must be throttled or projected so React is not forced to rerender 60 times per second.

Recommended projection cadence:

```text
10–20 HUD updates per second
```

The Canvas renderer may render on each animation frame.

### 12.3 Pure projection

A pure presentation projection must convert `GameState` into the HUD view model.

The view model must be testable without DOM or Canvas.

### 12.4 Error containment

A game-specific error boundary or fault panel must handle:

- Canvas initialization failure;
- runtime invariant failure;
- replay mismatch;
- unsupported Canvas context;
- unexpected engine exception.

The wider site must remain navigable after a game fault.

---

## 13. HUD contract

The HUD must display:

### 13.1 Primary status

- Signal integrity;
- Defence integrity;
- score;
- current coherence;
- longest coherence;
- wave number;
- encounter phase.

### 13.2 Power allocation

- Weapons power;
- Defence power;
- Signal power;
- total allocation;
- shift cooldown;
- six directed transfer controls.

### 13.3 Action readiness

- weapon cooldown;
- recovery-pulse cooldown;
- clear ready/unavailable state;
- action rejection feedback.

### 13.4 Encounter information

- enemies scheduled;
- enemies spawned;
- enemies defeated;
- enemies escaped;
- total defeated;
- total escaped.

### 13.5 Run identity

- seed;
- engine version;
- ruleset version;
- final digest when available.

### 13.6 Recent event feed

A bounded recent-event feed may display meaningful events such as:

- wave started;
- wave completed;
- enemy escaped;
- recovery pulse applied;
- power shift rejected;
- Signal collapse started;
- Signal collapse averted;
- encounter completed;
- game terminated.

The feed must:

- contain at most 12 visible records;
- not display ordinary score ticks;
- not grow without bound;
- provide an accessible text representation.

---

## 14. Start, pause, completion, and failure surfaces

### 14.1 Start surface

The start surface must explain:

- objective;
- Signal and Defence;
- power allocation;
- movement;
- fire;
- recovery pulse;
- deterministic seed;
- pause behaviour.

It must not require the player to read the full project documentation.

### 14.2 Pause surface

The pause surface must show:

- Paused;
- current seed;
- current wave;
- score;
- resume;
- restart same seed;
- new seed;
- return home;
- mute state.

### 14.3 Completion surface

The completion surface must show:

- Signal preserved;
- score;
- longest coherence;
- defeated total;
- escaped total;
- final Signal;
- final Defence;
- seed;
- digest;
- replay;
- restart same seed;
- new seed;
- return home.

### 14.4 Terminal surface

The terminal surface must show:

- Signal lost;
- collapse reason;
- score;
- longest coherence;
- wave reached;
- seed;
- digest;
- replay;
- restart same seed;
- new seed;
- return home.

### 14.5 Timing-interruption surface

When backlog protection pauses the game, the player must see:

- simulation timing interrupted;
- no authoritative ticks were fabricated;
- resume control;
- restart control.

---

## 15. Audio contract

### 15.1 Audio technology

KTS-I3 may use the Web Audio API for procedural sound.

No externally sourced audio asset is required or authorized for KTS-I3.

### 15.2 User activation

Audio must not begin until a user gesture starts or unmutes the game.

### 15.3 Event-driven mapping

Procedural audio may respond to:

- `projectile_fired`;
- `enemy_fired`;
- `player_projectile_hit_enemy`;
- `enemy_destroyed`;
- `enemy_projectile_hit_player`;
- `enemy_escaped`;
- `power_shift_applied`;
- `action_rejected`;
- `recovery_pulse_applied`;
- `signal_collapse_started`;
- `signal_collapse_averted`;
- `wave_started`;
- `wave_completed`;
- `encounter_completed`;
- `game_terminated`.

### 15.4 Audio non-authority

Audio must not:

- call engine actions;
- affect tick timing;
- affect input;
- affect state;
- alter replay;
- block rendering.

### 15.5 Lifecycle

Audio must:

- suspend on pause;
- suspend when hidden;
- stop on route unmount;
- respect mute;
- avoid creating one AudioContext per sound;
- cap simultaneous voices.

---

## 16. Accessibility contract

### 16.1 Keyboard completeness

Every action required to complete the encounter must be available through keyboard controls.

### 16.2 Canvas alternative

The Canvas must have:

- an accessible name;
- a short description;
- a DOM-based live state summary outside the Canvas;
- DOM-based controls;
- no essential information available only as pixels.

### 16.3 Reduced motion

When:

```text
prefers-reduced-motion: reduce
```

is active:

- position interpolation may remain;
- camera shake is disabled;
- trails are disabled or shortened;
- fragment effects are removed;
- pulsing is minimized;
- screen distortion is removed;
- essential state changes remain visible through text and static emphasis.

Reduced motion must not alter authoritative timing or difficulty.

### 16.4 Contrast and colour

- text and controls must meet WCAG AA contrast;
- danger, readiness, and damage must not rely only on colour;
- focus indicators must be visible;
- disabled controls must remain legible.

### 16.5 Live announcements

An `aria-live="polite"` region must announce bounded critical events:

- wave started;
- enemy escaped;
- Signal critical;
- recovery pulse ready after prior use;
- encounter complete;
- Signal lost;
- replay integrity fault.

Ordinary projectile events must not be announced.

### 16.6 Touch target size

Primary touch controls must provide at least:

```text
44 × 44 CSS pixels
```

### 16.7 Pauseability

The player must always be able to pause visual movement and audio.

---

## 17. Responsive layout contract

### 17.1 Desktop

Desktop layout should use:

- central arena;
- side or flanking instrument panels;
- visible power-routing controls;
- visible run identity;
- compact event feed.

### 17.2 Narrow viewport

On narrow viewports:

- arena remains the primary surface;
- HUD stacks above or below;
- touch controls remain reachable;
- the arena must not overflow horizontally;
- controls must not cover critical player-state indicators;
- text must remain readable without zoom.

### 17.3 Orientation

Portrait and landscape orientations must remain usable.

Landscape may provide the preferred touch layout, but portrait must not be blocked.

---

## 18. Performance and resource constraints

### 18.1 Runtime targets

On Nolan’s target workstation and a contemporary desktop browser:

- authoritative ticks: 60 per second during normal play;
- visual rendering: target 60 frames per second;
- acceptable degraded rendering: 30 frames per second without changing tick rules;
- route must remain responsive during all five waves.

### 18.2 Allocation bounds

The presentation layer must bound:

- recent events;
- visual effects;
- audio voices;
- replay frames;
- resize work.

The 7,200-frame canonical duration is not a hard maximum for player runs, but the in-memory record must remain practical.

### 18.3 Canvas bounds

- cap DPR at 2;
- avoid full-canvas readback;
- avoid per-pixel CPU image generation per frame;
- reuse shapes, arrays, or effect pools where practical.

### 18.4 React bounds

Avoid creating React state updates for every:

- projectile;
- entity position;
- animation frame;
- ordinary score tick.

---

## 19. Security and privacy boundary

KTS-I3 must not:

- transmit input frames;
- transmit seed;
- transmit score;
- transmit replay data;
- transmit player behaviour;
- call an external API;
- require authentication;
- create analytics;
- write to storage;
- expose hidden engine mutation hooks.

The route remains local-first and client-contained.

---

## 20. Required implementation architecture

The exact file names may vary only with Nolan–Byte review, but the architecture must preserve these responsibilities.

Recommended structure:

```text
app/features/keep-the-signal/
├── engine/
│   └── accepted KTS-I2 engine
├── runtime/
│   ├── fixed-step-loop.ts
│   ├── input-controller.ts
│   ├── session-controller.ts
│   ├── session-record.ts
│   └── seed.ts
└── presentation/
    ├── keep-the-signal-game.tsx
    ├── arena-canvas.tsx
    ├── canvas-renderer.ts
    ├── presentation-frame.ts
    ├── hud-projection.ts
    ├── procedural-audio.ts
    ├── game-controls.tsx
    └── keep-the-signal.css
```

Required route-level files:

```text
app/routes/keep-the-signal.tsx
app/routes.ts
app/routes/home.tsx
```

The game route must import through the engine public export surface rather than deep-importing internal engine files where avoidable.

---

## 21. Authorized implementation files

After separate runtime authorization, KTS-I3 may create:

### 21.1 Runtime

```text
app/features/keep-the-signal/runtime/fixed-step-loop.ts
app/features/keep-the-signal/runtime/input-controller.ts
app/features/keep-the-signal/runtime/session-controller.ts
app/features/keep-the-signal/runtime/session-record.ts
app/features/keep-the-signal/runtime/seed.ts
app/features/keep-the-signal/runtime/index.ts
```

### 21.2 Presentation

```text
app/features/keep-the-signal/presentation/keep-the-signal-game.tsx
app/features/keep-the-signal/presentation/arena-canvas.tsx
app/features/keep-the-signal/presentation/canvas-renderer.ts
app/features/keep-the-signal/presentation/presentation-frame.ts
app/features/keep-the-signal/presentation/hud-projection.ts
app/features/keep-the-signal/presentation/procedural-audio.ts
app/features/keep-the-signal/presentation/game-controls.tsx
app/features/keep-the-signal/presentation/keep-the-signal.css
app/features/keep-the-signal/presentation/index.ts
```

### 21.3 Route

```text
app/routes/keep-the-signal.tsx
```

### 21.4 Tests

```text
test/keep-the-signal-runtime-loop.test.ts
test/keep-the-signal-runtime-input.test.ts
test/keep-the-signal-runtime-session.test.ts
test/keep-the-signal-presentation-projection.test.ts
test/keep-the-signal-presentation-events.test.ts
test/keep-the-signal-route-contract.test.ts
```

### 21.5 Result

```text
docs/game/KTS-I3-PLAYER-FACING-RUNTIME-PRESENTATION-RESULT.md
```

KTS-I3 may modify:

```text
app/routes.ts
app/routes/home.tsx
app/routes/home.css
```

KTS-I3 may modify the engine public export file only if required:

```text
app/features/keep-the-signal/engine/index.ts
```

Any engine-index modification must export an already accepted symbol only.

---

## 22. Prohibited implementation scope

KTS-I3 must not modify:

- engine rules;
- engine constants;
- engine tick order;
- seeded RNG;
- enemy archetype behaviour;
- projectile behaviour;
- damage;
- scoring;
- recovery;
- wave definitions;
- canonical serialization;
- canonical digest;
- KTS-I2 fixture expectations;
- hero renderer;
- hero audio;
- hero styles;
- root visual composition;
- public media assets;
- Cloudflare bindings;
- deployment configuration;
- package dependencies;
- persistence;
- D1;
- R2;
- KV;
- Queues;
- authentication;
- analytics;
- local LLM integration;
- adaptive Game-Agent logic.

Specifically prohibited paths include:

```text
app/components/hero-signal.tsx
app/components/hero-signal-webgl.ts
app/components/hero-signal-audio.ts
app/components/hero-signal.css
public/media/*
wrangler.jsonc
package.json
package-lock.json
```

The existing hero stash must remain untouched.

---

## 23. Automated test contract

### 23.1 Existing tests

All 210 accepted repository tests must continue to pass unchanged unless a narrowly justified route-contract update is required.

No KTS-I1 or KTS-I2 engine assertion may be weakened.

### 23.2 Minimum new tests

KTS-I3 must add at least:

```text
45 new named tests
```

Recommended distribution:

| Area                         | Minimum |
| ---------------------------- | ------: |
| Fixed-step loop              |      10 |
| Input normalization          |      10 |
| Session and replay           |      10 |
| HUD projection               |       7 |
| Event presentation mapping   |       5 |
| Route/accessibility contract |       3 |
| **Total**                    |  **45** |

### 23.3 Fixed-step tests

Must prove:

- zero ticks before one full interval;
- one tick at one interval;
- multiple ticks from accumulated time;
- 8-tick per-callback cap;
- accumulator retention;
- 120-tick backlog pause;
- no tick while paused;
- no tick while hidden;
- interpolation alpha bounds;
- clean disposal.

### 23.4 Input tests

Must prove:

- keyboard mapping;
- opposing directions neutralize;
- fire is held state;
- one-shot repeat suppression;
- recovery queue bound;
- power queue bound;
- all six transfers;
- blur clearing;
- visibility clearing;
- pointer/touch release clearing.

### 23.5 Session tests

Must prove:

- one recorded frame per live tick;
- seed retention;
- same-seed restart;
- new-seed injection;
- manual seed validation;
- URL seed validation;
- completed outcome;
- terminal outcome;
- replay canonical equality;
- replay digest equality;
- replay mismatch fault.

### 23.6 Projection tests

Must prove:

- integrity ratios;
- cooldown ratios;
- encounter counters;
- phase labels;
- total power;
- final digest visibility;
- stable accessible summaries.

### 23.7 Presentation-event tests

Must prove:

- bounded recent-event feed;
- ignored ordinary score ticks;
- critical announcement mapping;
- visual-effect mapping;
- audio mapping;
- reduced-motion effect suppression.

### 23.8 Route-contract tests

Must prove:

- `/keep-the-signal` is registered;
- the home module links to it;
- the game route includes accessible game identity and controls.

No new testing dependency is authorized.

Tests should prefer pure runtime and projection functions compatible with the current Vitest Node environment.

---

## 24. Manual validation contract

KTS-I3 requires live browser validation.

### 24.1 Desktop keyboard validation

Verify:

- start;
- WASD;
- arrow keys;
- fire;
- recovery;
- all six transfers;
- pause/resume;
- same-seed restart;
- new seed;
- completion or terminal flow;
- replay.

### 24.2 Pointer validation

Verify:

- all HUD buttons;
- focus;
- hover-independent operation;
- mute;
- overlays;
- return home.

### 24.3 Touch validation

Verify with browser device emulation or a real touch device:

- directional pad;
- fire hold;
- release and cancel;
- recovery;
- power controls;
- pause;
- responsive layout.

### 24.4 Lifecycle validation

Verify:

- tab hidden;
- tab restored;
- window blur;
- route leave;
- route return;
- resize;
- orientation change;
- audio cleanup;
- no stuck input.

### 24.5 Accessibility validation

Verify:

- full keyboard completion;
- visible focus;
- reduced motion;
- screen-reader state summary;
- critical live announcements;
- non-colour status cues;
- zoom to 200 percent;
- touch-target sizes.

### 24.6 Deterministic replay validation

Complete or terminate one live run.

Verify:

- displayed seed;
- displayed digest;
- replay completion;
- replay digest equality;
- no live input affects replay.

---

## 25. Performance validation contract

Record:

- normal authoritative tick stability;
- typical visual frame rate;
- worst observed frame-time spike;
- maximum active effect count;
- maximum audio voice count;
- replay frame count;
- behaviour during resize;
- behaviour under CPU throttling.

Performance validation must not change engine rules.

If visual rendering falls below target:

- reduce presentation effects;
- reduce DPR;
- reduce HUD update cadence;

before considering any engine change.

---

## 26. Static and scope validation

Required scans:

### 26.1 Engine immutability

Confirm no diff in accepted engine implementation files except an authorized public-export-only change.

### 26.2 Dependency immutability

Confirm no diff in:

```text
package.json
package-lock.json
npm-shrinkwrap.json
```

### 26.3 Prohibited persistence and network APIs

Scan new KTS-I3 runtime and presentation code for:

```text
localStorage
sessionStorage
indexedDB
fetch
XMLHttpRequest
WebSocket
EventSource
navigator.sendBeacon
```

Expected: no matches.

### 26.4 Randomness

Scan for:

```text
Math.random
```

Expected: no matches.

`crypto.getRandomValues` is permitted only in the runtime seed adapter.

### 26.5 Timing boundary

`performance.now` and `requestAnimationFrame` are permitted only in the runtime loop and visual renderer.

They must not appear in engine files.

---

## 27. Required validation commands

At implementation completion, run:

```powershell
npm run test
npm run typecheck
npm run build
npm run lint
npm run format:check
git diff --check
```

Also run focused KTS tests including all new KTS-I3 suites.

The KTS-I3 result must record:

- focused test files and counts;
- repository test count;
- typecheck result;
- lint result;
- build result;
- formatting result;
- static scan result;
- dependency diff;
- engine diff review;
- manual validation outcomes;
- performance observations;
- known limitations;
- unresolved concerns.

---

## 28. Acceptance criteria

KTS-I3 is acceptable only if all of the following are true.

### 28.1 Functional

- `/keep-the-signal` is playable;
- all engine actions are available;
- all five waves can be completed;
- terminal Signal collapse is presentable;
- pause and restart work;
- same-seed restart works;
- new-seed start works;
- replay works;
- final digest is visible.

### 28.2 Deterministic

- one tick frame is recorded per live tick;
- replay canonical state matches;
- replay digest matches;
- render rate does not change authoritative results;
- pause does not advance state;
- hidden tabs do not advance state.

### 28.3 Architectural

- engine remains authoritative;
- hero remains separate;
- no dependency added;
- no persistence added;
- no network call added;
- no engine rule modified;
- runtime, presentation, and engine boundaries remain explicit.

### 28.4 Accessible

- keyboard complete;
- pointer complete;
- touch complete;
- reduced motion supported;
- Canvas has a DOM alternative;
- critical events announced;
- focus visible;
- non-colour cues present.

### 28.5 Quality

- existing tests pass;
- at least 45 new tests pass;
- full typecheck passes;
- lint passes;
- build passes;
- formatting passes;
- static scans pass;
- manual validation passes;
- result document is complete;
- working tree contains only authorized paths.

---

## 29. Result document

Implementation must create:

```text
docs/game/KTS-I3-PLAYER-FACING-RUNTIME-PRESENTATION-RESULT.md
```

It must include:

1. implementation base;
2. branch;
3. changed files;
4. commands;
5. focused tests;
6. repository tests;
7. typecheck;
8. lint;
9. build;
10. formatting;
11. static scans;
12. dependency review;
13. engine immutability review;
14. manual desktop validation;
15. manual touch validation;
16. accessibility validation;
17. lifecycle validation;
18. replay evidence;
19. performance evidence;
20. deviations;
21. limitations;
22. unresolved concerns;
23. implementation acceptance state.

---

## 30. Deferred capabilities

KTS-I3 does not implement:

- adaptive Game-Agent tactics;
- persistent player modelling;
- local LLM strategy;
- cloud model strategy;
- saved replay archive;
- downloadable replay files;
- leaderboards;
- accounts;
- achievements;
- difficulty selection;
- endless mode;
- alternate weapons;
- additional enemy archetypes;
- external audio assets;
- campaign progression;
- deployment changes.

These remain compatible with the KTS-I3 architecture.

---

## 31. Contract acceptance and authorization

Nolan accepted this contract with the exact token:

```text
ACCEPT KTS-I3 CONTRACT
```

Acceptance timestamp:

```text
2026-07-31T10:37:00+02:00
```

Runtime implementation remains prohibited until Nolan separately issues:

```text
AUTHORIZE KTS-I3
```

Implementation acceptance will require a later exact token defined by the accepted result process.

Contract-document staging and commit are authorized. Runtime code, implementation-branch creation, push, merge, deployment, stash application, and package modification remain unauthorized.

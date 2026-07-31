# Keep the Signal — KTS-I1 Deterministic Engine Contract

**Document ID:** `KTS-I1`
**Project:** The Signal
**Subsystem:** Keep the Signal
**Foundation dependency:** `KTS-F0.1`
**Foundation commit:** `bd11043`
**Status:** Accepted
**Active implementation release:** `KTS-I1`
**Runtime implementation authorized:** `Yes`
**Future runtime authorization token:** `AUTHORIZE KTS-I1`
**Target branch:** `game/keep-the-signal-i1-deterministic-engine`

---

## 1. Purpose

This contract defines the first executable slice of Keep the Signal.

KTS-I1 will implement a deterministic, headless game engine containing the minimum authoritative systems required to prove:

- fixed-step simulation;
- reproducible seeded state;
- bounded player movement;
- standard projectile firing;
- conserved power allocation;
- Defence integrity;
- Signal integrity;
- interference pressure;
- recovery;
- collapse and terminal failure;
- Signal-centred scoring;
- serializable simulation inputs;
- reproducible simulation outputs.

KTS-I1 does not create a playable route, renderer, enemy AI, adaptive Game-Agent, audio system, persistence layer, or local LLM connection.

The purpose of this slice is to prove that the game has a stable computational reality before presentation or intelligence layers are attached.

---

## 2. Governing principle

The engine is authoritative.

Given the same:

- engine version;
- configuration;
- seed;
- initial state;
- ordered input frames;
- ordered environment events;

the engine must produce the same:

- final state;
- score;
- integrity values;
- projectile state;
- terminal reason;
- authoritative event sequence;
- deterministic state digest.

The engine must not depend on:

- rendering frame rate;
- wall-clock time;
- browser dimensions;
- network access;
- an LLM;
- React;
- Canvas;
- WebGL;
- audio;
- `Math.random()`;
- `Date.now()`;
- `performance.now()`;
- asynchronous timers.

---

## 3. Authorization boundary

This document is a proposed implementation contract.

It does not authorize runtime implementation while its metadata states:

```text
Runtime implementation authorized: Yes
Active implementation release: NONE
```

The only token that may authorize this runtime slice is:

```text
AUTHORIZE KTS-I1
```

No similar wording, paraphrase, branch creation, document acceptance, or file creation counts as runtime authorization.

---

## 4. KTS-I1 scope

KTS-I1 includes:

1. deterministic engine constants;
2. fixed-step simulation at 60 ticks per second;
3. integer-based authoritative state;
4. seeded pseudo-random generator;
5. initial game-state creation;
6. player movement;
7. player firing;
8. projectile movement and expiry;
9. power shifting;
10. Defence damage and regeneration;
11. Signal corruption, interference, and recovery;
12. recovery pulse;
13. collapse grace period;
14. terminal state;
15. Signal-centred scoring;
16. structured engine events;
17. simulation runner;
18. canonical state serialization;
19. deterministic non-cryptographic state digest;
20. focused automated tests;
21. full-project regression validation.

---

## 5. Explicit exclusions

KTS-I1 does not include:

- `/keep-the-signal` route;
- React components;
- Canvas or WebGL rendering;
- keyboard event listeners;
- sound or music;
- enemies;
- enemy formations;
- collision detection against enemies;
- projectile damage against enemies;
- waves;
- tactical strategies;
- player modelling;
- adaptive learning;
- Game-Agent implementation;
- local LLM implementation;
- local bridge endpoints;
- browser persistence;
- D1, R2, KV, Queues, or Durable Objects;
- online accounts;
- leaderboards;
- multiplayer;
- final balancing;
- homepage activation;
- hero-system modifications;
- dependency additions unless separately approved.

The absence of these systems is intentional.

---

## 6. Runtime model

### 6.1 Fixed step

The engine advances through discrete authoritative ticks.

```text
Ticks per second: 60
One tick: 1/60 authoritative second
```

The engine must expose a pure step boundary:

```ts
stepGame(previousState, tickFrame) -> StepResult
```

Each call processes exactly one authoritative tick.

### 6.2 Integer authority

Authoritative game values must use integers wherever practical.

Positions use normalized fixed-point world units:

```text
World minimum: 0
World maximum: 1,000,000
```

A position of `500,000` represents the centre of one axis.

Integrity values use basis points:

```text
Minimum integrity: 0
Maximum integrity: 10,000
```

A value of `10,000` represents 100%.

Power uses whole allocation units:

```text
Total power: 100
```

Fractional recovery and damage rates must use integer remainder accumulators rather than floating-point accumulation.

### 6.3 No hidden global state

All authoritative state must be contained in or derivable from the supplied `GameState`.

The engine must not rely on:

- module-level mutable counters;
- process-global random state;
- hidden singletons;
- browser storage;
- environment variables;
- current date or time.

---

## 7. Authoritative constants

KTS-I1 must define and export a frozen default constants object.

### 7.1 Simulation

```text
TICKS_PER_SECOND: 60
WORLD_MIN: 0
WORLD_MAX: 1,000,000
ENGINE_VERSION: "kts-i1.0.0"
RULESET_VERSION: "kts-foundation-0.1"
```

### 7.2 Player craft

```text
PLAYER_START_X: 500,000
PLAYER_START_Y: 800,000
PLAYER_RADIUS: 18,000

PLAYER_ACCELERATION_PER_TICK: 360
PLAYER_DIAGONAL_ACCELERATION_PER_TICK: 255
PLAYER_DRAG_PER_TICK: 220
PLAYER_MAX_SPEED_PER_TICK: 7,000
```

### 7.3 Projectiles

```text
PROJECTILE_RADIUS: 4,000
PROJECTILE_SPEED_PER_TICK: 11,000
PROJECTILE_LIFETIME_TICKS: 90
MAX_ACTIVE_PROJECTILES: 64
```

Projectiles travel toward decreasing Y.

### 7.4 Power

```text
TOTAL_POWER: 100
MIN_CHANNEL_POWER: 10
MAX_CHANNEL_POWER: 70
POWER_SHIFT_INCREMENT: 5
POWER_SHIFT_COOLDOWN_TICKS: 12
```

Initial allocation:

```text
Weapons: 34
Defence: 33
Signal: 33
```

### 7.5 Integrity

```text
MAX_DEFENCE_INTEGRITY: 10,000
MAX_SIGNAL_INTEGRITY: 10,000
```

Initial values:

```text
Defence integrity: 10,000
Signal integrity: 10,000
```

### 7.6 Recovery pulse

```text
RECOVERY_PULSE_COOLDOWN_TICKS: 900
RECOVERY_PULSE_SIGNAL_RESTORE: 1,200
RECOVERY_PULSE_DEFENCE_RESTORE: 600
```

### 7.7 Recovery delays

```text
SIGNAL_RECOVERY_DELAY_TICKS: 90
DEFENCE_RECOVERY_DELAY_TICKS: 120
```

### 7.8 Collapse

```text
SIGNAL_COLLAPSE_GRACE_TICKS: 180
```

This represents three authoritative seconds.

---

## 8. Required engine state

The authoritative `GameState` must contain at least:

```ts
interface GameState {
  engineVersion: string;
  rulesetVersion: string;
  seed: number;
  rngState: number;

  tick: number;
  status: "running" | "terminal";
  terminalReason: "signal_collapse" | null;

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
}
```

A projectile must contain:

```ts
interface ProjectileState {
  id: number;
  positionX: number;
  positionY: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  remainingTicks: number;
}
```

Additional fields may be introduced only when they directly support this contract and remain within KTS-I1 scope.

---

## 9. Player input frame

The engine accepts one normalized player input per tick.

```ts
interface PlayerInputFrame {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  fire: boolean;
  recoveryPulse: boolean;
  powerShift?: {
    from: "weapons" | "defence" | "signal";
    to: "weapons" | "defence" | "signal";
  };
}
```

The engine must not process browser key names.

A later input adapter will translate keyboard, controller, or touch input into this normalized structure.

---

## 10. Environment events

KTS-I1 does not implement enemies.

Tests and future systems may apply legal pressure through explicit environment events.

```ts
type EnvironmentEvent =
  | {
      id: string;
      sequence: number;
      type: "set_interference_load";
      load: number;
    }
  | {
      id: string;
      sequence: number;
      type: "impact";
      rawDamage: number;
    }
  | {
      id: string;
      sequence: number;
      type: "signal_corruption";
      rawDamage: number;
    };
```

### 10.1 Event constraints

`set_interference_load`:

```text
Minimum: 0
Maximum: 100
```

Damage events:

```text
Minimum raw damage: 1
Maximum raw damage: 10,000
```

Events within a tick must be processed in ascending `sequence` order.

If two events have the same sequence, they must be processed in ascending lexical `id` order.

Invalid environment events must be rejected through an authoritative rejection event and must not modify game state.

---

## 11. Tick frame

Each simulation step receives:

```ts
interface TickFrame {
  player: PlayerInputFrame;
  environmentEvents: EnvironmentEvent[];
}
```

A neutral frame must be available:

```ts
const NEUTRAL_TICK_FRAME: TickFrame;
```

It contains:

- zero movement;
- no firing;
- no power shift;
- no recovery pulse;
- no environment events.

---

## 12. Tick processing order

Every running tick must use the following order:

1. validate the incoming authoritative state;
2. validate and normalize the tick frame;
3. decrement active cooldowns by one;
4. process one requested power shift;
5. process recovery-pulse activation;
6. process firing;
7. apply movement acceleration or drag;
8. process sorted environment events;
9. integrate player position;
10. integrate projectile positions;
11. expire out-of-bounds or exhausted projectiles;
12. apply continuous interference damage;
13. apply passive Defence recovery;
14. apply passive Signal recovery;
15. update Signal collapse state;
16. update coherence counters;
17. calculate and add tick score;
18. validate output invariants;
19. advance `tick` by one;
20. return the new state and ordered engine events.

No implementation may silently change this order.

A future contract may revise the order through an explicit ruleset version change.

---

## 13. Cooldown semantics

Cooldowns are decremented at the beginning of a tick.

An action is legal when its cooldown equals zero after that decrement.

When an action succeeds, its cooldown is set to the full configured duration.

Example:

```text
Fire cooldown set to 14
Next tick begins at 13
...
Action becomes legal after countdown reaches 0
```

Cooldown values must never become negative.

---

## 14. Movement

### 14.1 Input acceleration

Cardinal movement uses:

```text
360 velocity units per tick
```

Diagonal movement uses:

```text
255 velocity units per axis per tick
```

This approximates normalized diagonal acceleration without making diagonal input substantially stronger.

### 14.2 Drag

When an axis receives no input, its velocity moves toward zero by:

```text
220 velocity units per tick
```

The velocity must not overshoot zero.

### 14.3 Speed limit

After acceleration and drag, total velocity magnitude must be clamped to:

```text
7,000 world units per tick
```

The implementation may use `Math.sqrt()` for vector-magnitude calculation, but the resulting velocity components must be truncated back to integers.

`Math.random()` remains prohibited.

### 14.4 Position integration

Position is updated once per tick:

```text
position += velocity
```

The craft centre must remain within:

```text
PLAYER_RADIUS
to
WORLD_MAX - PLAYER_RADIUS
```

If a boundary clamp occurs, outward velocity on that axis becomes zero.

---

## 15. Power shifting

The power channels are:

- Weapons;
- Defence;
- Signal.

The invariant is:

```text
weapons + defence + signal = 100
```

Each channel must remain between:

```text
10 and 70 inclusive
```

A successful shift:

- subtracts five units from `from`;
- adds five units to `to`;
- sets the power-shift cooldown to 12 ticks.

A shift is rejected when:

- `from` equals `to`;
- the cooldown is active;
- the source would fall below 10;
- the destination would exceed 70;
- a channel name is invalid;
- the action is malformed.

A rejected shift must not partially alter power.

The newly selected allocation affects all later calculations in the same tick.

---

## 16. Weapon firing

### 16.1 Fire cooldown formula

The standard weapon cooldown is:

```text
18 - floor((Weapons power - 10) / 5)
```

The result is clamped to a minimum of:

```text
6 ticks
```

Examples:

```text
Weapons 10 -> 18 ticks
Weapons 34 -> 14 ticks
Weapons 50 -> 10 ticks
Weapons 70 -> 6 ticks
```

### 16.2 Successful firing

A successful shot:

- requires fire cooldown zero;
- requires fewer than 64 active projectiles;
- creates exactly one projectile;
- assigns a monotonically increasing projectile ID;
- spawns at the player’s current X position;
- spawns immediately above the player craft;
- travels upward at 11,000 world units per tick;
- receives a 90-tick lifetime;
- sets the calculated fire cooldown.

### 16.3 Rejected firing

Firing is rejected when:

- fire cooldown is active;
- projectile capacity is reached;
- the game is terminal.

Rejected firing produces an event but does not alter projectile state.

### 16.4 Projectile expiry

A projectile is removed when:

- its remaining lifetime reaches zero;
- its complete collision boundary moves outside the arena.

KTS-I1 does not implement enemy collisions.

---

## 17. Defence damage

An `impact` event applies damage to Defence.

### 17.1 Mitigation

Defence mitigation percentage is:

```text
floor((Defence power - 10) × 3 / 4)
```

It is capped at 45%.

Examples:

```text
Defence 10 -> 0% mitigation
Defence 30 -> 15% mitigation
Defence 50 -> 30% mitigation
Defence 70 -> 45% mitigation
```

Effective damage is:

```text
ceil(raw damage × (100 - mitigation percentage) / 100)
```

Defence integrity is clamped at zero.

KTS-I1 impact damage does not spill into Signal integrity.

Signal attacks are represented separately through `signal_corruption`.

### 17.2 Damage timer

Any positive effective Defence damage resets:

```text
ticksSinceDamage = 0
```

Ticks without Defence damage increment the timer by one.

---

## 18. Defence recovery

Defence recovery begins when:

```text
ticksSinceDamage >= 120
```

Defence recovery per authoritative second is:

```text
20 + ((Defence power - 10) × 3)
```

The rate is expressed in integrity basis points per second.

Examples:

```text
Defence 10 -> 20 basis points per second
Defence 33 -> 89 basis points per second
Defence 70 -> 200 basis points per second
```

Recovery must use an integer remainder accumulator:

```text
remainder += recoveryRatePerSecond
recoveredThisTick = floor(remainder / 60)
remainder = remainder % 60
```

Defence recovery:

- cannot exceed 10,000;
- may recover from zero;
- does not occur after terminal Signal collapse.

---

## 19. Direct Signal corruption

A `signal_corruption` event applies direct damage to Signal integrity.

### 19.1 Signal resistance

Signal resistance percentage is:

```text
floor((Signal power - 10) × 2 / 3)
```

It is capped at 40%.

Examples:

```text
Signal 10 -> 0% resistance
Signal 34 -> 16% resistance
Signal 55 -> 30% resistance
Signal 70 -> 40% resistance
```

Effective Signal damage is:

```text
ceil(raw damage × (100 - resistance percentage) / 100)
```

Signal integrity is clamped at zero.

Any positive effective Signal damage resets:

```text
ticksSinceDamage = 0
```

---

## 20. Continuous interference

The authoritative interference load ranges from:

```text
0 to 100
```

Continuous interference damage per second is:

```text
max(0, Interference load - Signal power) × 8
```

The result is expressed in Signal-integrity basis points per second.

Examples:

```text
Load 30, Signal power 40 -> 0 damage per second
Load 50, Signal power 33 -> 136 basis points per second
Load 70, Signal power 30 -> 320 basis points per second
Load 100, Signal power 70 -> 240 basis points per second
```

Damage must use an integer remainder accumulator:

```text
remainder += interferenceDamageRatePerSecond
damageThisTick = floor(remainder / 60)
remainder = remainder % 60
```

Any positive interference damage resets the Signal damage timer.

---

## 21. Signal recovery

Passive Signal recovery begins only when all conditions are true:

- Signal integrity is greater than zero;
- `ticksSinceDamage >= 90`;
- interference load is less than or equal to Signal power;
- game status is `running`.

Signal recovery per authoritative second is:

```text
30 + ((Signal power - 10) × 4)
```

Examples:

```text
Signal 10 -> 30 basis points per second
Signal 33 -> 122 basis points per second
Signal 50 -> 190 basis points per second
Signal 70 -> 270 basis points per second
```

Recovery must use an integer remainder accumulator.

Passive recovery cannot revive Signal from zero.

Revival during the collapse grace period requires the recovery pulse.

---

## 22. Recovery pulse

A recovery pulse is legal when:

- recovery-pulse cooldown is zero;
- game status is `running`.

It may be used while Signal integrity is zero but before terminal collapse.

A successful pulse:

```text
Signal integrity +1,200
Defence integrity +600
Recovery-pulse cooldown = 900 ticks
```

Both integrity values are clamped to 10,000.

A successful pulse that restores Signal above zero:

- resets `collapseTicks` to zero;
- resumes coherence tracking from the following scoring calculation.

The pulse does not alter interference load in KTS-I1.

---

## 23. Signal collapse

When Signal integrity is greater than zero:

```text
collapseTicks = 0
```

When Signal integrity equals zero:

```text
collapseTicks += 1
```

The game remains recoverable while:

```text
collapseTicks < 180
```

When `collapseTicks` reaches 180:

```text
status = "terminal"
terminalReason = "signal_collapse"
```

Terminal state is permanent.

Calling `stepGame()` on a terminal state must:

- return an equivalent terminal state;
- emit no gameplay events;
- not increase score;
- not advance cooldowns;
- not move projectiles;
- not advance the authoritative tick.

---

## 24. Coherence tracking

When Signal integrity is greater than zero:

```text
currentCoherenceTicks += 1
```

When Signal integrity equals zero:

```text
currentCoherenceTicks = 0
```

`longestCoherenceTicks` is updated whenever the current streak exceeds the previous record.

The collapse grace period does not count as coherent transmission while Signal integrity is zero.

---

## 25. Scoring

KTS-I1 score is based solely on active coherent transmission.

No points are awarded for firing or projectiles.

When Signal integrity is zero:

```text
tick score = 0
```

When Signal integrity is greater than zero:

```text
integrity tier = 1 + floor(Signal integrity / 2,000)
```

This produces:

```text
Signal 1–1,999 -> tier 1
Signal 2,000–3,999 -> tier 2
Signal 4,000–5,999 -> tier 3
Signal 6,000–7,999 -> tier 4
Signal 8,000–9,999 -> tier 5
Signal 10,000 -> tier 6
```

The coherence multiplier is:

```text
1 + min(4, floor(currentCoherenceTicks / 1,800))
```

This increases every 30 coherent seconds and is capped at 5.

Tick score is:

```text
integrity tier × coherence multiplier
```

Score must:

- remain an integer;
- never decrease;
- remain unchanged after terminal collapse;
- reward stronger Signal integrity;
- reward longer uninterrupted coherence.

Recovery bonuses, enemy-destruction points, wave bonuses, and difficulty multipliers are deferred.

---

## 26. Seeded randomness

KTS-I1 must provide a deterministic seeded pseudo-random generator.

Required algorithm:

```text
xorshift32
```

The seed is represented as an unsigned 32-bit integer.

A zero seed must be normalized to:

```text
0x6D2B79F5
```

Required operations:

```ts
nextUint32(state);
nextInt(state, maxExclusive);
```

Each operation must return:

- generated value;
- next RNG state.

The generator must not rely on global mutable state.

KTS-I1 gameplay does not need to consume random values yet, but the generator and its state must be proven for future deterministic spawning.

---

## 27. Engine events

`stepGame()` must return ordered authoritative events.

Minimum event types:

```text
power_shift_applied
action_rejected
projectile_fired
projectile_expired
recovery_pulse_applied
defence_damaged
defence_recovered
signal_damaged
signal_recovered
interference_load_changed
signal_collapse_started
signal_collapse_averted
game_terminated
score_added
```

Every event must contain:

```ts
interface EngineEventBase {
  type: string;
  tick: number;
}
```

Events may contain additional typed fields.

Narrative text must not be stored as authoritative event data.

Rejection reasons must use stable machine-readable identifiers.

Examples:

```text
cooldown_active
power_floor
power_ceiling
same_power_channel
projectile_capacity
invalid_environment_event
terminal_state
```

---

## 28. Public engine API

KTS-I1 must expose:

```ts
createInitialGameState(options): GameState

stepGame(
  previousState: Readonly<GameState>,
  frame: Readonly<TickFrame>
): StepResult

runSimulation(options): SimulationResult

validateGameState(state): ValidationResult

serializeCanonicalState(state): string

createStateDigest(state): string
```

### 28.1 Step result

```ts
interface StepResult {
  state: GameState;
  events: EngineEvent[];
}
```

### 28.2 Simulation runner

The simulation runner must accept:

- initial seed;
- optional approved configuration overrides;
- ordered tick frames;
- optional maximum tick count.

It must return:

- final state;
- ordered events;
- canonical serialized state;
- deterministic state digest.

---

## 29. Canonical serialization

Canonical serialization must:

- use a documented fixed property order;
- preserve projectile ordering by ascending projectile ID;
- contain only authoritative fields;
- exclude functions;
- exclude undefined values;
- exclude environment-dependent metadata;
- produce identical strings for equivalent states.

The implementation must not rely on incidental object insertion order alone.

---

## 30. State digest

KTS-I1 must provide a stable non-cryptographic digest for deterministic test comparison.

Required initial algorithm:

```text
32-bit FNV-1a over UTF-8 canonical state serialization
```

The digest must be returned as an eight-character lowercase hexadecimal string.

This digest is:

- a replay and regression aid;
- not a security mechanism;
- not a substitute for SHA-256 evidence used for governance documents.

---

## 31. Immutability

`stepGame()` must not mutate:

- the supplied previous state;
- the supplied input frame;
- supplied environment-event objects;
- projectile objects belonging to the previous state.

The returned state must be a new authoritative value.

Tests must retain and compare frozen input values to prove this boundary.

Performance optimization through controlled mutation is deferred until profiling demonstrates a real need and a later contract authorizes it.

---

## 32. Validation and error handling

### 32.1 Invariant failures

Invalid authoritative state is a programmer or integrity failure.

Examples:

- power does not total 100;
- integrity exceeds bounds;
- duplicate projectile IDs;
- negative cooldown;
- non-integer authoritative value;
- terminal state without terminal reason.

These failures must produce a typed engine invariant error.

### 32.2 Gameplay rejection

Invalid player actions and invalid environment events must not crash the engine.

They must:

- leave affected state unchanged;
- emit `action_rejected`;
- include a stable rejection reason.

### 32.3 Development assertions

Invariant validation may run on every tick during KTS-I1.

Disabling or reducing validation for production performance requires later evidence and authorization.

---

## 33. Required invariants

Every successful engine step must preserve:

1. all authoritative numeric fields are finite integers;
2. power totals exactly 100;
3. each power channel remains between 10 and 70;
4. Signal integrity remains between 0 and 10,000;
5. Defence integrity remains between 0 and 10,000;
6. interference load remains between 0 and 100;
7. cooldowns remain non-negative;
8. player position remains inside the arena;
9. projectile IDs are unique;
10. projectile ordering is ascending by ID;
11. score never decreases;
12. longest coherence never decreases;
13. terminal reason exists only for terminal state;
14. running state has no terminal reason;
15. RNG state is an unsigned 32-bit integer;
16. the supplied previous state remains unchanged.

---

## 34. Authorized file set

KTS-I1 may create or modify only:

```text
app/features/keep-the-signal/engine/constants.ts
app/features/keep-the-signal/engine/game-state.ts
app/features/keep-the-signal/engine/actions.ts
app/features/keep-the-signal/engine/events.ts
app/features/keep-the-signal/engine/seeded-random.ts
app/features/keep-the-signal/engine/scoring.ts
app/features/keep-the-signal/engine/game-engine.ts
app/features/keep-the-signal/engine/simulation.ts
app/features/keep-the-signal/engine/index.ts

test/keep-the-signal-engine-state.test.ts
test/keep-the-signal-engine-dynamics.test.ts
test/keep-the-signal-engine-determinism.test.ts

docs/game/KTS-I1-DETERMINISTIC-ENGINE-RESULT.md
```

The accepted foundation document may not be modified except through a separately reviewed documentation correction.

No route, component, renderer, audio, agent, or hero file is authorized.

---

## 35. Dependency boundary

KTS-I1 must not add runtime or development dependencies.

The implementation must use:

- TypeScript;
- the repository’s existing test runner;
- existing project tooling;
- standard language and platform functions.

If an essential requirement cannot be met without a dependency, implementation must stop and report the blocker rather than silently modifying `package.json` or a lockfile.

---

## 36. Test requirements

KTS-I1 must add at least 30 named focused tests across the three authorized test files.

### 36.1 State and invariant tests

Tests must prove:

1. initial state uses accepted defaults;
2. initial power totals 100;
3. initial player position is correct;
4. initial integrity is full;
5. zero seed normalization;
6. invalid state is rejected;
7. input state is not mutated;
8. input frame is not mutated;
9. terminal state is immutable;
10. canonical serialization is stable.

### 36.2 Movement tests

Tests must prove:

1. cardinal acceleration;
2. diagonal acceleration;
3. drag moves velocity toward zero;
4. speed is clamped;
5. world boundaries are enforced;
6. outward velocity is cleared at a boundary;
7. movement is independent of rendering.

### 36.3 Power tests

Tests must prove:

1. successful five-unit shift;
2. conservation of total power;
3. shift cooldown;
4. same-channel rejection;
5. minimum-floor rejection;
6. maximum-ceiling rejection;
7. new allocation affects the current tick.

### 36.4 Weapon tests

Tests must prove:

1. projectile creation;
2. monotonic projectile IDs;
3. fire cooldown;
4. Weapons power changes cooldown;
5. projectile movement;
6. projectile lifetime expiry;
7. projectile boundary expiry;
8. projectile-capacity rejection.

### 36.5 Defence tests

Tests must prove:

1. raw impact damage;
2. power-dependent mitigation;
3. integrity clamping;
4. recovery delay;
5. integer recovery accumulation;
6. Defence recovery from zero.

### 36.6 Signal tests

Tests must prove:

1. direct Signal corruption;
2. power-dependent resistance;
3. continuous interference damage;
4. zero damage when Signal power meets or exceeds load;
5. passive recovery delay;
6. passive recovery suppression under interference;
7. passive recovery cannot revive zero Signal;
8. recovery pulse can revive zero Signal during grace.

### 36.7 Collapse tests

Tests must prove:

1. collapse begins at zero Signal;
2. score stops at zero Signal;
3. grace period lasts exactly 180 ticks;
4. pulse averts collapse before expiry;
5. terminal failure occurs at the exact boundary;
6. terminal state does not advance.

### 36.8 Scoring tests

Tests must prove:

1. no score at zero Signal;
2. integrity tiers;
3. coherence multiplier boundaries;
4. multiplier cap;
5. score monotonicity;
6. longest coherence tracking;
7. coherence reset at zero.

### 36.9 Determinism tests

Tests must prove:

1. identical seed and frames produce identical states;
2. identical seed and frames produce identical event sequences;
3. identical simulations produce identical canonical serialization;
4. identical simulations produce identical digests;
5. RNG sequences are reproducible;
6. different seeds produce different RNG sequences;
7. environment-event sorting is stable;
8. repeated simulation runs do not leak global state.

---

## 37. Static nondeterminism gate

The authorized engine files must contain no use of:

```text
Math.random
Date.now
new Date
performance.now
crypto.getRandomValues
requestAnimationFrame
setTimeout
setInterval
localStorage
sessionStorage
fetch
XMLHttpRequest
WebSocket
```

The implementation report must include the command and output used to verify this gate.

---

## 38. Repository validation

Before implementation begins, the implementer must inspect:

- `package.json`;
- TypeScript configuration;
- existing test conventions;
- current project validation scripts;
- line-ending configuration;
- repository instructions.

The implementer must not invent script names.

At completion, validation must include:

1. focused KTS-I1 tests;
2. TypeScript or project check script;
3. full existing repository test suite;
4. production build if an existing build script is available;
5. `git diff --check`;
6. static nondeterminism search;
7. authorized-file-set review;
8. clean working-tree review after commit preparation.

All commands and complete outcomes must be recorded in the result document.

---

## 39. Implementation result document

The implementation must create:

```text
docs/game/KTS-I1-DETERMINISTIC-ENGINE-RESULT.md
```

The result document must record:

- implementation status;
- branch;
- base commit;
- final commit or uncommitted review state;
- files created;
- files modified;
- line counts;
- test commands;
- test outcomes;
- full regression outcomes;
- build outcome;
- deterministic fixture seed;
- deterministic fixture final state;
- deterministic fixture digest;
- static nondeterminism result;
- `git diff --check` result;
- known limitations;
- deviations from contract;
- final implementation SHA-256 evidence where applicable.

The result document must distinguish:

- implementation evidence;
- test evidence;
- interpretation;
- unresolved concerns.

---

## 40. Deterministic fixture

The implementation must define one canonical regression fixture.

Required fixture seed:

```text
1,987,041,211
```

The fixture must contain at least:

- 2,400 ticks;
- movement in all four cardinal directions;
- diagonal movement;
- at least three successful power shifts;
- at least one rejected power shift;
- sustained firing;
- at least one rejected shot due to cooldown;
- at least two interference-load changes;
- at least one impact;
- at least one direct Signal-corruption event;
- one recovery pulse;
- Signal entering Critical state;
- Signal recovering;
- a non-terminal final state.

The fixture’s final state and digest become accepted only after Nolan–Byte review of the implementation evidence.

They must not be invented in advance by this contract.

---

## 41. Implementation conduct

The implementation agent must:

- remain inside the authorized file set;
- inspect before modifying;
- preserve existing project behaviour;
- use the smallest sufficient implementation;
- avoid speculative abstractions;
- avoid premature renderer or agent interfaces;
- avoid dependency changes;
- report uncertainty;
- stop on a contractual blocker;
- retain deterministic evidence;
- keep the hero subsystem untouched.

The implementation agent must not:

- activate the game route;
- create placeholder UI;
- modify the foundation contract;
- add unrequested configuration;
- refactor unrelated code;
- commit automatically unless explicitly instructed;
- claim success without validation evidence.

---

## 42. Acceptance gates

KTS-I1 may be accepted only when all of the following are proven:

1. The engine runs without React, DOM, Canvas, WebGL, audio, network, or LLM access.
2. The simulation advances at a fixed 60-tick logical rate.
3. Authoritative state uses bounded integer values.
4. The same seed and input sequence reproduce the same state.
5. The same simulation reproduces the same event sequence and digest.
6. Power always totals 100.
7. Power limits and cooldowns are enforced.
8. Movement, drag, speed limits, and arena boundaries are correct.
9. Weapon cooldown scales with Weapons power.
10. Projectile state is deterministic.
11. Defence mitigation scales with Defence power.
12. Signal resistance and recovery scale with Signal power.
13. Interference pressure follows the accepted equation.
14. Recovery pulse operates within its accepted boundary.
15. Collapse grace lasts exactly 180 ticks.
16. Terminal state is immutable.
17. Scoring rewards integrity and uninterrupted coherence.
18. Invalid gameplay actions are rejected safely.
19. Invalid authoritative states fail explicitly.
20. Previous state and input objects are not mutated.
21. At least 30 focused tests pass.
22. The complete existing repository test suite passes.
23. The existing project check passes.
24. The existing production build passes where available.
25. Static nondeterminism search passes.
26. `git diff --check` passes.
27. No dependency file changes occur.
28. No route, UI, agent, audio, renderer, or hero file changes occur.
29. The result document contains reproducible evidence.
30. No unreported deviation from this contract exists.

---

## 43. Review decisions

After document review, this contract may receive:

```text
ACCEPT KTS-I1 CONTRACT
REVISE KTS-I1 CONTRACT
REJECT KTS-I1 CONTRACT
```

Accepting the contract does not authorize runtime implementation.

After the contract is accepted, implementation begins only when Nolan issues:

```text
AUTHORIZE KTS-I1
```

---

## 44. Current state

```text
KTS-F0.1: Accepted
KTS-F0.1 commit: bd11043
KTS-I1 contract: Accepted
KTS-I1 runtime release: KTS-I1
Runtime implementation authorized: Yes
Engine implementation: Authorized; not started
Engine tests: Not created
Game route: Not created
Renderer: Not created
Game-Agent: Not created
Local LLM strategist: Not created
Hero subsystem: Out of scope
```

---

## 45. Deterministic clarifications

The following rules resolve implementation ambiguities in the preceding sections. Where a conflict exists, this section is authoritative for KTS-I1.

### 45.1 Event and tick semantics

- Events emitted during a step use the input state's tick value.
- The returned state's tick is exactly one greater than the input state's tick.
- A terminal-state step is a complete no-op: it emits no events and does not advance the tick, score, cooldowns, projectiles, or integrity state.

### 45.2 Damage timers

After all damage for the current tick has been processed:

- `defence.ticksSinceDamage` remains zero when positive Defence damage occurred; otherwise it increments by one.
- `signal.ticksSinceDamage` remains zero when positive Signal damage occurred; otherwise it increments by one.
- Recovery eligibility is evaluated after these timer updates.

Initial Defence and Signal damage timers are zero.

### 45.3 Environment-event ordering

- Environment-event IDs must be unique within one tick frame.
- Duplicate IDs are invalid and produce an authoritative rejection without changing state.
- Valid events are ordered first by ascending `sequence`, then by ascending lexical `id`.
- When multiple valid `set_interference_load` events occur in one tick, the final event in canonical order determines the resulting load.

### 45.4 Projectile spawn

A projectile spawns at:

```text
X = player.positionX
Y = player.positionY - PLAYER_RADIUS - PROJECTILE_RADIUS
```

A frame supplied after terminal state is ignored and does not produce a firing-rejection event.

### 45.5 Recovery-pulse timing

A recovery pulse that restores Signal integrity above zero resets `collapseTicks` to zero.

Coherence tracking and scoring may resume during that same tick if Signal integrity remains above zero after all later damage processing.

### 45.6 Exact xorshift32 behaviour

`nextUint32` uses these unsigned 32-bit operations in order:

```ts
let value = state >>> 0;
value ^= value << 13;
value ^= value >>> 17;
value ^= value << 5;
const nextState = value >>> 0;
```

`nextState` is both the generated unsigned value and the next RNG state.

`nextInt(state, maxExclusive)` requires `maxExclusive` to be a positive safe integer and returns:

```text
generatedUint32 % maxExclusive
```

Modulo bias is accepted for KTS-I1 because this generator supports deterministic game simulation rather than cryptographic or statistical sampling.

### 45.7 Simulation-runner termination

Configuration overrides are not authorized in KTS-I1.

The simulation runner processes ordered frames until the first of:

1. terminal state;
2. maximum tick count;
3. exhaustion of supplied frames.

The maximum tick count must be a non-negative safe integer. A value of zero processes no frames.

Frames remaining after terminal state are not processed.

The simulation result must include the number of processed ticks.

---

## 46. Acceptance record

**Decision:** `ACCEPT KTS-I1 CONTRACT`
**Decision date:** `2026-07-30`
**Runtime authorization:** `GRANTED`
**Required runtime authorization token:** `AUTHORIZE KTS-I1`

Acceptance of this contract authorizes preparation for the KTS-I1 implementation slice. It does not independently authorize runtime implementation.

---

## 47. Runtime authorization record

**Authorization token:** `AUTHORIZE KTS-I1`
**Authorization date:** `2026-07-30`
**Authorized by:** Nolan
**Authorized scope:** KTS-I1 deterministic-engine implementation only

This authorization permits implementation only within the authorized file set and boundaries defined by this contract.

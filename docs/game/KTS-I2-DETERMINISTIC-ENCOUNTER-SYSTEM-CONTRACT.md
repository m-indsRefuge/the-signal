# Keep the Signal — KTS-I2 Deterministic Encounter System Contract

**Document ID:** `KTS-I2`
**Foundation:** `KEEP-THE-SIGNAL-GAME-FOUNDATION-0.1`
**Predecessor:** `KTS-I1`
**Implementation base commit:** `2e558b341dc61484126b5cb40f7f89fd4c1d8cf7`
**Target branch:** `game/keep-the-signal-i2-deterministic-encounters`
**Status:** Accepted
**Active implementation release:** `NONE`
**Runtime implementation authorized:** `No`
**Required runtime authorization token:** `AUTHORIZE KTS-I2`

---

## 1. Purpose

KTS-I2 extends the accepted KTS-I1 deterministic headless engine with a deterministic encounter and enemy system.

The slice establishes the complete simulation rules required for enemies, waves, enemy projectiles, collisions, destruction, escape consequences, encounter progression, and encounter scoring.

KTS-I2 remains headless. It creates game behaviour that a later renderer may display, but it does not create a route, browser interface, visual renderer, audio system, adaptive agent, language-model connection, or persistence layer.

The governing principle remains:

> The model may propose strategy. The game system must prove it.

---

## 2. Accepted predecessor

KTS-I2 is built directly above accepted KTS-I1 commit:

`2e558b341dc61484126b5cb40f7f89fd4c1d8cf7`

KTS-I1 remains authoritative for:

- fixed-step execution;
- player movement;
- power allocation;
- player firing;
- Defence and Signal integrity;
- recovery;
- collapse;
- coherence;
- scoring;
- canonical serialization;
- seeded randomness;
- state digests;
- simulation execution;
- immutable input and state boundaries.

KTS-I2 may extend these contracts only where this document explicitly authorizes an extension.

---

## 3. Scope

KTS-I2 must implement:

- deterministic encounter state;
- five finite waves;
- deterministic enemy spawning;
- three enemy archetypes;
- seeded archetype and spawn-position selection;
- deterministic enemy movement;
- enemy firing;
- enemy projectile movement and expiry;
- player-projectile versus enemy collision;
- enemy-projectile versus player collision;
- enemy destruction;
- enemy escape;
- Defence and Signal consequences;
- encounter score bonuses;
- wave intermissions;
- wave completion;
- encounter completion;
- structured encounter events;
- canonical encounter serialization;
- deterministic encounter regression fixtures;
- invariant and replay-equivalence tests.

---

## 4. Explicit exclusions

KTS-I2 must not implement or modify:

- React routes;
- React components;
- browser controls;
- Canvas, SVG, WebGL, or DOM rendering;
- CSS;
- audio;
- menus;
- accessibility UI;
- enemy artwork;
- adaptive learning;
- player modelling;
- local or hosted language models;
- telemetry storage;
- replay storage;
- D1, R2, KV, Queues, or Durable Objects;
- network services;
- deployment configuration;
- package dependencies;
- hero or landing-page files.

No dependency may be added.

---

## 5. Encounter model

The game contains one finite deterministic encounter consisting of five waves.

The encounter phase is one of:

- `active`
- `intermission`
- `complete`

The initial game state begins with:

- wave number `1`;
- phase `active`;
- phase tick `0`;
- spawn cooldown `0`;
- zero spawned enemies;
- zero defeated enemies;
- zero escaped enemies;
- next enemy ID `1`;
- next enemy-projectile ID `1`.

The first enemy is eligible to spawn during the first running-state step.

---

## 6. Encounter state

The authoritative `GameState` must be extended with:

- encounter phase;
- current wave number;
- phase ticks;
- spawn cooldown ticks;
- enemies scheduled for the current wave;
- enemies spawned in the current wave;
- enemies defeated in the current wave;
- enemies escaped in the current wave;
- total enemies defeated;
- total enemies escaped;
- next enemy ID;
- next enemy-projectile ID;
- active enemies;
- active enemy projectiles.

All new authoritative values must be safe integers or closed string unions.

---

## 7. Wave constants

KTS-I2 uses exactly five waves.

Enemies scheduled per wave:

- Wave 1: `8`
- Wave 2: `10`
- Wave 3: `12`
- Wave 4: `14`
- Wave 5: `16`

Total scheduled enemies:

- `60`

Spawn intervals:

- Wave 1: `82` ticks
- Wave 2: `74` ticks
- Wave 3: `66` ticks
- Wave 4: `58` ticks
- Wave 5: `50` ticks

Intermission duration:

- `180` ticks

A wave begins with spawn cooldown `0`.

After an enemy is spawned, the spawn cooldown is set to the current wave’s spawn interval.

The cooldown is decremented once at the beginning of each later running-state step.

---

## 8. Enemy archetypes

KTS-I2 defines exactly three enemy archetypes:

- `scout`
- `interceptor`
- `disruptor`

### 8.1 Scout

- Integrity: `1000`
- Radius: `14000`
- Vertical speed: `1800` units per tick
- Horizontal speed: `0`
- Player-projectile damage received normally
- Does not fire
- Destruction score bonus: `100`
- Escape Defence damage: `300`
- Escape Signal damage: `0`

### 8.2 Interceptor

- Integrity: `1800`
- Radius: `17000`
- Vertical speed: `1300` units per tick
- Horizontal speed: `900` units per tick
- Initial horizontal direction:

  - odd enemy ID: right;
  - even enemy ID: left

- Bounces deterministically at the horizontal spawn margins
- Fire cooldown: `120` ticks
- Enemy projectile type: `kinetic`
- Projectile raw damage: `400`
- Destruction score bonus: `250`
- Escape Defence damage: `500`
- Escape Signal damage: `200`

### 8.3 Disruptor

- Integrity: `2600`
- Radius: `20000`
- Vertical speed: `900` units per tick
- Horizontal speed: `0`
- Fire cooldown: `180` ticks
- Enemy projectile type: `corruption`
- Projectile raw damage: `650`
- Destruction score bonus: `400`
- Escape Defence damage: `0`
- Escape Signal damage: `700`

---

## 9. Archetype selection

Enemy archetypes are selected using one deterministic `nextInt` call with `maxExclusive = 100`.

Wave weights are:

### Wave 1

- Scout: rolls `0–99`

### Wave 2

- Scout: rolls `0–74`
- Interceptor: rolls `75–99`

### Wave 3

- Scout: rolls `0–54`
- Interceptor: rolls `55–84`
- Disruptor: rolls `85–99`

### Wave 4

- Scout: rolls `0–39`
- Interceptor: rolls `40–74`
- Disruptor: rolls `75–99`

### Wave 5

- Scout: rolls `0–29`
- Interceptor: rolls `30–64`
- Disruptor: rolls `65–99`

The first RNG call for each enemy determines its archetype.

---

## 10. Spawn position

Enemy spawn margins are:

- minimum X: `40000`
- maximum X: `960000`

Enemy spawn Y is:

- `40000`

The second RNG call for each enemy determines spawn X.

The X roll uses:

- `nextInt(rngState, 920001)`

Spawn X is:

- `40000 + rolled value`

Exactly two RNG transitions must occur for every spawned enemy:

1. archetype roll;
2. spawn-X roll.

No additional RNG call may occur during enemy creation.

---

## 11. Enemy state

Every active enemy must contain:

- unique positive integer ID;
- archetype;
- position X;
- position Y;
- velocity X;
- velocity Y;
- radius;
- current integrity;
- maximum integrity;
- fire cooldown ticks;
- fire interval ticks;
- destruction score value;
- escape Defence damage;
- escape Signal damage.

Enemy IDs are monotonically increasing and never reused.

Active enemies must be stored in ascending ID order.

---

## 12. Enemy projectile state

Every enemy projectile must contain:

- unique positive integer ID;
- owner enemy ID;
- projectile kind:

  - `kinetic`;
  - `corruption`;

- position X;
- position Y;
- velocity X;
- velocity Y;
- radius;
- raw damage;
- remaining lifetime ticks.

Enemy-projectile constants:

- Radius: `5000`
- Vertical speed: `5000` units per tick
- Horizontal speed: `0`
- Lifetime: `240` ticks
- Maximum active enemy projectiles: `128`

Enemy-projectile IDs are monotonically increasing and never reused.

Active enemy projectiles must be stored in ascending ID order.

---

## 13. Enemy firing

Scouts never fire.

Interceptor and Disruptor fire cooldowns are decremented once at the beginning of each running-state step.

A newly spawned firing enemy begins with its full archetype fire cooldown.

When an enemy’s cooldown reaches zero:

1. it attempts to fire;
2. if enemy-projectile capacity is available, one projectile is created;
3. the projectile begins at:

   - X equal to enemy X;
   - Y equal to enemy Y plus enemy radius plus projectile radius;

4. the enemy’s fire cooldown resets to its full interval;
5. an `enemy_fired` event is emitted.

If capacity is full:

- no projectile is created;
- an `enemy_fire_rejected` event is emitted;
- the enemy cooldown resets to its full interval.

A newly created enemy projectile moves during the same tick.

---

## 14. Enemy movement

Enemies move once per running-state step.

Movement uses integer addition only.

Scouts and Disruptors move vertically downward.

Interceptors move vertically downward and horizontally.

Interceptor horizontal boundaries use:

- minimum centre X: `40000`
- maximum centre X: `960000`

When an Interceptor crosses a horizontal boundary:

- its X is clamped to the boundary;
- its horizontal velocity reverses;
- it does not receive an additional movement step after reversal.

---

## 15. Projectile movement

Player-projectile behaviour established by KTS-I1 remains unchanged.

Enemy projectiles move after enemy firing.

Enemy-projectile lifetime decreases by one after movement.

An enemy projectile expires when:

- remaining lifetime reaches zero; or
- its complete radius has left the world.

Expiry emits `enemy_projectile_expired`.

Lifetime expiry takes precedence over world-boundary expiry when both occur during the same tick.

---

## 16. Collision model

All collisions use integer squared-distance comparison.

Two circular entities collide when:

`distanceX² + distanceY² <= combinedRadius²`

The calculation must remain within JavaScript safe-integer limits.

No floating-point square root may be used for authoritative collision decisions.

---

## 17. Player-projectile versus enemy collision

Collision resolution order is:

1. player projectiles in ascending projectile ID;
2. enemies in ascending enemy ID.

Each player projectile may hit at most one enemy.

The projectile hits the first colliding enemy in canonical enemy-ID order.

Player-projectile raw damage is:

- `1000`

On collision:

- the player projectile is removed;
- the enemy loses up to `1000` integrity;
- `player_projectile_hit_enemy` is emitted.

If enemy integrity reaches zero:

- the enemy is removed;
- the destruction score bonus is added immediately;
- current coherence is not reset;
- `enemy_destroyed` is emitted;
- `enemy_score_awarded` is emitted;
- current-wave and total-defeat counters increase.

An enemy destroyed during a tick cannot fire or escape later in that tick.

---

## 18. Enemy-projectile versus player collision

Enemy projectiles are resolved in ascending projectile ID.

Each enemy projectile may hit the player at most once.

On collision:

- the projectile is removed;
- `enemy_projectile_hit_player` is emitted.

Damage routing:

- `kinetic` projectiles use the accepted KTS-I1 Defence mitigation path;
- `corruption` projectiles use the accepted KTS-I1 Signal resistance path.

Positive effective damage must reset the corresponding recovery-delay timer through the existing KTS-I1 damage-flag process.

---

## 19. Enemy escape

An enemy escapes when:

- enemy position Y minus enemy radius is greater than `1000000`.

Escape is checked after player-projectile collision resolution.

An enemy destroyed on the same tick does not escape.

When an enemy escapes:

- it is removed;
- current-wave and total-escape counters increase;
- its configured Defence damage is applied;
- its configured Signal damage is applied;
- `enemy_escaped` is emitted.

Escape damage uses the same accepted KTS-I1 mitigation and resistance paths as equivalent external damage.

An escape that reduces Signal to zero begins or advances the normal KTS-I1 collapse lifecycle.

---

## 20. Authoritative per-tick order

KTS-I2 must preserve this exact running-state order:

1. validate previous state;
2. clone previous state;
3. normalize input;
4. decrement player cooldowns;
5. decrement encounter spawn cooldown;
6. decrement enemy fire cooldowns;
7. process player power shift;
8. process recovery pulse;
9. process player firing;
10. apply player movement input;
11. process external environment events;
12. integrate player position;
13. update encounter phase and spawn eligible enemy;
14. integrate enemy movement;
15. process enemy firing;
16. integrate player projectiles;
17. integrate enemy projectiles;
18. resolve player-projectile versus enemy collisions;
19. resolve enemy-projectile versus player collisions;
20. process enemy escapes;
21. apply continuous interference;
22. update Defence and Signal damage timers;
23. apply Defence recovery;
24. apply Signal recovery;
25. update Signal collapse;
26. update coherence and ordinary tick score;
27. update wave completion and intermission state;
28. increment authoritative tick;
29. validate returned state.

Terminal-state steps remain complete no-ops.

All events emitted during a step use the input state’s tick.

---

## 21. Wave progression

A wave is complete when:

- all scheduled enemies have spawned;
- no active enemies remain;
- no active enemy projectiles remain.

On completion of Waves 1 through 4:

- phase becomes `intermission`;
- phase ticks reset to `0`;
- `wave_completed` is emitted.

During intermission:

- no enemy spawns;
- ordinary KTS-I1 player, recovery, interference, collapse, and scoring behaviour continues;
- phase ticks increase once per running-state step.

When phase ticks reach `180`:

- wave number increases by one;
- phase becomes `active`;
- phase ticks reset to `0`;
- all current-wave counters reset;
- spawn cooldown becomes `0`;
- scheduled enemy count becomes the new wave count;
- `wave_started` is emitted.

After Wave 5 completes:

- phase becomes `complete`;
- `wave_completed` is emitted;
- `encounter_completed` is emitted;
- no further enemies spawn.

Encounter completion does not terminate the game.

---

## 22. Scoring

KTS-I1 ordinary Signal-centred tick scoring remains unchanged.

Enemy destruction awards the fixed archetype bonus immediately.

Enemy bonuses are additive and do not replace ordinary tick score.

Enemy escape does not directly subtract score. Its Defence and Signal consequences reduce the player’s future survival and scoring capacity.

No score is awarded for:

- projectile hits that do not destroy an enemy;
- enemy projectiles avoided;
- wave completion;
- encounter completion.

---

## 23. Structured events

KTS-I2 must add structured events for:

- `wave_started`
- `wave_completed`
- `encounter_completed`
- `enemy_spawned`
- `enemy_fired`
- `enemy_fire_rejected`
- `enemy_projectile_expired`
- `player_projectile_hit_enemy`
- `enemy_damaged`
- `enemy_destroyed`
- `enemy_score_awarded`
- `enemy_projectile_hit_player`
- `enemy_escaped`

Events must contain sufficient IDs and values to reconstruct the relevant transition without inspecting hidden mutable state.

---

## 24. State validation

KTS-I2 validation must reject:

- unknown encounter phases;
- wave numbers outside `1–5`;
- negative phase ticks;
- negative cooldowns;
- inconsistent scheduled and spawned counts;
- defeated or escaped counts exceeding spawned counts;
- duplicate or unordered enemy IDs;
- duplicate or unordered enemy-projectile IDs;
- enemy IDs not below the next enemy ID;
- projectile IDs not below the next enemy-projectile ID;
- unknown enemy archetypes;
- unknown enemy-projectile kinds;
- invalid enemy integrity;
- invalid radii;
- invalid projectile lifetime;
- active-enemy counts inconsistent with counters;
- encounter completion before Wave 5;
- active spawning after encounter completion;
- active enemy counts above `60`;
- enemy-projectile counts above `128`.

Validation must continue to enforce every KTS-I1 invariant.

---

## 25. Canonical serialization

Canonical serialization must include the complete encounter state.

New top-level serialization order after `projectiles` is:

1. `encounter`
2. `enemies`
3. `enemyProjectiles`

Enemies must serialize in ascending enemy ID.

Enemy projectiles must serialize in ascending projectile ID.

Canonical serialization must not mutate state.

FNV-1a digest behaviour remains unchanged.

---

## 26. Deterministic simulation

Equal initial seeds and equal input frames must produce:

- byte-identical canonical states;
- identical event sequences;
- identical state digests;
- identical wave progression;
- identical enemy archetypes;
- identical spawn positions;
- identical collision results.

Different seeds must be demonstrated to produce a different spawn sequence or encounter digest.

No module-level mutable encounter state is permitted.

---

## 27. Canonical KTS-I2 fixture

KTS-I2 must define a permanent deterministic encounter fixture using:

- Seed: `1987041211`
- Maximum frames: `7200`

The fixture must use scripted player inputs and must demonstrate:

- all five waves started;
- all five waves completed;
- encounter phase `complete`;
- at least one Scout spawned;
- at least one Interceptor spawned;
- at least one Disruptor spawned;
- at least twenty enemies destroyed;
- at least one enemy escaped;
- at least one kinetic projectile hit;
- at least one corruption projectile hit;
- at least one accepted power shift;
- at least one rejected action;
- player firing;
- recovery pulse use;
- nonzero final Signal integrity;
- nonterminal final game status;
- repeatable final canonical state;
- repeatable eight-character digest.

The expected final state and digest must be generated from the completed implementation. They must not be invented in advance.

---

## 28. Static determinism restrictions

The authorized runtime files must not use:

- `Math.random`
- `Date.now`
- `new Date`
- `performance.now`
- `crypto.getRandomValues`
- `requestAnimationFrame`
- `setTimeout`
- `setInterval`
- `localStorage`
- `sessionStorage`
- `fetch`
- `XMLHttpRequest`
- `WebSocket`

No wall-clock, browser scheduler, network, or browser-storage dependency is permitted.

---

## 29. Authorized runtime files

KTS-I2 may create:

- `app/features/keep-the-signal/engine/collisions.ts`
- `app/features/keep-the-signal/engine/encounters.ts`
- `app/features/keep-the-signal/engine/enemies.ts`

KTS-I2 may modify:

- `app/features/keep-the-signal/engine/constants.ts`
- `app/features/keep-the-signal/engine/events.ts`
- `app/features/keep-the-signal/engine/game-engine.ts`
- `app/features/keep-the-signal/engine/game-state.ts`
- `app/features/keep-the-signal/engine/index.ts`
- `app/features/keep-the-signal/engine/simulation.ts`

No other runtime file is authorized.

---

## 30. Authorized test files

KTS-I2 may create:

- `test/keep-the-signal-encounter-state.test.ts`
- `test/keep-the-signal-encounter-dynamics.test.ts`
- `test/keep-the-signal-encounter-determinism.test.ts`

KTS-I2 may modify the existing permanent KTS-I1 test files only where necessary to account for the extended canonical initial state:

- `test/keep-the-signal-engine-state.test.ts`
- `test/keep-the-signal-engine-dynamics.test.ts`
- `test/keep-the-signal-engine-determinism.test.ts`

---

## 31. Result document

KTS-I2 must create:

- `docs/game/KTS-I2-DETERMINISTIC-ENCOUNTER-SYSTEM-RESULT.md`

The result document must record:

- implementation base commit;
- changed paths;
- commands executed;
- focused test totals;
- complete repository test totals;
- lint result;
- typecheck result;
- build result;
- formatting result;
- static nondeterminism result;
- dependency review;
- authorized-file review;
- canonical fixture configuration;
- fixture event counts;
- final canonical state;
- final digest;
- deviations;
- limitations;
- unresolved concerns.

---

## 32. Required test coverage

KTS-I2 must add at least `45` named focused tests.

The focused tests must cover:

- initial encounter state;
- encounter invariants;
- deterministic spawn counts;
- wave-specific spawn intervals;
- seeded archetype selection;
- seeded spawn positions;
- exact RNG consumption;
- enemy ID monotonicity;
- projectile ID monotonicity;
- Scout movement;
- Interceptor movement and bounce;
- Disruptor movement;
- enemy cooldowns;
- enemy firing;
- enemy-projectile capacity;
- enemy-projectile movement;
- projectile lifetime expiry;
- projectile boundary expiry;
- squared-distance collision boundaries;
- canonical collision ordering;
- player projectile removal;
- enemy damage;
- enemy destruction;
- destruction score;
- enemy projectile hits;
- kinetic damage routing;
- corruption damage routing;
- recovery timer resets;
- enemy escape;
- escape damage;
- wave completion;
- intermission;
- next-wave start;
- encounter completion;
- terminal no-op behaviour;
- state immutability;
- input immutability;
- canonical serialization;
- state digest;
- same-seed replay equivalence;
- different-seed divergence;
- complete canonical fixture.

All existing KTS-I1 tests must remain passing.

---

## 33. Validation requirements

The implementation must run:

- focused KTS-I1 and KTS-I2 tests;
- complete repository tests;
- test typecheck;
- application typecheck;
- ESLint;
- KTS source and test Prettier check;
- production build;
- `git diff --check`;
- static nondeterminism scan;
- dependency-file review;
- authorized-file-set review.

No success claim may be made while a required executable gate is failing.

Any pre-existing repository-wide formatting exception must be documented rather than silently modified outside scope.

---

## 34. Implementation conduct

Implementation must:

- begin from a clean working tree;
- remain on the KTS-I2 branch;
- preserve the accepted KTS-I1 commit;
- use only authorized files;
- avoid dependencies;
- avoid unrelated refactoring;
- preserve deterministic ordering;
- stop and report any contract blocker;
- remain uncommitted until Nolan–Byte review;
- record actual evidence rather than expected evidence.

---

## 35. Contract acceptance

The contract may be accepted with:

`ACCEPT KTS-I2 CONTRACT`

Contract acceptance does not authorize runtime implementation.

---

## 36. Runtime authorization

Runtime implementation may begin only after Nolan explicitly issues:

`AUTHORIZE KTS-I2`

No equivalent phrase, implication, or general approval substitutes for that exact authorization token.

---

## 37. Current project state

At the time of this contract:

- KTS-F0.1 is accepted;
- KTS-I1 is accepted and committed;
- KTS-I2 is proposed;
- KTS-I2 runtime implementation is not authorized;
- no KTS-I2 runtime file has been created;
- the hero work remains isolated in its existing stash.

---

## 38. Acceptance record

**Decision:** `ACCEPT KTS-I2 CONTRACT`  
**Decision date:** `2026-07-30`  
**Accepted by:** Nolan  
**Technical review:** Byte  
**Runtime implementation authorized:** `No`  
**Active implementation release:** `NONE`

The KTS-I2 deterministic encounter-system contract is accepted.

This acceptance does not authorize runtime implementation. Implementation may begin only after Nolan issues the exact token:

'AUTHORIZE KTS-I2'

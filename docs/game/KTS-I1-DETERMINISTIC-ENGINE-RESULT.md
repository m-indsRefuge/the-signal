# Keep the Signal — KTS-I1 Deterministic Engine Result

**Document ID:** `KTS-I1-RESULT`
**Implementation contract:** `KTS-I1`
**Foundation:** `KEEP-THE-SIGNAL-GAME-FOUNDATION-0.1`
**Result date:** `2026-07-30`
**Implementation method:** Nolan–Byte Byte-Coding workflow
**Implementation base commit:** `09978f4`
**Base commit message:** `docs(signal): authorize KTS-I1 deterministic engine`
**Branch:** `game/keep-the-signal-i1-deterministic-engine`
**Implementation status:** Accepted
**Commit status:** Uncommitted at the time of this result record

---

## 1. Result summary

The authorized KTS-I1 deterministic-engine slice has been implemented.

The implementation provides a local, headless, fixed-step game engine for Keep the Signal. It contains no route, renderer, user interface, audio system, adaptive agent, language-model integration, persistence layer, Cloudflare storage integration, or dependency addition.

The implemented engine includes:

- a fixed 60-tick authoritative simulation rate;
- integer-based authoritative game state;
- deterministic initial-state construction;
- normalized player input;
- ordered environment-event processing;
- player movement, acceleration, drag, speed limits, and world boundaries;
- conserved Weapons, Defence, and Signal power allocation;
- power-shift cooldowns and validation;
- power-dependent firing cooldowns;
- projectile creation, movement, capacity, lifetime, and boundary expiry;
- Defence damage, mitigation, delay, and passive recovery;
- Signal corruption, resistance, interference, delay, and passive recovery;
- recovery-pulse behaviour;
- Signal-collapse grace and terminal-state behaviour;
- coherence tracking;
- Signal-centred scoring;
- seeded `xorshift32` utilities;
- state invariant validation;
- canonical state serialization;
- FNV-1a state digest generation;
- bounded deterministic simulation execution;
- immutable previous-state and input boundaries;
- focused deterministic regression coverage.

The implementation remains within the KTS-I1 contract boundary.

---

## 2. Implemented paths

The following authorized runtime files were created:

- `app/features/keep-the-signal/engine/actions.ts`
- `app/features/keep-the-signal/engine/constants.ts`
- `app/features/keep-the-signal/engine/events.ts`
- `app/features/keep-the-signal/engine/game-engine.ts`
- `app/features/keep-the-signal/engine/game-state.ts`
- `app/features/keep-the-signal/engine/index.ts`
- `app/features/keep-the-signal/engine/scoring.ts`
- `app/features/keep-the-signal/engine/seeded-random.ts`
- `app/features/keep-the-signal/engine/simulation.ts`

The following authorized test files were created:

- `test/keep-the-signal-engine-state.test.ts`
- `test/keep-the-signal-engine-dynamics.test.ts`
- `test/keep-the-signal-engine-determinism.test.ts`

This result record was created at:

- `docs/game/KTS-I1-DETERMINISTIC-ENGINE-RESULT.md`

No other implementation path is part of KTS-I1.

---

## 3. Contract boundary review

The implementation did not create or modify:

- application routes;
- React components;
- visual renderers;
- style sheets;
- audio;
- enemies or encounter systems;
- adaptive policies;
- local or hosted language-model integrations;
- persistence;
- Cloudflare D1, R2, KV, Queues, or Durable Objects;
- hero or landing-page files;
- package dependencies;
- package scripts;
- TypeScript configuration;
- ESLint configuration;
- Vitest configuration;
- Vite configuration;
- Wrangler configuration;
- the accepted KTS-F0.1 Foundation document;
- the accepted KTS-I1 contract.

No dependency file changed.

The existing hero work remains isolated in:

- `stash@{0}: On design/foundation-0.1: WIP hero landing page before Keep the Signal foundation`

---

## 4. Engine characteristics

### 4.1 Time and world model

- Authoritative frequency: 60 ticks per second
- World range: 0 through 1,000,000
- State transitions occur through the fixed-step `stepGame` function.
- Event ticks refer to the input state’s tick.
- A successful running-state step returns a state whose tick has advanced by one.
- A terminal-state step returns an independent, value-equivalent state and no events.

### 4.2 Deterministic state

The authoritative state contains:

- engine and ruleset versions;
- original normalized seed;
- current RNG state;
- tick;
- game status and terminal reason;
- score and coherence;
- player position, velocity, and radius;
- Weapons, Defence, and Signal power;
- cooldowns;
- Defence integrity and recovery state;
- Signal integrity, recovery state, interference remainder, and collapse state;
- current interference load;
- active projectiles.

Initial states created from equal seeds are value-identical and do not share mutable object graphs.

### 4.3 Randomness

The deterministic random utility uses the accepted `xorshift32` transition.

A zero seed is normalized to:

- `0x6D2B79F5`

The current KTS-I1 mechanics do not require random choices, so the engine’s authoritative RNG state remains unchanged during the canonical fixture. The RNG implementation and repeatability are tested independently and are available for later authorized mechanics.

### 4.4 Canonical state evidence

Canonical state serialization:

- validates the state before serialization;
- uses an explicitly defined field order;
- serializes projectiles deterministically;
- does not mutate the supplied state.

State digests use:

- UTF-8 canonical-state bytes;
- 32-bit FNV-1a;
- eight lowercase hexadecimal characters.

---

## 5. Focused validation

The permanent KTS-I1 focused suite contains:

- 34 state and primitive tests;
- 34 fixed-step dynamics tests;
- 21 determinism and regression-fixture tests.

Focused result:

- Test files: 3 passed
- Tests: 89 passed
- Failures: 0

The focused suite covers:

- constants;
- default state;
- state independence;
- seed normalization;
- exact RNG sequences;
- invalid RNG inputs;
- invariants;
- canonical serialization;
- state digests;
- movement;
- diagonal movement;
- drag;
- speed limits;
- world boundaries;
- power conservation;
- power shifts;
- shift floor and ceiling;
- shift cooldowns;
- same-tick power effects;
- firing cooldowns;
- projectile identifiers;
- projectile capacity;
- projectile movement;
- projectile lifetime;
- projectile boundary expiry;
- Defence mitigation;
- Defence clamping;
- Defence recovery;
- direct Signal corruption;
- Signal resistance;
- continuous interference;
- integer remainder accumulation;
- Signal recovery;
- interference recovery suppression;
- recovery pulse;
- collapse start;
- recoverable grace;
- exact terminal boundary;
- terminal no-op behaviour;
- event ordering;
- duplicate event rejection;
- invalid event rejection;
- score progression;
- coherence;
- state and input immutability;
- simulation tick bounds;
- repeated simulation equality;
- canonical 2,400-tick regression behaviour.

---

## 6. Complete repository validation

The complete repository test command was run through:

- `npm run test:coverage`

Result:

- Test files: 4 passed
- Tests: 94 passed
- Failures: 0

Included suites:

- `test/runtime-bindings.test.ts`: 5 passed
- `test/keep-the-signal-engine-state.test.ts`: 34 passed
- `test/keep-the-signal-engine-dynamics.test.ts`: 34 passed
- `test/keep-the-signal-engine-determinism.test.ts`: 21 passed

Additional executable validation:

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run typecheck:app`: passed
- `npm run typecheck:test`: passed
- `npm run build`: passed
- focused KTS-I1 Prettier check: passed
- `git diff --check`: passed
- dependency-file review: passed
- static nondeterminism scan: passed

The production build completed for both:

- client environment;
- server environment.

---

## 7. Repository-check exception

The aggregate `npm run check` command stopped during its initial repository-wide Prettier stage because the previously accepted file below does not currently satisfy the repository’s Prettier configuration:

- `docs/game/KEEP-THE-SIGNAL-GAME-FOUNDATION-0.1.md`

That Foundation file:

- predates the KTS-I1 implementation;
- was not modified by KTS-I1;
- lies outside the authorized implementation file set;
- was deliberately not rewritten during this slice.

All KTS-I1 source and test files passed a direct Prettier check.

The remaining commands normally executed by `npm run check` were run individually and passed:

- lint;
- complete typecheck;
- coverage test run;
- production build.

This is recorded as a pre-existing repository-formatting exception, not a KTS-I1 implementation failure.

---

## 8. Coverage-report qualification

The coverage command completed successfully and reported 100% coverage for the source currently selected by the repository’s existing coverage configuration.

The displayed coverage table included:

- `runtime.server.ts`

The current repository coverage configuration did not include the new Keep the Signal engine files in its reported instrumentation set.

Accordingly:

- no claim of 100% engine line or branch coverage is made;
- engine confidence is based on the 89 focused behavioural tests;
- modifying the global coverage configuration was outside the KTS-I1 authorized file set.

---

## 9. Static nondeterminism review

The authorized engine directory was scanned for the prohibited runtime APIs defined by the KTS-I1 contract.

The scan covered:

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

Result:

- no matches found.

The engine does not depend on wall-clock time, browser scheduling, network access, browser storage, or global nondeterministic randomness.

---

## 10. Canonical 2,400-tick fixture

### 10.1 Configuration

- Seed: `1987041211`
- Configured ticks: `2400`
- Processed ticks: `2400`
- Required nonterminal completion: satisfied
- Final status: `running`
- Terminal reason: `null`
- State digest: `76d45705`

### 10.2 Behavioural evidence

- Minimum Signal integrity: `802`
- Entered Critical Signal state: yes
- Recovered from Critical Signal state: yes
- Final Signal integrity: `5479`
- Final Defence integrity: `10000`

The fixture exercised:

- cardinal movement;
- diagonal movement;
- neutral movement and drag;
- projectile firing;
- accepted power shifts;
- a rejected cooldown-constrained power shift;
- high interference;
- reduced interference;
- direct Signal corruption;
- Defence impact damage;
- recovery pulse;
- passive recovery;
- scoring;
- coherence;
- deterministic event production.

### 10.3 Event counts

- Total events: `5212`
- Applied power shifts: `3`
- Rejected power shifts: `1`
- Rejected firing actions: `278`
- Interference-load changes: `2`
- Defence-damage events: `1`
- Direct Signal-corruption events: `1`
- Interference Signal-damage events: `200`
- Recovery pulses applied: `1`

### 10.4 Final canonical state

```
{
  "engineVersion": "kts-i1.0.0",
  "rulesetVersion": "kts-foundation-0.1",
  "seed": 1987041211,
  "rngState": 1987041211,
  "tick": 2400,
  "status": "running",
  "terminalReason": null,
  "score": 9381,
  "currentCoherenceTicks": 2400,
  "longestCoherenceTicks": 2400,
  "player": {
    "positionX": 536554,
    "positionY": 223846,
    "velocityX": 0,
    "velocityY": 0,
    "radius": 18000
  },
  "power": {
    "weapons": 34,
    "defence": 33,
    "signal": 33,
    "shiftCooldownTicks": 0
  },
  "weapon": {
    "fireCooldownTicks": 0,
    "nextProjectileId": 23
  },
  "recoveryPulse": {
    "cooldownTicks": 0
  },
  "defence": {
    "integrity": 10000,
    "ticksSinceDamage": 1699,
    "recoveryRemainder": 0
  },
  "signal": {
    "integrity": 5479,
    "ticksSinceDamage": 1799,
    "collapseTicks": 0,
    "recoveryRemainder": 0,
    "interferenceDamageRemainder": 0
  },
  "interference": {
    "load": 20
  },
  "projectiles": []
}
```

---

## 11. Dependency and configuration review

The following dependency files were checked:

- `package.json`
- `package-lock.json`
- `npm-shrinkwrap.json`

Result:

- no changes.

No package was installed or removed.

No build, test, lint, formatting, TypeScript, Cloudflare, or deployment configuration was modified.

---

## 12. Deviations

No authorized runtime requirement was knowingly omitted.

The following evidence qualifications are recorded:

1. The aggregate `npm run check` command is blocked by the pre-existing formatting state of the accepted KTS-F0.1 Foundation document.
2. Existing coverage instrumentation does not include the new engine files.
3. KTS-I1 implements deterministic RNG utilities, but current I1 mechanics do not consume randomness and therefore do not advance `rngState`.
4. KTS-I1 is a headless engine. It is not yet playable through a route or visual interface because those capabilities are outside this slice.

---

## 13. Limitations preserved by design

KTS-I1 does not yet include:

- enemies;
- enemy projectiles;
- collisions between projectiles and targets;
- waves;
- encounters;
- visual rendering;
- player controls connected to a browser;
- audio;
- adaptive learning;
- player modelling;
- strategic language-model guidance;
- persistence;
- replay storage;
- telemetry storage;
- network services.

These omissions are contract boundaries, not implementation defects.

---

## 14. Acceptance assessment

The implementation evidence supports the following assessment:

- authorized scope respected;
- deterministic engine implemented;
- fixed-step behaviour demonstrated;
- focused tests exceed the minimum requirement;
- all focused tests pass;
- complete repository tests pass;
- lint passes;
- application and test typechecking pass;
- production build passes;
- prohibited nondeterministic APIs are absent;
- dependency files are unchanged;
- canonical fixture is repeatable;
- canonical fixture remains nonterminal;
- canonical fixture enters and recovers from Critical Signal state;
- final canonical state and digest are recorded;
- implementation remains uncommitted for Nolan–Byte review.

**Recommended decision:** `ACCEPT KTS-I1 IMPLEMENTATION`

---

## 15. Current release boundary

Acceptance of KTS-I1 would establish the deterministic headless engine as the accepted foundation for subsequent Keep the Signal implementation slices.

It would not independently authorize:

- a browser route;
- renderer implementation;
- enemy systems;
- adaptive-agent implementation;
- local language-model integration;
- persistence;
- deployment.

Each subsequent slice requires its own accepted scope and authorization.

---

## 16. Acceptance record

**Decision:** `ACCEPT KTS-I1 IMPLEMENTATION`
**Decision date:** `2026-07-30`
**Accepted by:** Nolan
**Technical review:** Byte

KTS-I1 is accepted as the deterministic headless-engine foundation for Keep the Signal.

This acceptance does not authorize any subsequent route, renderer, enemy-system, adaptive-agent, language-model, persistence, or deployment slice.

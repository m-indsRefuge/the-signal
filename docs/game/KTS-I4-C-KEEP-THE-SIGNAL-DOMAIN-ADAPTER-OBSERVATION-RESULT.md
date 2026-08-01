# KTS-I4-C — Keep the Signal Domain Adapter and Observation Result

**Document ID:** KTS-I4-C-RESULT
**Status:** Authoritative repository validation complete; eligible for implementation acceptance
**Project:** Construct Intelligence Harness / Keep the Signal
**Governing architecture:** KTS-I4-A
**Accepted model bridge:** KTS-I4-B
**Accepted observation contract:** KTS-I4-C
**Authorized branch:** `game/keep-the-signal-i4-intelligence-harness`
**Accepted contract commit:** `9d75e08`
**Implementation base:** `9d75e08`
**Implementation checkpoint:** The commit containing this result record and the ten authorized production and test paths
**Validation date:** 2026-08-01
**Operator:** Nolan
**AI collaborator:** Byte through OpenAI
**Core doctrine:** The model may propose strategy. The governed system must prove it.

---

## 1. Result

KTS-I4-C successfully delivers the first domain-specific adapter for the Construct Intelligence Harness.

The adapter converts authoritative Keep the Signal engine state and engine events into bounded, versioned, immutable, JSON-compatible observation packets.

Implemented capabilities:

- observation schema and adapter identity;
- caller-supplied observation and lineage identity;
- accepted engine-state validation;
- accepted source-state digest preservation;
- Level 0 tactical-state projection;
- Level 1 deterministic local-situation summary;
- bounded player-projectile projection;
- nearest-first enemy and hostile-projectile selection;
- bounded recent-event projection;
- explicit projection for every accepted engine-event variant;
- static player-action vocabulary;
- factual action readiness and constraints;
- deterministic truncation metadata;
- canonical observation serialization;
- typed closed failure handling;
- deep output immutability;
- caller-mutation isolation.

The adapter does not invoke a model, construct a prompt, produce advice, validate proposals, execute actions, mutate the engine, persist observations, create memory, or train a model.

---

## 2. Exact implementation paths

Production:

```text
app/features/keep-the-signal/intelligence-adapter/observation-contract.ts
app/features/keep-the-signal/intelligence-adapter/observation-failures.ts
app/features/keep-the-signal/intelligence-adapter/event-window.ts
app/features/keep-the-signal/intelligence-adapter/action-space.ts
app/features/keep-the-signal/intelligence-adapter/observation-projection.ts
app/features/keep-the-signal/intelligence-adapter/index.ts
```

Tests:

```text
test/keep-the-signal-intelligence-observation-contract.test.ts
test/keep-the-signal-intelligence-event-window.test.ts
test/keep-the-signal-intelligence-observation-projection.test.ts
test/keep-the-signal-intelligence-boundaries.test.ts
```

Result record:

```text
docs/game/KTS-I4-C-KEEP-THE-SIGNAL-DOMAIN-ADAPTER-OBSERVATION-RESULT.md
```

Total authorized implementation paths:

```text
11
```

---

## 3. Schema identity

```text
observationSchemaId:      kts.observation
observationSchemaVersion: 1
adapterId:                keep-the-signal
adapterVersion:           KTS-I4-C
supportedLevels:          0, 1
```

Observation identity is supplied by the caller. The adapter uses no hidden randomness, wall clock, or generated identity.

---

## 4. Included authoritative facts

The public observation includes bounded projections of:

- engine and ruleset version;
- seed, tick, status, and terminal reason;
- source-state digest;
- encounter phase and wave progression;
- player position, velocity, radius, and factual movement direction;
- power allocations and shift cooldown;
- Defence integrity and damage age;
- Signal integrity, damage age, and collapse ticks;
- interference load;
- weapon and recovery cooldowns;
- active player projectiles;
- active enemies;
- active enemy projectiles;
- recent engine events;
- static action vocabulary;
- current action readiness and constraints;
- collection source, included, and omitted counts;
- event age and count truncation;
- optional session, episode, source, and predecessor identity.

---

## 5. Excluded engine internals

The public observation excludes:

```text
rngState
weapon.nextProjectileId
encounter.nextEnemyId
encounter.nextEnemyProjectileId
defence.recoveryRemainder
signal.recoveryRemainder
signal.interferenceDamageRemainder
canonical serialized engine state
future random values
mutable engine references
```

Enemy projection also excludes:

```text
destructionScore
escapeDefenceDamage
escapeSignalDamage
```

The source-state digest is produced by the accepted engine helper, but the canonical source-state text and hidden RNG state are not exposed.

---

## 6. Observation levels

### Level 0

Level 0 includes:

- provenance;
- lifecycle;
- player facts;
- resources;
- cooldowns;
- encounter facts;
- bounded entities;
- bounded recent events;
- action vocabulary;
- readiness and constraints;
- projection and truncation metadata.

### Level 1

Level 1 adds deterministic aggregates:

- enemy counts by archetype;
- hostile-projectile counts by kind;
- player-projectile count;
- current-wave resolved and remaining counts;
- total resolved encounter count;
- wave progress basis points;
- readiness flags;
- nearest enemy and hostile projectile;
- source and included active-entity counts;
- recent-event counts by type.

It adds no prediction, tactical rank, recommendation, value estimate, or strategic claim.

---

## 7. Entity ordering and truncation

Player projectiles:

```text
selection: ascending ID
output:    ascending ID
```

Enemies:

```text
selection: nearest squared distance, then lower ID
output:    ascending ID after selection
```

Enemy projectiles:

```text
selection: nearest squared distance, then lower ID
output:    ascending ID after selection
```

Every collection records:

- source count;
- included count;
- omitted count;
- truncation state;
- selection-policy identity.

Distance uses squared integer coordinates and no square root.

---

## 8. Event projection

The adapter explicitly projects all 27 accepted engine-event variants.

Event ordering:

1. ascending engine tick;
2. original caller sequence for equal ticks.

Window selection:

1. reject future events;
2. apply explicit start tick when supplied;
3. apply maximum event age;
4. retain newest eligible events under the count budget;
5. preserve chronological order in the final packet.

Every projected event includes:

- engine event type;
- engine tick;
- observation-local sequence;
- selected factual details;
- source ID when supplied by the engine event.

Unknown event types fail closed.

---

## 9. Action boundary

The adapter exposes the static action vocabulary:

```text
moveX: -1, 0, 1
moveY: -1, 0, 1
fire: boolean
recoveryPulse: boolean
six directed power shifts
```

Readiness is derived from accepted facts:

- cooldown state;
- projectile capacity;
- power floor;
- power ceiling;
- transfer increment.

Readiness is not labelled as guaranteed acceptance, recommendation, or optimality.

Focused parity tests compare representative readiness outputs with accepted engine outcomes.

---

## 10. Failure taxonomy

The implementation defines the required 11 failure codes:

```text
invalid_observation_request
invalid_observation_id
invalid_observation_level
invalid_budget
invalid_engine_state
invalid_event_window
future_event
unknown_event_type
projection_budget_exceeded
observation_not_json
adapter_internal_failure
```

Failures contain:

- typed code;
- stage;
- safe message;
- observation identity when valid;
- authoritative state tick when safely available;
- optional cloned immutable diagnostics.

Raw engine exceptions and canonical engine state do not cross the public boundary.

---

## 11. Immutability and determinism

The implementation verifies:

- no state mutation;
- no event mutation;
- no mutable engine references;
- caller mutation after projection cannot change output;
- output records and arrays are deeply frozen;
- repeated projection produces equivalent independent records;
- deterministic ordering and tie-breaking;
- stable canonical serialization for identical input;
- no time, randomness, storage, network, or provider dependency.

---

## 12. Observation budgets

Required budget fields:

```text
maximumPlayerProjectiles
maximumEnemies
maximumEnemyProjectiles
maximumRecentEvents
maximumEventAgeTicks
maximumSerializedCharacters
```

Collection and event budgets may be zero.

The serialized-character budget must be positive.

Projection fails with `projection_budget_exceeded` when the final canonical observation is above the configured character limit.

No token estimation is introduced.

---

## 13. Validation repair

The first authoritative focused run produced:

```text
Functional tests passed: 117
Boundary tests failed:    15
```

All 15 failures had one cause: the boundary test attempted to read repository-relative source paths through `node:fs`, but the Cloudflare Vitest worker resolved those paths under its bundled `/bundle` root.

The repair changed only:

```text
test/keep-the-signal-intelligence-boundaries.test.ts
```

It replaced host-filesystem source reads with Vite `?raw` source imports.

The repair:

- preserved all 132 named focused tests;
- preserved all existing prohibited-pattern assertions;
- changed no production code;
- changed no engine or model-bridge code;
- changed no contract;
- changed no package, lock, Wrangler, route, runtime, presentation, player, or deployment file;
- did not weaken any accepted boundary.

After the repair, all boundary tests executed against the six actual bundled production-source texts and passed.

---

## 14. Focused KTS-I4-C validation

Authoritative focused result:

```text
Test files: 4 passed
Tests:      132 passed
Duration:   1.07 seconds
```

Coverage includes:

- accepted schema and adapter identity;
- supported observation levels;
- observation-ID validation;
- budget validation;
- JSON compatibility;
- deep freezing;
- all 27 engine-event variants;
- event-field minimization;
- event ordering and stable same-tick sequence;
- event age and count budgets;
- future-event and unknown-event rejection;
- Level 0 and Level 1 projection;
- provenance and state digest;
- lifecycle, player, resource, cooldown, and encounter projection;
- deterministic entity ordering and truncation;
- nearest-entity tie-breaking;
- static action vocabulary;
- engine-parity readiness checks;
- canonical serialization stability;
- caller-mutation isolation;
- internal-field exclusion;
- typed failures;
- serialized-character budget enforcement;
- prohibited imports and APIs.

---

## 15. Complete repository validation

Authoritative repository result:

```text
Test files: 25 passed
Tests:      783 passed
Duration:   6.97 seconds
```

This includes:

- KTS-I4-C observation tests;
- KTS-I4-B model-bridge tests;
- accepted Keep the Signal engine tests;
- encounter tests;
- runtime tests;
- presentation tests;
- player-surface tests;
- procedural-audio tests;
- route and platform tests.

No existing repository regression was observed.

---

## 16. Type, build, and quality gates

The authoritative repository completed:

```text
Cloudflare and route type generation: PASS
Application typecheck:               PASS
Test typecheck:                      PASS
Production client build:             PASS
Production SSR build:                PASS
ESLint:                              PASS
Prettier format check:               PASS
git diff --check:                    PASS
```

Build evidence:

```text
Client modules transformed: 119
SSR modules transformed:    116
```

Wrangler regenerated existing project types during the accepted typecheck command. No Wrangler configuration or dependency change was introduced.

---

## 17. Static security and isolation scan

The six production adapter files were scanned with no prohibited matches.

No production use was found for:

```text
fetch
XMLHttpRequest
WebSocket
localStorage
sessionStorage
indexedDB
process.env
Deno.env
Bun.env
eval
new Function
Date.now
performance.now
Math.random
crypto.getRandomValues
stepGame
runSimulation
React imports
runtime imports
presentation imports
player imports
route imports
provider imports
model invocation
```

The exact working-tree status contained only the eleven authorized KTS-I4-C implementation paths.

Authoritative validation therefore confirmed:

- no KTS engine change;
- no KTS runtime change;
- no KTS presentation change;
- no KTS player change;
- no route or home change;
- no accepted model-bridge change;
- no package or lock-file change;
- no Wrangler or deployment change;
- no hero change;
- no unrelated repository change.

---

## 18. Authority and isolation

The adapter remains observation-only.

It does not:

- step the engine;
- run simulation;
- create or change a tick frame;
- predict RNG;
- produce tactical advice;
- invoke the accepted model bridge;
- choose a model;
- call a provider;
- validate a future model proposal;
- execute an action;
- create memory;
- retrieve memory;
- persist observations;
- create training evidence;
- train or fine-tune;
- modify gameplay or presentation.

The deterministic engine remains the sole gameplay authority.

---

## 19. Protected repository state

The protected hero stash remained intact:

```text
stash@{0}: On design/foundation-0.1: WIP hero landing page before Keep the Signal foundation
```

No stash was applied, dropped, modified, or replaced.

Nothing was pushed, merged, deployed, invoked, persisted, trained, or fine-tuned during KTS-I4-C implementation validation.

---

## 20. Known limitations and deferred work

Deferred:

- runtime lifecycle context;
- prompt construction;
- live local-provider adapter;
- remote-provider adapter;
- tactical proposal schema;
- proposal validation;
- recommendation display;
- session and episodic memory;
- semantic and procedural memory;
- retrieval;
- evidence ledger;
- cryptographic observation digest;
- training-example generation;
- LoRA or QLoRA;
- preference optimization;
- planning;
- counterfactual simulation;
- persistence;
- deployment.

These are not KTS-I4-C defects.

---

## 21. Final classification

```text
Contract acceptance:                PASS
Implementation authorization:       PASS
Implementation delivery:            COMPLETE
Focused deterministic tests:        132/132 PASS
Complete repository tests:          783/783 PASS
Repository test files:              25/25 PASS
All engine-event variants:          27/27 PASS
Typecheck:                          PASS
Production build:                   PASS
Lint:                               PASS
Format:                             PASS
Diff check:                         PASS
Static prohibited scan:             PASS
Accepted KTS boundaries:            PRESERVED
Accepted model-bridge boundary:      PRESERVED
Protected hero stash:               PRESERVED
Live model invocation:              none
Engine mutation:                    none
Observed implementation defects:    none remaining
Classification:                     successful_implementation_validation
```

KTS-I4-C is eligible for formal implementation acceptance after the exact eleven authorized paths are committed and the resulting checkpoint is verified.

The exact acceptance phrase is:

```text
ACCEPT KTS-I4-C IMPLEMENTATION
```

Acceptance does not authorize push, pull request creation, merge, deployment, provider integration, model invocation, persistence, memory integration, training, or fine-tuning.

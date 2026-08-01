# KTS-I4-C — Keep the Signal Domain Adapter and Observation Contract

**Document ID:** KTS-I4-C-CONTRACT
**Status:** Proposed implementation contract
**Project:** Construct Intelligence Harness / Keep the Signal
**Governing architecture:** KTS-I4-A
**Accepted model bridge:** KTS-I4-B
**Base commit:** `9262011`
**Target branch:** `game/keep-the-signal-i4-intelligence-harness`
**Implementation authorization:** Not granted by this document
**Core doctrine:** The model may propose strategy. The governed system must prove it.

---

## 1. Purpose

KTS-I4-C defines the first domain-specific adapter for the Construct Intelligence Harness.

The adapter converts accepted authoritative Keep the Signal engine state and accepted engine events into bounded, versioned, immutable, JSON-compatible observation packets suitable for later model invocation, evaluation, training-evidence generation, and memory systems.

This slice creates observation infrastructure only.

It does not:

- invoke a model;
- construct a gameplay prompt;
- produce tactical advice;
- validate model proposals;
- execute game actions;
- mutate engine state;
- persist observations;
- create memory;
- train or fine-tune;
- alter gameplay, rendering, audio, routes, or controls.

The deterministic Keep the Signal engine remains the sole gameplay authority.

---

## 2. Architectural position

```text
Authoritative KTS GameState and EngineEvent records
    ↓ read-only validated input
KTS domain adapter
    ↓ bounded immutable observation packet
Construct Intelligence Harness
    ↓ future invocation request
Provider-neutral model bridge
    ↓ future validated proposal
Future KTS proposal validator
    ↓ accept or reject
Authoritative KTS engine
```

KTS-I4-C implements only the first downward projection.

There is no path from the adapter back into the engine.

---

## 3. Governing principles

### 3.1 Projection, not interpretation

The adapter may:

- copy authoritative facts;
- normalize accepted engine values;
- calculate deterministic aggregates;
- sort and truncate according to explicit budgets;
- preserve version and source identity;
- distinguish state facts from event evidence;
- expose the static action vocabulary;
- expose current factual constraints and readiness.

The adapter may not:

- claim that one strategy is superior;
- infer player intent;
- predict future RNG outcomes;
- label an action tactically correct;
- invent threats;
- estimate hidden state;
- assign model confidence;
- construct memories;
- promote an abstraction into knowledge.

### 3.2 No engine authority

The adapter must not:

- call `stepGame`;
- call `runSimulation`;
- construct or modify a `TickFrame`;
- write to a `GameState`;
- modify event records;
- change RNG state;
- create enemies or projectiles;
- award score;
- apply damage;
- advance waves;
- accept or reject actions.

### 3.3 No mutable engine references

No public observation record may contain:

- a `GameState` reference;
- an `EngineEvent` reference;
- an enemy or projectile reference;
- a mutable engine-owned array;
- a callback into the engine;
- a class instance;
- a function;
- cyclic data.

All public output must be cloned into adapter-owned JSON-compatible records and treated as immutable.

---

## 4. Transfer boundary

The generic harness remains domain-independent.

The KTS adapter belongs inside the Keep the Signal feature boundary:

```text
app/features/keep-the-signal/intelligence-adapter/
```

The adapter may import:

```text
app/features/keep-the-signal/engine/
app/features/intelligence-harness/model-bridge/json-types.ts
```

The adapter may not import:

```text
app/features/keep-the-signal/runtime/
app/features/keep-the-signal/presentation/
app/features/keep-the-signal/player/
app/routes/
React
Canvas
Web Audio
provider adapters
future memory systems
```

The generic model bridge must not import the KTS adapter.

Dependency direction is:

```text
KTS adapter → accepted engine types and pure validation/digest helpers
KTS adapter → generic JSON boundary types
```

Never:

```text
generic model bridge → KTS adapter
engine → intelligence harness
```

---

## 5. Authorized implementation paths

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

No other path is authorized without an accepted contract amendment.

---

## 6. Accepted authoritative inputs

The adapter accepts only explicit caller-supplied inputs.

Required input:

- one `Readonly<GameState>`;
- one bounded or unbounded `readonly EngineEvent[]`;
- one explicit observation budget;
- one explicit requested observation level;
- one caller-supplied observation ID.

Optional input:

- an explicit source label;
- an explicit session or episode reference;
- an explicit previous observation identity for lineage;
- an explicit event-window start tick.

The adapter must not reach into:

- browser runtime state;
- React state;
- Canvas state;
- global variables;
- local storage;
- session storage;
- IndexedDB;
- network services;
- model-provider state.

---

## 7. Engine-state validation

Before projection, the adapter must validate the supplied authoritative state using accepted engine validation.

Required behaviour:

- invalid engine state returns a typed adapter failure;
- raw engine exceptions do not cross the public adapter boundary;
- validation occurs before public projection;
- validation must not mutate the supplied state;
- a valid state is projected exactly as supplied;
- the adapter does not repair invalid state;
- the adapter does not silently normalize invalid engine values.

The adapter may use accepted canonical-state serialization and state-digest helpers for source identity.

The adapter must not introduce a second competing definition of valid game state.

---

## 8. Observation identity and versioning

Every observation packet must include immutable metadata:

- `observationId`;
- `observationSchemaId`;
- `observationSchemaVersion`;
- `adapterId`;
- `adapterVersion`;
- `requestedLevel`;
- `sourceStateDigest`;
- `engineVersion`;
- `rulesetVersion`;
- `seed`;
- `tick`;
- optional `sessionId`;
- optional `episodeId`;
- optional `previousObservationId`;
- optional source label.

Required initial constants:

```text
observationSchemaId: kts.observation
observationSchemaVersion: 1
adapterId: keep-the-signal
adapterVersion: KTS-I4-C
```

The exact string representation may be encoded as literal constants.

No observation ID may be generated through hidden randomness.

The adapter must reject empty or malformed caller-supplied observation IDs.

---

## 9. Observation levels

KTS-I4-C implements two levels.

### Level 0 — Tactical state

Level 0 contains the immediate authoritative facts required to understand the current engine state.

It includes:

- lifecycle;
- player;
- resources;
- cooldowns;
- encounter;
- active entities;
- bounded recent events;
- static action vocabulary;
- factual action constraints;
- projection budget and truncation metadata;
- provenance.

### Level 1 — Local situation summary

Level 1 contains all Level 0 fields plus deterministic aggregates:

- enemy counts by archetype;
- hostile-projectile counts by kind;
- player-projectile count;
- current-wave resolution counts;
- current-wave remaining count;
- encounter-total resolved counts;
- resource ratios or normalized values;
- readiness flags derived directly from cooldown values;
- nearest enemy identity and squared distance when present;
- nearest hostile projectile identity and squared distance when present;
- active entity counts before and after truncation;
- recent-event counts by type.

Level 1 may not contain:

- predicted trajectories;
- tactical rankings;
- danger scores;
- action recommendations;
- learned value estimates;
- semantic memories;
- strategic claims.

### Deferred levels

The following remain deferred:

```text
Level 2 — Episode trajectory
Level 3 — Retrieved strategic context
Level 4 — Approved cross-domain principles
```

They require later memory, evidence, retrieval, and strategy contracts.

---

## 10. Explicitly excluded engine fields

The public observation must not expose engine-internal state that is unnecessary for legitimate model observation or could permit hidden-state exploitation.

Excluded by default:

- `rngState`;
- `nextProjectileId`;
- `nextEnemyId`;
- `nextEnemyProjectileId`;
- recovery remainders;
- interference-damage remainders;
- other fixed-point implementation remainders;
- mutable arrays or objects from `GameState`;
- canonical serialized state text;
- future spawn rolls;
- unconsumed future random values.

The adapter may expose the authoritative seed because the game already treats the seed as public run identity.

Excluding RNG state is mandatory.

A later research contract may create an omniscient benchmark observation, but it must be a separate schema and may not be confused with the player-facing observation.

---

## 11. Lifecycle projection

The observation lifecycle must preserve:

- authoritative engine status;
- terminal reason;
- encounter phase;
- encounter completion;
- current tick.

The adapter must distinguish:

- engine terminal state;
- completed encounter state;
- active encounter;
- intermission.

The adapter does not own browser lifecycle states such as:

- idle;
- paused;
- replaying;
- timing interruption.

Those belong to the runtime layer and are not part of KTS-I4-C.

A later runtime-aware context wrapper may combine engine observation with runtime lifecycle through a separate contract.

---

## 12. Player projection

The player projection may include:

- position X and Y;
- velocity X and Y;
- radius.

It must not include a mutable player object.

The adapter may calculate deterministic factual values such as:

- moving or stationary;
- horizontal movement sign;
- vertical movement sign.

It may not infer:

- intended destination;
- evasion strategy;
- preferred movement;
- player skill.

---

## 13. Resource projection

The observation may include:

### Power

- weapons allocation;
- Defence allocation;
- Signal allocation;
- shift cooldown ticks.

### Defence

- current integrity;
- ticks since damage;
- normalized integrity ratio.

### Signal

- current integrity;
- ticks since damage;
- collapse ticks;
- normalized integrity ratio.

### Interference

- current load;
- normalized load when a governing maximum is available from accepted constants.

Internal recovery and damage remainders remain excluded.

Normalized values must be deterministic, finite, bounded, and derived only from accepted engine constants.

---

## 14. Cooldown projection

The observation may include:

- weapon fire cooldown ticks;
- power-shift cooldown ticks;
- recovery-pulse cooldown ticks.

Level 1 may include factual readiness flags:

```text
fireReady
powerShiftReady
recoveryPulseReady
```

A readiness flag means only that the relevant cooldown is zero and any static capacity constraint represented by the accepted state permits an attempt.

It does not promise the action will produce a desired result.

---

## 15. Encounter projection

The encounter projection may include:

- phase;
- wave number;
- phase ticks;
- spawn cooldown ticks;
- enemies scheduled;
- enemies spawned;
- enemies defeated;
- enemies escaped;
- total enemies defeated;
- total enemies escaped.

The observation must exclude:

- next enemy ID;
- next enemy-projectile ID.

Level 1 may deterministically calculate:

- current-wave resolved count;
- current-wave remaining count;
- encounter-total resolved count;
- wave progress ratio.

No projected value may imply future spawn identity or future RNG outcome.

---

## 16. Entity projection

### 16.1 Player projectiles

Permitted fields:

- ID;
- position;
- velocity;
- radius;
- remaining ticks.

Excluded fields:

- next projectile ID;
- mutable engine reference.

### 16.2 Enemies

Permitted fields:

- ID;
- archetype;
- position;
- velocity;
- radius;
- integrity;
- maximum integrity;
- fire cooldown ticks;
- fire interval ticks.

The adapter may calculate:

- integrity ratio;
- factual fire-ready state;
- squared distance from player.

The adapter must not expose score or damage configuration fields as though the player directly observes enemy internals unless the contract explicitly marks them as public rules metadata.

KTS-I4-C excludes:

- destruction score;
- escape Defence damage;
- escape Signal damage.

These remain engine rules, not immediate observation facts.

### 16.3 Enemy projectiles

Permitted fields:

- ID;
- owner enemy ID;
- kind;
- position;
- velocity;
- radius;
- raw damage;
- remaining ticks;
- squared distance from player.

Projectile raw damage is accepted public tactical information for this initial harness observation.

A later player-fidelity study may compare observations with and without exact raw damage.

---

## 17. Deterministic entity ordering

Before budget truncation:

- player projectiles are sorted by ascending ID;
- enemies are sorted by ascending ID;
- enemy projectiles are sorted by ascending ID.

The adapter must not rely on caller array order.

For nearest-entity aggregates:

1. compare squared Euclidean distance using authoritative integer positions;
2. lower squared distance wins;
3. exact ties are broken by lower entity ID.

No floating-point square root is required.

---

## 18. Observation budgets

Every projection requires an explicit immutable budget.

Required fields:

- maximum player projectiles;
- maximum enemies;
- maximum enemy projectiles;
- maximum recent events;
- maximum event age in ticks;
- maximum serialized characters.

Budget rules:

- all values must be non-negative safe integers;
- maximum serialized characters must be positive;
- no hidden default may silently widen a caller budget;
- a reusable accepted default constant may be exported;
- projection above the serialized-character budget must fail;
- entity truncation must be deterministic;
- event truncation must be deterministic;
- truncation must be recorded in metadata;
- omitted counts must be reported.

KTS-I4-C does not perform token estimation.

---

## 19. Entity truncation

When an entity collection exceeds its budget:

### Player projectiles

Retain lowest IDs first.

### Enemies

Retain nearest enemies first using squared distance, with lower ID as tie-breaker.

### Enemy projectiles

Retain nearest hostile projectiles first using squared distance, with lower ID as tie-breaker.

Every output must record:

- source count;
- included count;
- omitted count;
- whether truncation occurred;
- selection policy identifier.

Truncation affects observation representation only. It does not affect engine state.

---

## 20. Event-window input

The caller supplies an engine-event sequence.

The adapter must:

- clone accepted event facts;
- validate event ticks as non-negative safe integers;
- reject events whose tick is later than the state tick;
- sort events deterministically;
- remove no duplicate event merely because two events share a type;
- preserve distinct events at the same tick;
- apply age and count budgets;
- report omitted counts;
- avoid mutable event references.

The adapter does not reach into runtime event feeds or session records.

---

## 21. Event ordering and identity

Engine events do not all expose a universal event ID.

The adapter must create a deterministic event-window index without claiming a new authoritative engine event identity.

Required ordering:

1. ascending event tick;
2. original caller sequence index as a stable tie-breaker.

After filtering and ordering, recent-event selection retains the newest eligible events up to the count budget while preserving chronological order in the final packet.

Each projected event includes:

- engine event type;
- engine tick;
- projected event sequence within the observation;
- selected safe event fields;
- optional source ID when supplied by the engine event.

The observation-local sequence is not a persistent memory ID.

---

## 22. Event projection

The adapter must support every accepted `EngineEvent` variant.

The projection should preserve safe factual fields for:

- power shifts;
- rejected actions;
- player projectile lifecycle;
- enemy spawn and fire;
- enemy projectile lifecycle;
- player hits on enemies;
- enemy damage and destruction;
- score awards;
- hostile hits on player;
- enemy escape;
- wave start and completion;
- encounter completion;
- recovery pulse;
- Defence damage and recovery;
- Signal damage and recovery;
- interference changes;
- collapse start and avert;
- game termination;
- score additions.

Unknown event variants must fail closed rather than being silently dropped.

The adapter must not expose an unvalidated event object through a generic spread operation.

---

## 23. Event minimization

Projected events must include only fields necessary to preserve tactical and evidentiary meaning.

The adapter must not add:

- model commentary;
- strategic labels;
- inferred causal explanations;
- hidden engine references;
- callbacks;
- full state snapshots.

Event projection is evidence minimization, not information expansion.

---

## 24. Action-space description

KTS-I4-C may expose the static KTS player action vocabulary:

```text
movement:
  moveX ∈ {-1, 0, 1}
  moveY ∈ {-1, 0, 1}

fire:
  boolean

recoveryPulse:
  boolean

powerShift:
  weapons → defence
  weapons → signal
  defence → weapons
  defence → signal
  signal → weapons
  signal → defence
```

It may expose current factual constraints:

- fire cooldown ticks;
- recovery cooldown ticks;
- power-shift cooldown ticks;
- current projectile count;
- accepted engine projectile capacity;
- current channel allocations;
- accepted power floor and ceiling when exported by the engine constants.

It must not describe an action as strategically good.

---

## 25. Action readiness versus legality

KTS-I4-C may expose readiness, not final action legality.

Readiness is a factual projection such as:

- cooldown is zero;
- projectile capacity is available;
- source channel is above the accepted transfer floor;
- destination channel is below the accepted transfer ceiling;
- source and destination differ.

Final legality remains owned by the authoritative engine and the future proposal validator.

The observation must label these values as:

```text
readiness
constraints
```

not:

```text
guaranteedAccepted
optimal
recommended
```

Parity tests must compare readiness calculations against accepted engine outcomes for representative valid states.

If parity cannot be proved without duplicating unstable engine logic, the adapter must expose raw constraints and defer the readiness flag.

---

## 26. Failure taxonomy

The public adapter must use a closed typed failure taxonomy.

Required initial failure codes:

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

Every failure must include:

- failure code;
- safe public message;
- stage;
- observation ID when valid;
- state tick when safely available;
- optional safe diagnostic metadata.

Raw engine exceptions, local paths, full canonical state, and mutable input data must not cross the public boundary.

---

## 27. Success result

A successful adapter result must contain:

```text
ok: true
observation: immutable KTS observation packet
```

The packet must be:

- JSON-compatible;
- deeply cloned;
- deeply frozen or otherwise immutable;
- versioned;
- deterministic for identical validated input and budget;
- bounded;
- free of excluded engine fields;
- independent of caller mutation after projection.

Success must be impossible when:

- state validation fails;
- event validation fails;
- an unknown event variant is encountered;
- the budget is invalid;
- serialized output exceeds its character budget;
- output is not JSON-compatible.

---

## 28. Canonical stability

For identical:

- authoritative state;
- event sequence;
- observation ID;
- source metadata;
- level;
- budget;
- adapter version;

the adapter must produce byte-identical canonical JSON serialization.

KTS-I4-C may provide a canonical serializer for observation testing and future evidence integration.

KTS-I4-C must not define a cryptographic observation digest.

A later evidence-ledger release may calculate a cryptographic digest over canonical observation bytes.

---

## 29. Immutability requirements

Tests must prove:

- projection does not mutate `GameState`;
- projection does not mutate event records;
- caller mutation after projection cannot change the observation;
- observation mutation attempts cannot change internal adapter state;
- repeated projection returns equivalent but independent records;
- budget records are cloned;
- metadata records are cloned;
- arrays are immutable from the public interface.

Deep freezing may reuse accepted JSON-boundary utilities from KTS-I4-B.

---

## 30. Runtime and performance

Projection must be synchronous and bounded.

It must not:

- invoke a model;
- wait on a timer;
- use a worker;
- perform network I/O;
- perform storage I/O;
- use wall-clock time;
- use randomness;
- allocate unbounded histories.

Required complexity targets:

- validation cost bounded by accepted engine-state validation;
- entity projection linear in supplied entity count plus deterministic sorting;
- event projection linearithmic at worst due to sorting;
- no search tree;
- no simulation;
- no counterfactual branching.

Performance tests must use accepted maximum-capacity engine states and oversized event windows.

---

## 31. Security and privacy

Production adapter files must contain no use of:

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
```

The adapter must contain no:

- credentials;
- provider configuration;
- telemetry;
- analytics;
- logging;
- prompt capture;
- model output;
- dynamic code execution.

---

## 32. Required tests

At least 80 focused named tests are required across the four authorized test files.

### Observation-contract tests

Coverage must include:

- schema and adapter constants;
- valid observation IDs;
- invalid observation IDs;
- supported levels;
- invalid levels;
- valid budgets;
- invalid budgets;
- JSON compatibility;
- immutable metadata;
- excluded-field assertions;
- failure taxonomy.

### Event-window tests

Coverage must include:

- every accepted event variant;
- event-field minimization;
- chronological ordering;
- same-tick stable ordering;
- recent-event count budget;
- event-age budget;
- future-event rejection;
- invalid tick rejection;
- unknown-event fail-closed behaviour;
- omitted-count reporting;
- immutable projection.

### Observation-projection tests

Coverage must include:

- valid Level 0 packet;
- valid Level 1 packet;
- engine and ruleset identity;
- state digest identity;
- lifecycle projection;
- player projection;
- resource projection;
- cooldown projection;
- encounter projection;
- every entity type;
- deterministic entity ordering;
- nearest-entity tie-breaking;
- entity budgets and truncation;
- readiness and constraint projection;
- canonical serialization stability;
- output-character budget;
- repeatability;
- caller-mutation isolation;
- output immutability.

### Boundary tests

Coverage must include:

- invalid engine state;
- no `rngState` in output;
- no next-ID counters in output;
- no internal remainders in output;
- no mutable engine references;
- no runtime imports;
- no presentation imports;
- no player imports;
- no React imports;
- no network, storage, clock, or randomness APIs;
- no model-bridge invocation;
- no `stepGame` or `runSimulation`;
- accepted maximum-capacity state;
- large event-window bounded performance;
- engine source remains unchanged.

---

## 33. Repository validation

Required validation before implementation acceptance:

```text
focused KTS-I4-C tests
complete repository tests
typecheck
production build
lint
format check
git diff --check
```

Required static scans over production paths:

- prohibited APIs from Section 31;
- runtime imports;
- presentation imports;
- player imports;
- route imports;
- React imports;
- provider imports;
- model invocation;
- state mutation patterns;
- `stepGame`;
- `runSimulation`.

Required boundary diffs:

- no KTS engine changes;
- no KTS runtime changes;
- no KTS presentation changes;
- no KTS player changes;
- no route or home changes;
- no model-bridge changes;
- no package changes;
- no lock-file changes;
- no Wrangler or deployment changes;
- hero stash unchanged.

---

## 34. Result record

Implementation must create:

```text
docs/game/KTS-I4-C-KEEP-THE-SIGNAL-DOMAIN-ADAPTER-OBSERVATION-RESULT.md
```

It must record:

- governing and contract commits;
- implementation commit;
- exact changed paths;
- schema constants;
- implemented observation levels;
- included fields;
- excluded fields;
- failure taxonomy;
- budget behaviour;
- test counts;
- repository totals;
- validation results;
- static scans;
- boundary diffs;
- performance evidence;
- known limitations;
- confirmation that no model was invoked;
- confirmation that no state was mutated;
- confirmation that the adapter remains observation-only.

---

## 35. Explicit non-goals

KTS-I4-C does not include:

- model invocation;
- a local model provider;
- a remote provider;
- prompts;
- tactical recommendations;
- action proposals;
- action validation;
- action execution;
- strategy memory;
- episodic memory;
- semantic memory;
- procedural skills;
- embeddings;
- retrieval;
- persistence;
- training examples;
- fine-tuning;
- LoRA or QLoRA;
- preference optimization;
- value models;
- planning;
- counterfactual simulation;
- algorithm search;
- React or HUD integration;
- gameplay changes;
- deployment.

---

## 36. Acceptance criteria

KTS-I4-C may be accepted only when:

- the adapter is read-only and observation-only;
- all outputs are bounded, versioned, immutable, and JSON-compatible;
- state validity is delegated to accepted engine validation;
- the public packet excludes RNG and internal implementation state;
- all accepted engine-event variants are explicitly projected;
- unknown events fail closed;
- entity and event truncation are deterministic and visible;
- Levels 0 and 1 are implemented without strategy interpretation;
- action vocabulary is descriptive and readiness is not confused with final legality;
- canonical serialization is stable;
- at least 80 focused tests pass;
- all repository gates pass;
- no accepted KTS or model-bridge code is changed;
- no model, memory, persistence, network, or training behaviour is introduced;
- the result record is complete.

---

## 37. Decision statements

Contract acceptance phrase:

```text
ACCEPT KTS-I4-C CONTRACT
```

Implementation authorization phrase:

```text
AUTHORIZE KTS-I4-C
```

Acceptance of this contract does not authorize implementation.

Authorization permits implementation only within the exact paths, constraints, and validation requirements defined here.

Push, pull request creation, merge, deployment, model invocation, provider integration, persistence, memory work, training, and fine-tuning remain separately unauthorized.

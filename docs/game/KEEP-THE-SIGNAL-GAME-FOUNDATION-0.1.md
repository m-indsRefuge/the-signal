# Keep the Signal — Game Foundation 0.1

**Document ID:** `KTS-F0.1`
**Project:** The Signal
**Subsystem:** Keep the Signal
**Status:** Accepted
**Implementation release:** None
**Runtime implementation authorized:** No
**Target branch:** `game/keep-the-signal-foundation-0.1`

---

## 1. Purpose

This document defines the first canonical game, engine, and Game-Agent foundation for **Keep the Signal**.

Keep the Signal is a retro-futurist arcade strategy game in which a human pilot protects a living transmission from an adaptive opposing intelligence.

The player controls a signal-carrying craft inside a bounded combat field. The player must balance movement, weapons, defence, and transmission power while the Game-Agent applies increasingly effective forms of interference.

The purpose of Foundation 0.1 is to establish:

- a deterministic and testable game engine;
- a simple but strategically meaningful player loop;
- explicit legal actions for both participants;
- a measurable definition of Signal preservation;
- a scoring system centred on coherence rather than destruction;
- an adaptive Game-Agent boundary;
- structured telemetry and replay;
- a stable interface for a future locally hosted LLM strategist.

This document does not authorize production implementation by itself. Runtime work begins only after explicit Nolan–Byte approval of this foundation and a separately scoped implementation contract.

---

## 2. Canonical premise

The player pilots a transmission craft through an artificial interference field.

The craft carries a Signal that must remain coherent for as long as possible. Hostile formations, distortion fields, resource pressure, and tactical deception threaten the transmission.

The opposing Game-Agent is not merely a collection of scripted enemies. It is an intelligence participating in the game under fixed rules.

Its role is to:

- study the player’s behaviour;
- select legal strategies;
- test tactical hypotheses;
- learn which forms of pressure are effective;
- become more capable through evidence gathered during play.

The surface relationship is competitive.

The deeper purpose is cooperative discovery: the human learns how to preserve coherence, while the Game-Agent learns how the human attempts to preserve it.

---

## 3. Core design statement

> Keep the Signal is a game of preserving coherence under adaptive pressure.

The player’s primary objective is not to destroy the greatest number of enemies.

The primary objective is:

> Maintain the longest continuous, meaningful transmission possible.

Enemy destruction, movement, defence, recovery, and power allocation exist in service of that objective.

---

## 4. Foundational principles

### 4.1 Simple controls, emergent strategy

The first game must be easy to understand and difficult to master.

Strategic depth should arise from:

- limited shared resources;
- competing priorities;
- player habits;
- adaptive opposition;
- spatial pressure;
- timing;
- sacrifice;
- recovery;
- prediction.

Complexity must not depend on a large number of weapons, abilities, currencies, or enemy types.

### 4.2 Deterministic rules

The engine is authoritative.

Given the same:

- game version;
- initial seed;
- initial state;
- ordered input sequence;
- fixed simulation timing;

the game must produce the same authoritative result.

Rendering, audio, frame rate, model latency, and visual effects must not alter the authoritative simulation.

### 4.3 Strategy is proposed; results are proven

The Game-Agent or LLM may propose a strategy.

Only the deterministic engine and recorded match evidence may determine whether that strategy succeeded.

> The model may propose strategy. The game system must prove it.

### 4.4 Fair opposition

The Game-Agent may only perform legal actions exposed by the game contract.

It must not:

- alter game rules during a match;
- read hidden player inputs that the game has not exposed;
- create impossible enemies or projectiles;
- change damage values outside the active ruleset;
- manipulate the score;
- falsify telemetry;
- silently increase difficulty;
- bypass resource costs or cooldowns.

### 4.5 Local-first intelligence

The first complete game must remain playable without:

- an internet connection;
- a cloud model;
- an authenticated account;
- a running local LLM service.

The embedded deterministic opponent and adaptive tactical policy must provide a complete fallback experience.

### 4.6 Inspectable learning

The player must eventually be able to inspect:

- what the agent observed;
- which tactics it selected;
- which tendencies it believes the player has;
- which outcomes changed its tactical values;
- when local strategy memory was created or updated.

Player-specific learning must be resettable.

---

## 5. Foundation 0.1 scope

Foundation 0.1 defines one bounded arcade arena with:

- one player craft;
- smooth two-dimensional movement;
- one standard weapon;
- one recovery pulse;
- three shared power channels;
- one Signal-integrity system;
- three initial enemy archetypes;
- three initial Game-Agent tactics;
- escalating waves;
- deterministic seeds;
- match telemetry;
- replay support;
- a tactical adaptation boundary;
- a local LLM strategist port.

The initial three power channels are:

1. Weapons
2. Defence
3. Signal

The initial three Game-Agent tactics are:

1. Direct Assault
2. Resource Exhaustion
3. Signal Interference

Additional tactics and enemy archetypes are deferred until these systems are proven.

---

## 6. Game loop

A run consists of sequential waves.

Each wave contains three logical phases.

### 6.1 Transmission phase

The player earns score while the Signal remains coherent.

Low or moderate pressure is present. The player may reposition, restore power balance, and prepare for escalation.

### 6.2 Interference phase

The Game-Agent selects and executes one legal tactic.

Enemy formations and interference behaviour are generated from:

- the active tactic;
- current difficulty;
- current game state;
- deterministic random seed;
- player-model context where enabled.

### 6.3 Recovery window

The immediate pressure decreases for a limited period.

The player may:

- restore Signal integrity;
- rebalance power;
- reposition;
- prepare for the next wave.

The recovery window must not guarantee full restoration.

The next wave begins when the recovery duration expires or its completion condition is reached.

---

## 7. Authoritative simulation model

### 7.1 Fixed simulation step

The authoritative engine uses a fixed simulation step.

Initial target:

```text
60 logical ticks per second
```

Rendering may interpolate between authoritative states but must not introduce simulation decisions.

### 7.2 Authoritative state

The minimum authoritative state includes:

```text
Match
├── version
├── seed
├── tick
├── phase
├── wave
├── difficulty
├── score
├── coherence streak
├── player
├── Signal
├── enemies
├── projectiles
├── hazards
├── active tactic
├── power state
├── cooldowns
├── deterministic random state
└── terminal state
```

### 7.3 Coordinate system

The first arena uses a normalized two-dimensional coordinate system.

Recommended authoritative range:

```text
X: 0.0 to 1.0
Y: 0.0 to 1.0
```

Rendering converts normalized coordinates to the current canvas size.

This prevents display resolution from changing gameplay.

---

## 8. Player craft

The player craft contains:

- position;
- velocity;
- movement limit;
- defence integrity;
- Signal integrity;
- weapon state;
- power allocation;
- recovery-pulse state;
- collision boundary;
- active status.

The player craft may remain physically active while the Signal is critically damaged.

The player does not lose merely because the craft receives one impact.

The run ends when Signal coherence becomes unrecoverable under the defined terminal-state rules.

---

## 9. Player actions

Foundation 0.1 exposes the following player actions.

### 9.1 Move

The player may apply directional movement within the arena boundary.

Movement must have:

- bounded acceleration;
- bounded maximum speed;
- deterministic friction or deceleration;
- no dependency on render frame rate.

### 9.2 Fire

The player fires one standard forward projectile.

Firing consumes weapon capacity determined by the current Weapons power allocation.

Low Weapons power may reduce:

- fire rate;
- projectile effectiveness;
- sustained firing duration.

### 9.3 Shift power

The player may redirect power among:

- Weapons;
- Defence;
- Signal.

Total power must always remain conserved.

Initial power model:

```text
Total allocatable power: 100 units
Minimum per channel: 10 units
Maximum per channel: 70 units
```

Initial balanced allocation:

```text
Weapons: 34
Defence: 33
Signal: 33
```

Power transfer may occur continuously or in fixed increments. The implementation contract must choose one model and test it consistently.

### 9.4 Recovery pulse

The player may activate a limited recovery pulse.

The recovery pulse may:

- remove nearby interference projectiles;
- temporarily reduce Signal degradation;
- restore a bounded amount of Signal integrity;
- interrupt selected hostile effects.

It must have:

- a fixed cost or cooldown;
- a deterministic radius;
- a bounded effect;
- no ability to restore a failed run after terminal collapse.

---

## 10. Power allocation

Power allocation is the first canonical strategic mechanic.

Increasing one channel necessarily limits the others.

### 10.1 Weapons power

Higher Weapons allocation improves offensive capability.

Possible effects include:

- reduced firing interval;
- improved projectile strength;
- increased sustained fire.

### 10.2 Defence power

Higher Defence allocation improves craft protection.

Possible effects include:

- reduced impact damage;
- faster defence regeneration;
- increased resistance to collision or projectile pressure.

### 10.3 Signal power

Higher Signal allocation improves transmission preservation.

Possible effects include:

- reduced passive coherence loss;
- stronger recovery;
- improved resistance to interference;
- increased scoring efficiency.

### 10.4 Strategic consequence

No single allocation should be universally optimal.

The design must create meaningful situations where:

- high Weapons power solves immediate pressure but exposes the Signal;
- high Defence power preserves the craft but slows threat removal;
- high Signal power improves coherence but limits direct resistance.

---

## 11. Signal integrity

Signal integrity is represented on an authoritative scale:

```text
0 to 100
```

### 11.1 Integrity states

Recommended initial states:

```text
Stable:   70–100
Strained: 40–69
Critical: 1–39
Collapsed: 0
```

### 11.2 Integrity loss

Signal integrity may be reduced by:

- active interference fields;
- selected enemy proximity;
- direct corruption attacks;
- unmitigated craft impacts;
- insufficient Signal power;
- sustained overload;
- specific Game-Agent tactics.

### 11.3 Integrity recovery

Signal integrity may recover through:

- sufficient Signal power allocation;
- clearing interference sources;
- recovery windows;
- recovery-pulse activation;
- sustained safe conditions.

Recovery must be bounded and slower under increasing difficulty.

### 11.4 Collapse grace period

Reaching zero Signal integrity does not immediately terminate the run.

Initial collapse grace period:

```text
3 authoritative seconds
```

During this period, the player may restore integrity above zero through legal recovery actions.

If integrity remains at zero when the grace period expires, the run ends.

This supports failure, emergency response, and recovery without making the game brittle.

---

## 12. Defence integrity

Defence integrity is distinct from Signal integrity.

Defence protects the craft from physical threats.

When Defence reaches zero:

- physical impacts become more damaging;
- Signal corruption from impacts may increase;
- movement or weapon performance may be temporarily impaired.

Defence failure must not independently replace Signal collapse as the canonical run-ending condition in Foundation 0.1.

---

## 13. Initial enemy archetypes

Foundation 0.1 defines three enemy archetypes.

### 13.1 Striker

Purpose:

- direct physical pressure;
- clear and readable threat;
- test movement and firing.

Behaviour:

- approaches the player;
- fires or performs bounded attack runs;
- primarily affects Defence.

### 13.2 Drainer

Purpose:

- attack the shared resource balance;
- encourage power-management decisions.

Behaviour:

- applies pressure that increases power demand;
- becomes more dangerous when ignored;
- supports Resource Exhaustion tactics.

### 13.3 Interferer

Purpose:

- attack the Signal directly;
- create positional priority conflicts.

Behaviour:

- produces a bounded interference field;
- reduces Signal integrity while active;
- may remain outside the player’s preferred route.

Each enemy must have explicit:

- spawn cost;
- health;
- movement rules;
- attack rules;
- legal target behaviour;
- reward contribution;
- telemetry identity.

---

## 14. Initial Game-Agent tactics

### 14.1 Direct Assault

Objective:

- pressure the player through immediate physical threats.

Typical execution:

- deploy Strikers;
- approach from readable directions;
- increase projectile or collision pressure.

Success indicators:

- Defence loss;
- forced evasive movement;
- player power shifted away from Signal.

### 14.2 Resource Exhaustion

Objective:

- cause the player to spend excessive power on combat or survival before a follow-up threat.

Typical execution:

- deploy high-volume but manageable pressure;
- encourage sustained firing;
- increase defence demand;
- observe power depletion or allocation changes.

Success indicators:

- reduced Signal power;
- prolonged weapon use;
- delayed recovery;
- inefficient player resource allocation.

### 14.3 Signal Interference

Objective:

- reduce Signal integrity directly while forcing positional prioritization.

Typical execution:

- deploy Interferers;
- create bounded distortion regions;
- place threats away from the player’s preferred position.

Success indicators:

- sustained Signal-integrity loss;
- player displacement;
- recovery-pulse usage;
- abandonment of offensive targets.

---

## 15. Game-Agent boundary

The Game-Agent is divided into distinct responsibilities.

### 15.1 Rules engine

The rules engine:

- owns legal state transitions;
- validates all actions;
- applies damage and recovery;
- calculates score;
- determines terminal state;
- produces authoritative events.

### 15.2 Tactical policy

The tactical policy:

- selects among legal tactics;
- updates tactic values from outcomes;
- adapts during or between matches;
- operates without requiring an LLM.

### 15.3 Player model

The player model stores bounded observations such as:

- preferred arena regions;
- movement-direction bias;
- average firing duration;
- power-allocation tendencies;
- recovery-pulse threshold;
- response to Direct Assault;
- response to Resource Exhaustion;
- response to Signal Interference.

The player model must distinguish:

- raw observations;
- derived tendencies;
- confidence;
- sample count;
- last-updated match.

### 15.4 Strategic mind

The locally hosted LLM may:

- inspect structured match summaries;
- select high-level tactics;
- propose tactical sequences;
- compare hypotheses with evidence;
- produce restrained post-match reflections.

The LLM may not:

- directly modify authoritative state;
- emit arbitrary enemies;
- change game constants;
- bypass legal-action validation;
- write directly into verified telemetry;
- claim improvement without evidence.

---

## 16. Initial learning model

Foundation 0.1 does not require online LLM weight training.

The first adaptive policy should use an inspectable lightweight method such as:

- weighted tactic values;
- contextual multi-armed bandit selection;
- bounded tabular reinforcement learning.

The minimum learning cycle is:

1. Observe the current match and player-model context.
2. Select one legal tactic.
3. Execute the tactic through deterministic engine behaviour.
4. Measure the resulting outcome.
5. Assign a bounded reward.
6. Update the tactic’s value.
7. preserve the update for later decisions where persistence is enabled.

Exploration must remain possible so the agent does not become locked into one tactic prematurely.

---

## 17. Agent reward

The agent receives positive evidence for outcomes such as:

- reducing Signal integrity;
- reducing the player’s coherence streak;
- forcing inefficient power changes;
- causing recovery-pulse use;
- predicting player behaviour correctly;
- creating sustained positional disadvantage.

The agent receives negative evidence for outcomes such as:

- strengthening the player’s position;
- repeated ineffective tactics;
- wasting its wave budget;
- causing no measurable pressure;
- illegal-action attempts;
- predictable repetition without success.

The reward system must not encourage invisible rule changes or unfair behaviour.

---

## 18. Human scoring

The human score must primarily reward Signal preservation.

Recommended scoring categories:

```text
Base transmission score
+ continuous coherence bonus
+ integrity-quality bonus
+ successful recovery bonus
+ wave completion bonus
+ tactical-efficiency bonus
+ difficulty multiplier
```

Enemy destruction may contribute a limited secondary amount.

It must not outweigh preserving the Signal.

### 18.1 Primary record

The primary persistent record is:

> Longest continuous Signal maintained.

### 18.2 Secondary records

Secondary records may include:

- final score;
- total coherent transmission time;
- data successfully transmitted;
- highest wave;
- average Signal integrity;
- successful emergency recoveries;
- energy efficiency;
- Game-Agent difficulty;
- player rating;
- Game-Agent rating.

---

## 19. Difficulty progression

Difficulty may increase through:

- larger legal enemy budgets;
- shorter recovery windows;
- improved tactic selection;
- stronger tactical sequencing;
- reduced Signal recovery;
- increased formation complexity.

Difficulty must not increase through hidden rule changes.

Every difficulty-affecting variable must be:

- versioned;
- inspectable;
- deterministic;
- included in replay evidence.

---

## 20. Strategic LLM interface

The Game-Agent must expose a stable strategist boundary from the beginning.

Conceptual TypeScript interface:

```ts
export interface GameStrategist {
  selectStrategy(input: StrategyInput): Promise<StrategyDecision>;
  reviewMatch(input: MatchSummary): Promise<StrategicReflection>;
}
```

Initial implementations may include:

```text
ScriptedStrategist
AdaptivePolicyStrategist
LocalLlmStrategist
```

### 20.1 Strategy input

The local LLM receives structured information only.

Minimum fields may include:

```text
Game version
Wave
Difficulty
Signal integrity
Defence integrity
Power allocation
Recent player actions
Player-model tendencies
Recent tactics
Tactic rewards
Legal strategies
Available agent budget
```

### 20.2 Strategy output

The LLM must return schema-constrained output containing:

```text
Selected legal strategy
Optional target region
Optional legal follow-up
Reason
Confidence
Evidence references
```

Invalid or unavailable output must fall back safely to the embedded tactical policy.

### 20.3 LLM timing

The LLM must not be required for frame-level control.

Initial strategic decision points are:

- before a wave;
- after a wave;
- after a match;
- at explicitly defined strategic intervals.

Gameplay must continue safely when the LLM is unavailable or slow.

---

## 21. Local bridge boundary

The future local Game-Agent bridge may expose narrow endpoints such as:

```text
GET  /v1/keep-the-signal/health
POST /v1/keep-the-signal/strategy
POST /v1/keep-the-signal/review
```

The bridge must:

- run locally;
- expose only required functionality;
- validate input and output schemas;
- reject unknown actions;
- apply bounded timeouts;
- avoid receiving unrelated browser information;
- remain optional.

The public Cloudflare-hosted game must not silently send match data to external model providers.

---

## 22. Telemetry

Every authoritative run must produce structured telemetry.

Minimum match evidence:

```text
Game version
Seed
Start and end reason
Duration
Final score
Longest coherence streak
Wave history
Player-input sequence
Power-allocation history
Signal-integrity timeline
Defence-integrity timeline
Enemy spawn history
Agent tactic history
Tactic rewards
Recovery-pulse usage
Failure cause
Terminal state
```

Telemetry must distinguish between:

- authoritative engine facts;
- tactical-policy values;
- LLM proposals;
- derived analysis;
- user-facing narrative.

An LLM reflection must never be stored as an authoritative engine fact.

---

## 23. Replay

A replay must contain enough information to reproduce the authoritative match.

Minimum replay inputs:

```text
Game version
Ruleset version
Seed
Initial state
Ordered player actions
Ordered validated agent decisions
Timing information
```

The replay system must verify:

- final score;
- final Signal integrity;
- final wave;
- terminal reason;
- authoritative event sequence or event digest.

Visual replay may be implemented later. Foundation 0.1 requires authoritative reproduction, not final cinematic playback.

---

## 24. Persistence

Foundation 0.1 may begin with local browser persistence.

Permitted initial persistent records:

- player settings;
- high scores;
- longest Signal;
- player-model values;
- tactical-policy values;
- match summaries;
- replay references;
- agent-strategy reflections.

Persistence must be:

- versioned;
- resettable;
- bounded;
- migration-aware.

Cloud persistence, accounts, global leaderboards, and cross-device synchronization are deferred.

---

## 25. Rendering boundary

Rendering must consume authoritative state but must not own game rules.

Initial rendering may use:

- HTML Canvas;
- WebGL;
- a restrained combination of both.

The renderer is responsible for:

- player craft visuals;
- enemy visuals;
- projectiles;
- arena;
- Signal effects;
- interference effects;
- particles;
- screen feedback;
- interpolation.

The renderer must not:

- calculate authoritative collision outcomes;
- modify score;
- decide enemy actions;
- alter Signal integrity;
- generate unrecorded gameplay events.

---

## 26. Visual direction

Foundation 0.1 uses a restrained 1980s retro-futurist arcade language.

Core qualities:

- deep black field;
- vector-like geometry;
- warm off-white interface text;
- cyan or teal Signal state;
- amber warning state;
- magenta or red interference;
- restrained CRT bloom;
- minimal scanline treatment;
- geometric enemy formations;
- deliberate use of visual corruption.

The design must avoid becoming a generic neon-grid parody.

The system should feel like an intelligent arcade machine from an alternate computing history.

---

## 27. Audio boundary

Audio must reflect game state without becoming mechanically authoritative.

Potential mappings:

- Signal integrity to harmonic stability;
- interference to noise or detuning;
- power allocation to layered system tones;
- recovery to restored harmonic coherence;
- terminal collapse to controlled signal loss.

All production audio must be:

- original;
- commissioned;
- public domain;
- or appropriately licensed.

The game must remain playable with audio disabled.

---

## 28. Accessibility and input

Foundation 0.1 must allow for:

- keyboard input;
- remappable controls in a later slice;
- reduced visual effects;
- reduced motion where practical;
- readable Signal status without colour alone;
- mute controls;
- pause where compatible with the selected mode.

Controller and touch support are deferred unless inexpensive to preserve architecturally.

---

## 29. Route and site integration

The game route is:

```text
/keep-the-signal
```

The Keep the Signal feature must remain isolated under:

```text
app/features/keep-the-signal/
```

The game branch must not modify the existing hero implementation during Foundation 0.1.

The homepage coordinate remains marked dormant until a playable review explicitly authorizes activation.

The game route may exist internally before public navigation is enabled.

---

## 30. Expected feature structure

```text
app/
├── routes/
│   └── keep-the-signal.tsx
│
└── features/
    └── keep-the-signal/
        ├── engine/
        ├── agent/
        ├── telemetry/
        ├── rendering/
        ├── audio/
        ├── ui/
        └── tests/
```

Responsibilities must remain separated.

### Engine

Owns:

- state;
- actions;
- simulation;
- scoring;
- seeded randomness;
- authoritative transitions.

### Agent

Owns:

- tactics;
- tactic selection;
- player model;
- strategist interface;
- adaptive-policy state.

### Telemetry

Owns:

- authoritative events;
- summaries;
- replay records;
- verification.

### Rendering

Owns:

- canvas or WebGL presentation;
- interpolation;
- visual effects.

### Audio

Owns:

- non-authoritative sound and music state.

### UI

Owns:

- HUD;
- power controls;
- match results;
- settings and player-facing controls.

---

## 31. Implementation sequence

### KTS-I1 — Deterministic engine

Deliver:

- state model;
- fixed-step simulation;
- seeded randomness;
- movement;
- firing;
- power allocation;
- Signal integrity;
- terminal conditions;
- scoring;
- headless tests.

### KTS-I2 — Playable arcade shell

Deliver:

- game route;
- renderer;
- player controls;
- HUD;
- initial enemies;
- start, pause, game-over, and restart flow.

### KTS-I3 — Tactical opponent

Deliver:

- three tactics;
- legal tactic execution;
- tactic rewards;
- initial player model;
- adaptive selection;
- post-match evidence.

### KTS-I4 — Local LLM strategist

Deliver:

- structured strategist port;
- local health detection;
- schema-constrained decisions;
- safe fallback;
- post-match strategic reflection.

### KTS-I5 — Self-play and evaluation

Deliver:

- headless agent simulations;
- historical policy checkpoints;
- comparative ratings;
- evidence that later policies outperform earlier policies.

---

## 32. Foundation acceptance gates

Foundation 0.1 may be approved only when the document clearly establishes that:

1. The game’s objective is Signal preservation rather than enemy destruction.
2. Power allocation creates an explicit trade-off among Weapons, Defence, and Signal.
3. Signal integrity and terminal collapse are unambiguous.
4. The first player actions are bounded and implementable.
5. The first enemy archetypes have distinct responsibilities.
6. The first Game-Agent tactics produce meaningfully different pressure.
7. The engine remains authoritative over the LLM.
8. The game remains playable without a local LLM.
9. Learning is measurable and inspectable.
10. Match telemetry separates fact from interpretation.
11. Replays can reproduce authoritative outcomes.
12. The hero subsystem remains untouched by the game branch.
13. Homepage activation remains separately authorized.
14. V0.1 exclusions prevent uncontrolled scope growth.

---

## 33. First playable acceptance gates

The first playable implementation must demonstrate:

1. The same seed and ordered actions reproduce the same outcome.
2. The game runs headlessly without React, Canvas, WebGL, or audio.
3. The player can move, fire, shift power, and activate recovery.
4. Power remains conserved.
5. Signal integrity can degrade, recover, collapse, and trigger terminal failure.
6. At least three enemy archetypes behave differently.
7. At least three agent tactics create observably different pressure patterns.
8. Score rewards continuous Signal preservation more than enemy destruction.
9. A complete match emits structured telemetry.
10. A replay reproduces the authoritative result.
11. Illegal player or agent actions are rejected.
12. Existing project checks continue to pass.
13. No hero files are changed.
14. The route is not publicly promoted without explicit review.

---

## 34. Explicit Foundation 0.1 exclusions

Foundation 0.1 does not include:

- online multiplayer;
- global leaderboards;
- user accounts;
- cross-device progression;
- cloud model inference;
- continuous LLM weight training;
- LoRA training;
- a dedicated neural policy network;
- full AlphaZero-style self-play;
- procedurally generated campaigns;
- narrative cutscenes;
- multiple player ships;
- multiple weapon classes;
- inventory systems;
- crafting;
- cosmetic economies;
- monetization;
- live-service mechanics;
- autonomous code modification;
- unrestricted Game-Agent tool use;
- hidden difficulty manipulation;
- direct LLM control of projectiles;
- final hero integration;
- public homepage activation.

These exclusions do not reject the long-term vision. They protect the first durable implementation boundary.

---

## 35. Open implementation decisions

The following decisions remain open for the first scoped implementation contract:

1. Continuous or fixed-increment power transfer.
2. Exact movement acceleration and maximum speed.
3. Exact weapon cost and firing model.
4. Exact Defence-to-damage relationship.
5. Exact Signal degradation and recovery equations.
6. Exact recovery-pulse cost and cooldown.
7. Wave duration and recovery-window duration.
8. Tactic-selection learning algorithm.
9. Local persistence format.
10. Canvas, WebGL, or hybrid rendering.
11. Initial LLM runtime and local bridge technology.
12. Exact match-summary schema.
13. Exact replay digest and verification method.

These decisions must be resolved before their corresponding runtime slices are authorized.

---

## 36. Governance statement

Keep the Signal is being developed as a serious subsystem of The Signal.

Foundation work must support the complete intended architecture rather than create a disposable prototype.

Incremental delivery means staged implementation of the real system.

Each stage must:

- preserve deterministic boundaries;
- remain compatible with later agent development;
- produce reviewable evidence;
- avoid coupling the game to unfinished site systems;
- respect human authority;
- preserve player control over local data and learned profiles.

The Game-Agent may become strategically capable.

It does not receive authority to alter the rules governing its behaviour.

---

## 37. Review decision

**Decision:** `ACCEPT KTS-F0.1`
**Decision date:** `2026-07-30`

At review, this document may receive one of the following decisions:

```text
ACCEPT KTS-F0.1
REVISE KTS-F0.1
REJECT KTS-F0.1
```

Only:

```text
ACCEPT KTS-F0.1
```

authorizes preparation of the first scoped implementation contract.

It does not independently authorize runtime implementation.

---

## 38. Current project state

```text
Foundation document: Accepted
Game scaffold: Created
Runtime engine: Not implemented
Playable route: Not implemented
Adaptive policy: Not implemented
Local LLM strategist: Not implemented
Homepage coordinate: Dormant
Hero implementation: Out of scope
Implementation authorization: None
```

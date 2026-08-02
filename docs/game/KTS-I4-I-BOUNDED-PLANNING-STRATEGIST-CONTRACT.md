# KTS-I4-I — Bounded Planning Strategist Contract

**Document ID:** KTS-I4-I-CONTRACT
**Status:** Proposed implementation contract
**Project:** Construct Intelligence Harness / Keep the Signal
**Governing architecture:** KTS-I4-A
**Accepted predecessor:** KTS-I4-H
**Accepted predecessor checkpoint:** `e1b9a9ef93c0920e8c4f30ec70ca4639bdf2bc6e`
**Target branch:** `game/keep-the-signal-i4-intelligence-harness`
**Implementation method:** Byte Coding
**Implementation authorization:** Not granted by this document
**Runtime activation:** Not authorized
**Training-data generation:** Not authorized
**Core doctrine:** The planner may search legal futures and propose strategy. The deterministic engine remains the sole authority over what actually happens.

---

## 1. Purpose

KTS-I4-I introduces the first explicit algorithmic strategist in the Keep the Signal intelligence stack.

Its purpose is to evaluate a bounded set of legal future action sequences, using deterministic simulation and explicit scoring, then return a ranked tactical proposal without directly controlling the engine.

The first authorized planning method is:

```text
deterministic bounded beam search
```

The planner is intended to:

- outperform simple rule selection in tactically ambiguous states;
- remain inspectable and reproducible;
- expose every candidate sequence and score contribution;
- preserve engine authority;
- provide an algorithmic baseline for later trained models;
- eventually support separately governed planner-demonstration generation.

This contract does not authorize planner-generated training data, live runtime activation, model invocation, reinforcement learning, or autonomous control.

---

## 2. Architectural position

```text
Immutable KTS observation
        ↓
Legal-action enumeration
        ↓
Deterministic simulation port
        ↓
Bounded beam-search expansion
        ↓
Explicit utility evaluation
        ↓
Ranked candidate plans
        ↓
Bounded tactical proposal
        ↓
Existing deterministic proposal validator
        ↓
Player advisory surface
```

The planner must remain outside:

- game-state authority;
- action execution;
- RNG authority;
- scoring authority;
- encounter authority;
- persistence;
- model training;
- runtime routing.

---

## 3. Contract acceptance and implementation authorization

The contract may be accepted with:

```text
ACCEPT KTS-I4-I CONTRACT
```

Contract acceptance authorizes no implementation.

Implementation may begin only after the contract is committed as a one-path checkpoint and Nolan states:

```text
AUTHORIZE KTS-I4-I
```

Implementation authorization does not authorize:

- runtime activation;
- gameplay execution;
- planner-generated dataset export;
- training;
- fine-tuning;
- model selection;
- inference;
- adapter creation;
- push;
- merge;
- deployment.

---

## 4. First algorithm selection

The first planner uses bounded deterministic beam search because it provides:

- exact search budgets;
- deterministic expansion order;
- stable tie-breaking;
- explicit candidate retention;
- bounded memory use;
- bounded time complexity;
- inspectable alternatives;
- compatibility with deterministic game simulation;
- a strong baseline without stochastic rollouts.

The following remain deferred:

```text
Monte Carlo tree search
minimax
alpha-beta pruning
evolutionary search
genetic algorithms
contextual bandits
online reinforcement learning
offline reinforcement learning
actor-critic methods
policy gradients
self-play
```

A later contract may authorize additional planners after beam-search evidence exists.

---

## 5. Authority boundaries

### 5.1 Engine authority

The deterministic engine remains sole authority over:

- legal actions;
- state transitions;
- collisions;
- damage;
- defence;
- Signal recovery;
- firing;
- cooldowns;
- resource transfer;
- wave progression;
- score;
- RNG;
- replay;
- serialization;
- terminal conditions.

The planner may consume only immutable projections and simulator results.

It may not mutate any engine object.

### 5.2 Planner authority

The planner may:

- enumerate legal candidate actions through a bounded port;
- request deterministic simulations through a bounded port;
- score returned immutable outcomes;
- rank candidate plans;
- explain score contributions;
- emit a tactical proposal candidate;
- abstain when no candidate clears the approved threshold.

The planner may not:

- execute an action;
- bypass proposal validation;
- alter legal-action rules;
- alter the simulator;
- alter scoring weights during a search;
- change its own search budget;
- persist search state;
- modify memory;
- invoke a model;
- call external services.

### 5.3 Human authority

Only Nolan may authorize:

- planner runtime activation;
- training-data generation from planner outputs;
- changes to scoring weights;
- changes to search depth or beam width outside accepted bounds;
- new planning algorithms;
- integration into a hybrid router;
- push, merge, or deployment.

---

## 6. Planning input contract

Every planning request must include:

- request ID;
- planner version;
- observation schema version;
- immutable observation digest;
- legal-action schema version;
- simulator version;
- scoring-policy version;
- deterministic seed identity where relevant;
- maximum planning depth;
- beam width;
- maximum candidate expansions;
- maximum simulation calls;
- maximum retained candidates;
- abstention threshold;
- tie-break policy;
- explicit scoring weights;
- cancellation signal state.

The planner must reject:

- missing versions;
- malformed digests;
- unsupported observation versions;
- unsupported simulator versions;
- zero or negative budgets;
- budgets above accepted maxima;
- missing scoring weights;
- non-finite values;
- mutable or structurally ambiguous inputs.

---

## 7. Legal-action enumeration

The planner may expand only actions returned by an accepted legal-action enumeration port.

The legal-action port must:

- consume an immutable simulated state;
- return immutable legal actions;
- return actions in canonical order;
- attach stable action identities;
- attach version and digest evidence;
- reject stale or incompatible state versions.

The planner must not infer hidden legal actions.

An action absent from the legal-action set is prohibited, regardless of utility.

---

## 8. Deterministic simulation port

The simulation port must be a pure bounded projection over an immutable state and one legal action.

It must return:

- resulting immutable state;
- resulting state digest;
- applied action identity;
- terminal status;
- score delta;
- Signal delta;
- Defence delta;
- coherence delta;
- threat delta;
- damage delta;
- resource delta;
- wave-progress delta;
- simulator version;
- deterministic evidence digest.

The planner must treat simulator results as authoritative for search.

The planning implementation may not import or execute the live engine directly. It must depend on a narrow simulation interface.

---

## 9. Search method

The initial method is deterministic beam search.

For each depth:

1. expand retained candidates in canonical order;
2. enumerate legal actions in canonical order;
3. simulate each legal action;
4. create immutable child candidates;
5. evaluate every child using the fixed scoring policy;
6. sort candidates by:
   - utility descending;
   - lower risk;
   - lower resource cost;
   - shorter plan;
   - canonical action sequence;
   - candidate digest;
7. retain at most the configured beam width;
8. stop when:
   - terminal evidence is reached;
   - maximum depth is reached;
   - expansion budget is exhausted;
   - simulation-call budget is exhausted;
   - cancellation is observed;
   - no legal actions remain.

Equivalent inputs must produce equivalent ranked plans.

---

## 10. Search budgets

Every planning request must define hard limits for:

- planning depth;
- beam width;
- candidate expansions;
- simulation calls;
- retained candidates;
- explanation entries;
- candidate-action count;
- total score components;
- output plans;
- output bytes.

Initial implementation maxima:

```text
maximum planning depth:       8
maximum beam width:          64
maximum candidate expansions: 10,000
maximum simulation calls:    10,000
maximum retained candidates: 10,000
maximum returned plans:      16
```

The implementation must fail closed when any maximum would be exceeded.

No unbounded queue, recursion, or candidate collection is permitted.

---

## 11. Utility model

The initial explicit utility model may include:

```text
signal_retention
defence_retention
coherence
damage_avoidance
threat_reduction
resource_efficiency
recovery_potential
wave_progress
terminal_survival
future_option_value
```

Each component must have:

- an explicit weight;
- a normalized value;
- an explicit contribution;
- a versioned definition;
- bounded numeric range;
- finite-number validation.

The final candidate score must be reproducible from its component evidence.

No hidden score, learned score, or model-generated score is permitted in KTS-I4-I.

---

## 12. Risk and abstention

The planner must support explicit risk penalties for:

- terminal failure;
- low-Signal exposure;
- defence collapse;
- unrecoverable resource depletion;
- high-damage transitions;
- low-coherence transitions;
- strategically irreversible actions.

The planner must abstain when:

- there are no legal actions;
- every candidate violates a blocking risk gate;
- every candidate falls below the abstention threshold;
- the simulator or scoring version is incompatible;
- budgets are insufficient to complete the minimum accepted search;
- the search is cancelled;
- deterministic evidence cannot be reconstructed.

Abstention is a valid result, not a failure.

---

## 13. Candidate and plan lineage

Every candidate must record:

- candidate ID;
- parent candidate ID;
- root request ID;
- depth;
- action sequence;
- action-sequence digest;
- source-state digest;
- result-state digest;
- simulator version;
- scoring-policy version;
- score components;
- total utility;
- risk flags;
- terminal status;
- expansion ordinal;
- evidence digest.

Every returned plan must preserve the complete candidate chain.

No lineage field may be inferred after the search.

---

## 14. Planner result contract

A result may be:

```text
planned
abstained
cancelled
budget_exhausted
rejected
failed
```

A successful planned result must include:

- request identity;
- planner identity and version;
- exact request digest;
- ranked plans;
- selected proposal candidate;
- full scoring explanation;
- search metrics;
- budget-consumption report;
- tie-break evidence;
- deterministic result digest;
- limitations;
- no-execution declaration.

The planner may return a proposal candidate only.

It may not mark any proposal:

```text
executed
accepted_by_engine
production
deployed
autonomous
```

---

## 15. Evaluation requirements

The planner must be evaluated against:

- no adviser;
- accepted deterministic rule adviser;
- shallow planner;
- deeper bounded planner;
- altered beam widths within accepted bounds.

Required evaluation groups:

```text
simple_known_states
ambiguous_states
high_risk_states
resource_scarcity
recovery_states
terminal_proximity
unseen_seeds
version_boundaries
abstention_cases
budget_exhaustion
```

Required metrics include:

- legal proposal rate;
- schema compliance;
- deterministic reconstruction;
- Signal retained;
- Defence retained;
- coherence;
- score;
- wave completion;
- damage avoided;
- resource efficiency;
- abstention correctness;
- expansion count;
- simulation-call count;
- planning latency as externally measured evidence;
- quality per simulation call;
- rule-baseline delta.

The implementation may define metric contracts and evaluation projections but may not execute live gameplay or benchmark hardware.

---

## 16. Demonstration-generation boundary

KTS-I4-I is expected to support a later planner-demonstration pipeline, but this contract does not authorize it.

Planner outputs may not be written into KTS-I4-G training evidence until a later contract defines:

- eligible planner result classes;
- minimum confidence and utility margins;
- baseline-comparison requirements;
- rejected-alternative capture;
- partition assignment;
- leakage prevention;
- duplicate control;
- human review;
- manifest versioning;
- export boundaries.

No KTS-I4-I implementation module may write a training dataset.

---

## 17. Failure taxonomy

Required public failure codes include:

```text
invalid_planning_request
invalid_planner_identity
invalid_observation
unsupported_observation_version
invalid_legal_action_set
illegal_action_candidate
invalid_simulator
unsupported_simulator_version
simulation_failed
simulation_digest_mismatch
invalid_scoring_policy
invalid_scoring_weight
non_finite_score
invalid_search_budget
search_budget_exceeded
candidate_limit_exceeded
simulation_limit_exceeded
invalid_candidate
candidate_lineage_incomplete
candidate_digest_mismatch
invalid_plan
plan_digest_mismatch
no_legal_actions
all_candidates_blocked
abstention_threshold_not_met
search_cancelled
search_failed
version_mismatch
proposal_validation_required
execution_not_authorized
training_data_generation_not_authorized
controller_disposed
controller_internal_failure
```

Public failures must not expose mutable engine internals or protected evidence.

---

## 18. Determinism requirements

Equivalent accepted inputs must produce equivalent:

- action expansion order;
- simulation-call order;
- candidate identities;
- candidate scores;
- tie-break results;
- retained beams;
- ranked plans;
- proposal candidates;
- metrics;
- result digests.

Production code may not use:

- wall-clock identity;
- random identity generation;
- locale-sensitive ordering;
- unordered object iteration as a semantic tie-break;
- environment-derived defaults;
- hidden mutable state;
- implicit scoring weights.

---

## 19. Exact repository implementation boundary

Future implementation may create exactly these 37 paths.

### 19.1 Transferable planning layer

Directory:

```text
app/features/intelligence-harness/planning/
```

Paths:

```text
failures.ts
planner-contract.ts
planning-request.ts
search-budget.ts
legal-action-port.ts
simulation-port.ts
candidate-contract.ts
candidate-digest.ts
score-contract.ts
score-policy.ts
risk-policy.ts
beam-contract.ts
beam-search.ts
tie-break-policy.ts
plan-contract.ts
planner-result.ts
planner-metrics.ts
planner-evaluation.ts
planner-controller.ts
index.ts
```

### 19.2 Keep the Signal planner adapter

Directory:

```text
app/features/keep-the-signal/planning/
```

Paths:

```text
kts-planning-observation.ts
kts-legal-action-projection.ts
kts-simulation-contract.ts
kts-score-policy.ts
kts-proposal-projector.ts
index.ts
```

### 19.3 Focused tests

```text
test/intelligence-planning-contract.test.ts
test/intelligence-planning-budget.test.ts
test/intelligence-planning-candidates.test.ts
test/intelligence-planning-scoring.test.ts
test/intelligence-planning-beam-search.test.ts
test/intelligence-planning-results.test.ts
test/intelligence-planning-controller.test.ts
test/intelligence-planning-evaluation.test.ts
test/keep-the-signal-planning-adapter.test.ts
test/keep-the-signal-planning-boundaries.test.ts
```

### 19.4 Result record

```text
docs/game/KTS-I4-I-BOUNDED-PLANNING-STRATEGIST-RESULT.md
```

No existing repository path may be modified.

No other new path is authorized without contract amendment.

---

## 20. Focused test requirement

The implementation must provide at least **420 substantive named focused tests** across the exact ten authorized test files.

Required coverage includes:

- every public result and failure class;
- all budget limits and limit breaches;
- canonical action ordering;
- deterministic candidate identity;
- candidate lineage;
- score-component normalization;
- explicit score reconstruction;
- risk penalties;
- abstention;
- deterministic tie-breaking;
- search cancellation;
- terminal states;
- no-legal-action states;
- budget exhaustion;
- maximum-depth behavior;
- maximum-beam behavior;
- exact proposal projection;
- independent controllers;
- 10,000 candidate expansions;
- 10,000 simulation calls;
- 10,000 candidate lineage records;
- 10,000 score records;
- exact path and static boundaries.

Generated assertions without distinct behavioral meaning do not count as substantive tests.

---

## 21. Production restrictions

The 26 production files may not use:

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
node:fs
node:path
child_process
setTimeout
setInterval
```

They may not import:

- provider SDKs;
- model hubs;
- model runners;
- training frameworks;
- GPU libraries;
- D1 repositories;
- object-storage clients;
- route modules;
- React;
- presentation modules;
- deployment modules;
- live engine controllers.

They may not expose executable APIs named or equivalent to:

```text
executeAction
applyAction
mutateState
runGame
train
fineTune
invokeModel
downloadModel
uploadDataset
deployPlanner
promotePlanner
```

---

## 22. Validation gates

Required implementation validation:

```text
exact ten focused test files
at least 420 focused tests
complete repository tests
declared npm version through Corepack
application and test typechecks
client production build
SSR production build
lint
format check
git diff --check
explicit trailing-whitespace scan
static prohibited-capability scans
exact 37-path comparison
zero tracked changes outside the candidate
zero staged changes before commit authorization
accepted KTS-I4-C through KTS-I4-H boundary checks
protected hero stash verification
```

---

## 23. Implementation acceptance criteria

The implementation may be accepted only when:

1. search is deterministic for equivalent inputs;
2. only legal actions can be expanded;
3. search budgets are explicit and enforced;
4. candidate lineage is complete;
5. scoring is explicit and reconstructable;
6. risk and abstention are first-class;
7. no live engine mutation is possible;
8. no action execution is possible;
9. no model invocation or training is possible;
10. no training-data persistence is possible;
11. all focused and repository gates pass;
12. the exact 37-path boundary is preserved;
13. the protected stash remains unchanged.

Implementation acceptance does not authorize runtime activation or planner-generated training evidence.

---

## 24. Decision statement

Acceptance of this contract means:

> The Construct may implement a deterministic bounded beam-search strategist that explores only legal simulated futures, scores them through explicit versioned utility and risk policies, preserves complete candidate lineage, produces bounded tactical proposal candidates, and remains unable to execute actions, mutate the engine, invoke models, generate training datasets, or activate itself in runtime.

Acceptance does not authorize implementation.

The exact acceptance phrase is:

```text
ACCEPT KTS-I4-I CONTRACT
```

After the contract is committed and verified, implementation may be authorized with:

```text
AUTHORIZE KTS-I4-I
```

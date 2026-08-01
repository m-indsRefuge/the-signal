# KTS-I4-E — Tactical Adviser and Strategy Portfolio Contract

**Document ID:** KTS-I4-E-CONTRACT
**Status:** Proposed implementation contract
**Project:** Construct Intelligence Harness / Keep the Signal
**Governing architecture:** KTS-I4-A
**Accepted model bridge:** KTS-I4-B
**Accepted KTS observation adapter:** KTS-I4-C
**Accepted evidence-grounded memory fabric:** KTS-I4-D
**Base commit:** `83a4090`
**Target branch:** `game/keep-the-signal-i4-intelligence-harness`
**Implementation authorization:** Not granted by this document
**Operational classification:** Experimental candidate; advisory only
**Core doctrine:** The model may propose strategy. The governed system must prove it.

---

## 1. Purpose

KTS-I4-E defines the first bounded tactical-adviser capability for the Construct Intelligence Harness.

The slice composes the accepted:

- provider-neutral model invocation bridge;
- Keep the Signal observation adapter;
- evidence-grounded memory fabric;
- deterministic KTS authority boundary.

It establishes:

- domain-independent adviser and proposal contracts;
- immutable strategy records;
- bounded strategy portfolios;
- deterministic strategy applicability and candidate selection;
- bounded adviser context construction;
- retrieval-grounded working-memory assembly;
- one-attempt model-adviser orchestration;
- strict KTS tactical-proposal schema;
- deterministic KTS proposal validation;
- a deterministic rule-based adviser baseline;
- proposal and evaluation evidence drafting;
- matched-case adviser evaluation and baseline comparison.

This slice is the first slice permitted to construct a tactical model request and call the accepted model bridge.

It does not include a live provider adapter, credentials, model download, network call, remote inference, live gameplay integration, recommendation display, action execution, strategy promotion, memory consolidation, memory deletion, training, or fine-tuning.

KTS-I4-E creates advisory proposals. It does not control the game.

---

## 2. Architectural position

```text
Accepted KTS-I4-C observation
    ↓
Explicit KTS-I4-D retrieval request
    ↓
Accepted episodic memories and evidence references
    ↓
Bounded working-memory assembly
    ↓
Applicable strategy portfolio
    ↓
Versioned adviser context
    ↓
Accepted KTS-I4-B invocation bridge
    ↓
Schema-validated tactical proposal
    ↓
Deterministic KTS proposal validator
    ↓
Advisory result, abstention, or typed rejection
    ↓
Proposal and evaluation evidence drafts
```

No step may mutate authoritative KTS state.

No successful adviser result is equivalent to an accepted engine action.

---

## 3. Permanent authority boundaries

### 3.1 Engine authority

The KTS engine remains sole authority over:

- legal actions;
- state progression;
- damage;
- recovery;
- power transfers;
- firing;
- cooldowns;
- scoring;
- waves;
- encounters;
- RNG;
- replay;
- serialization;
- digest;
- terminal outcomes.

The adviser may recommend an action-like preference.

It may not:

- call `stepGame`;
- call `runSimulation`;
- construct a tick frame for execution;
- directly submit an engine action;
- mutate `GameState`;
- claim that an engine action is guaranteed to succeed.

### 3.2 Adviser authority

The adviser may:

- inspect an accepted immutable observation;
- retrieve explicitly authorized memory;
- inspect a bounded set of applicable strategies;
- invoke one explicitly selected registered model through KTS-I4-B;
- return a schema-valid candidate proposal;
- abstain;
- report uncertainty;
- draft evidence for later caller-controlled persistence.

The adviser may not:

- select or invoke an unrequested provider or model;
- retry;
- fall back silently;
- promote a strategy;
- persist evidence or memory;
- alter retrieval permissions;
- suppress contradictory evidence;
- execute a recommendation;
- display advice in the live player surface;
- run continuously in the live runtime.

### 3.3 Human and governance authority

Only an accepted governance process may:

- promote a candidate strategy;
- approve production adviser use;
- activate a live provider;
- authorize model credentials;
- connect the adviser to live gameplay;
- persist adviser evidence;
- approve training data;
- train or fine-tune;
- deploy.

---

## 4. Production, candidate, and baseline classification

KTS-I4-E must distinguish:

```text
accepted_production
experimental_candidate
deterministic_baseline
rejected
quarantined
superseded
```

The KTS-I4-E implementation itself is an experimental candidate until formally accepted.

The included deterministic KTS strategies and rule-based adviser are baselines.

They must not be described as learned intelligence or accepted optimal strategy.

No model-generated proposal is accepted production merely because it passes schema validation.

---

## 5. Exact implementation boundary

### 5.1 Transferable tactical-adviser core

Authorized production directory:

```text
app/features/intelligence-harness/tactical-adviser/
```

Authorized files:

```text
app/features/intelligence-harness/tactical-adviser/adviser-contract.ts
app/features/intelligence-harness/tactical-adviser/proposal-contract.ts
app/features/intelligence-harness/tactical-adviser/strategy-contract.ts
app/features/intelligence-harness/tactical-adviser/strategy-portfolio.ts
app/features/intelligence-harness/tactical-adviser/context-contract.ts
app/features/intelligence-harness/tactical-adviser/context-builder.ts
app/features/intelligence-harness/tactical-adviser/adviser-coordinator.ts
app/features/intelligence-harness/tactical-adviser/evaluation-contract.ts
app/features/intelligence-harness/tactical-adviser/evaluation-aggregator.ts
app/features/intelligence-harness/tactical-adviser/failures.ts
app/features/intelligence-harness/tactical-adviser/index.ts
```

### 5.2 Keep the Signal tactical-adviser adapter

Authorized production directory:

```text
app/features/keep-the-signal/tactical-adviser/
```

Authorized files:

```text
app/features/keep-the-signal/tactical-adviser/kts-proposal-contract.ts
app/features/keep-the-signal/tactical-adviser/kts-proposal-validator.ts
app/features/keep-the-signal/tactical-adviser/kts-strategy-portfolio.ts
app/features/keep-the-signal/tactical-adviser/kts-rule-based-adviser.ts
app/features/keep-the-signal/tactical-adviser/kts-model-context.ts
app/features/keep-the-signal/tactical-adviser/kts-adviser-evidence.ts
app/features/keep-the-signal/tactical-adviser/kts-adviser-adapter.ts
app/features/keep-the-signal/tactical-adviser/index.ts
```

### 5.3 Focused tests

Authorized test files:

```text
test/intelligence-adviser-strategy-contract.test.ts
test/intelligence-adviser-strategy-portfolio.test.ts
test/intelligence-adviser-context-builder.test.ts
test/intelligence-adviser-coordinator.test.ts
test/intelligence-adviser-evaluation.test.ts
test/keep-the-signal-tactical-proposal.test.ts
test/keep-the-signal-tactical-validator.test.ts
test/keep-the-signal-rule-based-adviser.test.ts
test/keep-the-signal-tactical-adviser-evidence.test.ts
test/keep-the-signal-tactical-adviser-boundaries.test.ts
```

### 5.4 Result record

Authorized result record:

```text
docs/game/KTS-I4-E-TACTICAL-ADVISER-STRATEGY-PORTFOLIO-RESULT.md
```

Total authorized future implementation paths:

```text
30
```

No other path is authorized without an accepted contract amendment.

---

## 6. Dependency direction

Permitted:

```text
transferable tactical adviser
    → accepted KTS-I4-B model-bridge contracts and coordinator
    → accepted KTS-I4-D memory-fabric contracts

KTS tactical adviser
    → transferable tactical adviser
    → accepted KTS-I4-C observation contract
    → accepted KTS-I4-D evidence contracts
```

Prohibited:

```text
KTS engine → tactical adviser
KTS runtime → tactical adviser
KTS presentation → tactical adviser
KTS player → tactical adviser
model bridge → tactical adviser
memory fabric → tactical adviser
observation adapter → tactical adviser
```

The KTS tactical adviser may import observation types and action-space facts.

It may not import engine execution, runtime, presentation, player, routes, React, Canvas, or Web Audio.

---

## 7. Domain-independent adviser request

Every adviser request must be immutable and caller supplied.

Required fields:

- adviser request ID;
- invocation ID;
- adviser role ID and version;
- domain ID and version;
- observation identity and schema;
- requested provider ID;
- requested model ID;
- model invocation budget;
- context budget;
- strategy-candidate budget;
- retrieval request;
- prompt contract ID and version;
- proposal schema ID and version;
- caller-supplied recorded-at time;
- optional session and episode identity;
- optional predecessor request identity;
- explicit raw-failure-output disclosure policy;
- abort signal supplied out of band.

The coordinator must not generate IDs, times, provider choices, model choices, retrieval permissions, or budgets.

---

## 8. Adviser role

Initial role:

```text
signal_officer_tactical_adviser
```

The role is advisory.

Required role properties:

- role ID;
- role version;
- purpose;
- allowed observation levels;
- allowed proposal schema;
- allowed strategy families;
- required context classes;
- prohibited behaviour;
- abstention support;
- evidence-reference requirement;
- maximum reason length.

The role may not ask a model for hidden chain-of-thought.

It may request only a concise public reason and typed supporting references.

---

## 9. Generic proposal envelope

Every successful model or baseline proposal must include:

- proposal ID;
- proposal schema ID and version;
- adviser request ID;
- invocation ID or baseline invocation identity;
- domain ID and version;
- observation ID;
- observation source-state digest;
- adviser role ID and version;
- proposer kind;
- model or baseline identity;
- selected strategy identity when present;
- proposal payload;
- confidence basis points;
- uncertainty classification;
- abstention state;
- concise public reason;
- evidence references;
- strategy references;
- proposal provenance;
- validation classification.

Permitted proposer kinds:

```text
model
rule_based_baseline
human_supplied
test
```

A model proposal remains a candidate.

A rule-based proposal remains a baseline.

---

## 10. Confidence, uncertainty, and abstention

Confidence must be represented as:

```text
0 to 10,000 basis points
```

Required uncertainty classes:

```text
low
medium
high
unknown
```

Abstention must be a first-class successful outcome.

An abstaining proposal must include:

- `abstained: true`;
- an abstention code;
- a concise reason;
- known uncertainty;
- relevant evidence references where available.

Required abstention codes:

```text
insufficient_observation
insufficient_evidence
contradictory_evidence
no_applicable_strategy
budget_limited
model_uncertain
unsafe_to_recommend
```

The coordinator must not convert abstention into a forced recommendation.

---

## 11. Strategy record

A strategy record must be immutable and caller supplied.

Required fields:

- strategy ID;
- strategy version;
- strategy schema ID and version;
- domain ID and domain version;
- strategy family;
- objective;
- trigger conditions;
- applicability constraints;
- action preferences;
- termination conditions;
- expected effects;
- known failure modes;
- evidence references;
- counterexample references;
- confidence basis points;
- calibration state;
- evaluation summaries;
- parent strategy references;
- portfolio priority;
- classification;
- recorded-at time;
- actor identity;
- content digest.

Required generic families:

```text
preservation
aggressive_progress
recovery_management
threat_avoidance
uncertainty_safe
long_horizon_planning
diagnostic_exploration
evidence_acquisition
```

Strategy records must use the accepted KTS-I4-D canonical JSON and SHA-256 facilities.

---

## 12. Strategy classification and promotion boundary

Permitted strategy classifications:

```text
deterministic_baseline
experimental_candidate
accepted_production
rejected
quarantined
superseded
```

KTS-I4-E provides no strategy-promotion API.

The portfolio may register an `accepted_production` strategy only when the caller supplies it as such.

The portfolio must not infer acceptance from:

- model confidence;
- usage frequency;
- evaluator score;
- successful retrieval;
- repeated proposal selection;
- absence of counterexamples.

Promotion belongs to a later governed process.

---

## 13. Strategy portfolio

The portfolio is in-memory, bounded, deterministic, and non-persistent.

Required operations:

```text
registerStrategy()
getStrategy()
listStrategiesWithinBudget()
selectApplicableStrategies()
snapshot()
dispose()
```

Prohibited operations:

```text
promoteStrategy()
updateStrategy()
deleteStrategy()
persistStrategy()
trainRouter()
```

Requirements:

- no global singleton;
- exact ID and version identity;
- idempotent registration only for byte-equivalent content;
- conflicting identity fails;
- immutable snapshots;
- no hidden aliases;
- no mutation after registration;
- disposed portfolios reject new work;
- caller-supplied maximum strategy count;
- caller-supplied serialized-character budget.

---

## 14. Strategy applicability

Applicability is explicit and domain supplied.

Each applicability result must include:

- strategy ID and version;
- applicable boolean;
- applicability basis points;
- satisfied constraints;
- unsatisfied constraints;
- uncertainty flags;
- supporting observation references;
- supporting evidence references;
- evaluator ID and version.

Deterministic candidate ordering:

1. applicable strategies only;
2. higher applicability basis points;
3. higher caller-supplied portfolio priority;
4. lexicographically lower strategy ID;
5. lexicographically lower strategy version.

No hidden learned ranking is permitted in KTS-I4-E.

If no strategy is applicable, the adviser must abstain unless an explicitly registered uncertainty-safe baseline is applicable.

---

## 15. Initial KTS baseline portfolio

KTS-I4-E must define versioned deterministic baseline strategies equivalent to:

```text
preserve-signal
preserve-defence
recover-resources
rebalance-power
reduce-projectile-threat
engage-nearest-enemy
advance-wave
uncertainty-safe-hold
```

Every baseline must identify:

- fixed strategy ID and version;
- generic family;
- objective;
- explicit trigger conditions;
- applicability constraints;
- expected effects;
- failure modes;
- zero or more evidence references;
- classification `deterministic_baseline`.

These baselines are comparison instruments.

They are not claims of optimal play.

---

## 16. Bounded retrieval

The KTS adviser may retrieve only through the accepted KTS-I4-D repository contract.

Every request must preserve the accepted retrieval requirements:

- request identity;
- allowed domains;
- allowed classifications;
- accepted retention classes;
- result limit;
- serialized-character budget;
- relation traversal limit;
- optional exact, tag, time, tick, lineage, contradiction, and attachment filters.

KTS-I4-E retrieval rules:

- domain must be explicitly limited to `keep-the-signal`;
- semantic similarity remains unavailable;
- embeddings remain unavailable;
- unsupported retrieval modes fail;
- contradictory episodes must remain visible;
- disallowed classifications must not leak through counts or diagnostics;
- retrieval failure must not silently widen permissions;
- retrieval may be disabled by setting explicit zero budgets.

---

## 17. Context budget

Required context budget fields:

- maximum messages;
- maximum serialized characters;
- maximum strategies;
- maximum retrieved memories;
- maximum evidence references;
- maximum observation characters;
- maximum reason characters;
- maximum system-instruction characters;
- maximum developer-instruction characters.

The context builder must not claim exact token counts without provider evidence.

The separate KTS-I4-B invocation budget remains authoritative for declared token and output limits.

Required context elements:

1. fixed versioned system instruction;
2. fixed versioned developer instruction;
3. accepted observation context;
4. applicable strategy candidates;
5. retrieved episodic memories;
6. direct supporting and contradictory evidence references;
7. output schema descriptor;
8. explicit authority and abstention rules.

---

## 18. Context trust separation

Instruction-bearing and evidence-bearing material must remain distinct.

Required message-role use:

```text
system       fixed adviser authority and safety rules
developer    fixed schema and domain-adapter instructions
context      observation, strategies, memories, and evidence
user         bounded tactical request
```

Rules:

- retrieved memory may not become a system or developer message;
- evidence text must be encoded as JSON-compatible context, not interpolated into instructions;
- stored text containing instruction-like language remains untrusted context;
- the model must be told that context is evidence, not authority;
- the context builder must preserve source labels, trust classification, and evidence references;
- omitted context must be reported;
- required context may not be silently dropped.

---

## 19. Working-memory assembly

The context builder must use the accepted KTS-I4-D bounded working-memory contract.

Required item kinds:

```text
observation
instruction
retrieved_memory
evidence_reference
inference
```

KTS-I4-E rules:

- observation and fixed instructions are required;
- retrieved memories are optional unless the caller marks specific IDs as required;
- model-generated inference is never persisted by the context builder;
- strategy records are represented as bounded context records;
- contradictions are retained as separate items;
- required-item budget failure fails the adviser request;
- every optional omission is visible.

---

## 20. Model invocation

The adviser coordinator may call only the accepted KTS-I4-B invocation coordinator.

Rules:

- exact provider and model identity;
- one attempt only;
- no retry;
- no fallback;
- no model substitution;
- no provider substitution;
- cancellation forwarded;
- deadline enforced by the bridge;
- structured output required;
- raw malformed output withheld by default;
- bridge failure mapped without losing the underlying safe failure code;
- no provider SDK in KTS-I4-E;
- no credentials;
- no direct network call;
- no live provider implementation.

Focused tests must use deterministic KTS-I4-B test adapters defined inside test files.

---

## 21. KTS tactical proposal schema

The first KTS proposal schema must include:

- intent;
- movement priority;
- fire recommendation;
- optional power-transfer recommendation;
- recovery recommendation;
- target or threat priority;
- selected strategy;
- confidence basis points;
- uncertainty classification;
- abstention state;
- concise reason;
- supporting observation facts;
- evidence references;
- contradiction references;
- warnings.

Required intent values:

```text
preserve_signal
preserve_defence
recover
rebalance_power
reduce_threat
engage_target
advance_wave
reposition
hold
observe
```

Movement values:

```text
moveX: -1, 0, 1
moveY: -1, 0, 1
priority: low, medium, high
```

Fire recommendation:

```text
fire_now
hold_fire
conditional
not_applicable
```

Recovery recommendation:

```text
activate_now
hold
conditional
not_applicable
```

Power-transfer recommendation:

```text
none
defence_to_signal
defence_to_weapons
signal_to_defence
signal_to_weapons
weapons_to_defence
weapons_to_signal
```

Target kinds:

```text
none
enemy
enemy_projectile
area
```

A target entity ID is required only for `enemy` and `enemy_projectile`.

---

## 22. KTS proposal validation

The validator must distinguish:

```text
schema_valid
advisory_valid
advisory_rejected
abstained
```

It must validate:

- schema identity and version;
- proposal and request lineage;
- observation identity and source-state digest;
- allowed intent;
- movement values;
- confidence range;
- reason length;
- strategy references;
- evidence references;
- contradiction references;
- target existence in the supplied observation;
- target-kind and ID consistency;
- fire readiness for `fire_now`;
- recovery readiness for `activate_now`;
- power-transfer readiness for an immediate transfer;
- selected strategy membership in the supplied candidate set;
- selected strategy applicability;
- supporting fact references against supplied observation facts.

The validator must not claim final engine legality.

A readiness-consistent recommendation remains advisory until the engine receives and validates a separate action through a later authorized integration.

---

## 23. Unsupported claims and grounding

The free-text reason is explanatory only.

Authoritative grounding is represented through typed references.

Required supporting-fact forms:

- observation field path and normalized value;
- entity identity present in the observation;
- action-readiness field;
- strategy identity;
- evidence identity;
- memory identity;
- contradiction identity.

Rules:

- unknown references fail validation;
- omitted or truncated entities may not be targeted by ID;
- retrieved evidence must be present in the retrieval result;
- strategy references must be present in the candidate portfolio;
- a reason without typed support may be accepted only for an abstention;
- unsupported certainty must be rejected;
- contradiction references may not be silently removed.

---

## 24. Deterministic rule-based adviser baseline

KTS-I4-E must include a deterministic rule-based adviser.

It must:

- consume only an accepted KTS-I4-C observation;
- use only the fixed baseline strategy portfolio;
- use no model bridge;
- use no memory repository;
- use no wall clock or randomness;
- produce the same proposal for equivalent input;
- support abstention;
- identify itself as `rule_based_baseline`;
- return proposal provenance;
- pass through the same KTS proposal validator.

The rule-based adviser exists for comparison, regression testing, and offline evaluation.

It is not a production gameplay controller.

---

## 25. Adviser coordinator result

A completed adviser request must return one immutable result classified as:

```text
proposal
abstention
rejected
failed
cancelled
deadline_exceeded
```

The result must include:

- adviser request identity;
- observation identity and digest;
- provider and model provenance when invoked;
- strategy-candidate report;
- retrieval report;
- working-memory report;
- context report;
- bridge result or safe bridge failure;
- decoded proposal when available;
- proposal-validation report;
- evidence draft when successfully created;
- diagnostic timing only when provided by the injected bridge clock;
- no raw secrets or hidden provider data.

---

## 26. Proposal and evaluation evidence

KTS-I4-E may create immutable evidence records or drafts using the accepted KTS-I4-D evidence contract.

Permitted source types:

```text
proposal
evaluation
```

Proposal evidence must preserve:

- observation evidence identity when supplied;
- observation ID and source-state digest;
- adviser request ID;
- invocation ID;
- provider and model identity;
- strategy references;
- retrieval evidence references;
- proposal payload;
- validation classification;
- confidence and uncertainty;
- abstention state;
- caller-supplied governance metadata.

Evaluation evidence must preserve:

- evaluation case ID;
- proposal evidence ID;
- baseline classification;
- validation result;
- matched seed or episode identity;
- supplied decision or outcome evidence;
- metric values;
- evaluator identity and version;
- limitations.

The adviser must not write these records to a repository.

Persistence remains an explicit caller action.

---

## 27. Evaluation cases

A deterministic evaluation case must include:

- case ID;
- partition ID;
- seed or episode identity;
- observation identity;
- adviser classification;
- model or baseline identity;
- strategy identities;
- retrieval-enabled flag;
- proposal;
- proposal-validation result;
- optional authoritative decision evidence;
- optional authoritative outcome evidence;
- optional human-usefulness rating;
- evaluator identity and version.

Required adviser classifications:

```text
no_adviser
rule_based
base_model_no_retrieval
base_model_with_retrieval
fine_tuned_model
human_only
human_with_adviser
```

KTS-I4-E may represent `fine_tuned_model` for future result compatibility, but it does not train or invoke one.

---

## 28. Evaluation metrics

The evaluator must support metrics derived from supplied evidence:

- schema compliance;
- advisory-valid rate;
- abstention rate;
- unsupported-reference rate;
- unsupported-certainty rate;
- evidence-grounding rate;
- strategy-reference validity;
- rejected or wasted recommendation rate;
- cancellation and deadline rate;
- diagnostic latency when supplied;
- Signal retained;
- Defence retained;
- coherence;
- score;
- wave completion;
- confidence calibration when labelled outcomes exist;
- performance on caller-defined unseen partitions;
- player usefulness when a human rating is supplied.

The evaluator must not invent missing outcome evidence.

Unknown metrics remain unknown.

---

## 29. Matched baseline comparison

Comparison must require compatible matched cases.

Required matching dimensions:

- same seed or episode family;
- compatible engine and ruleset versions;
- compatible observation schema and level;
- compatible adviser decision point;
- compatible evaluation partition.

The aggregator must reject misleading comparisons across incompatible versions or unmatched cases.

It may calculate descriptive differences.

It may not claim causal improvement without an accepted experimental design.

---

## 30. Strategy and evaluation scaling

Required focused scale cases:

- 10,000 registered strategy versions;
- bounded selection from at least 10,000 strategies;
- 1,000 applicable strategy candidates before budget truncation;
- 10,000 evaluation cases;
- mixed supporting and contradictory evidence;
- reduced context budgets;
- zero-memory retrieval mode;
- maximum accepted memory budget;
- repeated deterministic adviser requests;
- concurrent independent adviser requests.

Acceptance is based on bounded deterministic results, not wall-clock thresholds.

---

## 31. Failure taxonomy

Required closed failure codes:

```text
invalid_adviser_request
invalid_adviser_role
invalid_proposal
invalid_proposal_identity
invalid_strategy
invalid_strategy_identity
invalid_strategy_digest
strategy_identity_collision
unknown_strategy
strategy_not_applicable
strategy_budget_exceeded
invalid_context_budget
required_context_omitted
context_budget_exceeded
retrieval_failed
retrieval_not_authorized
context_build_failed
invalid_prompt_contract
bridge_failed
proposal_empty
proposal_malformed
proposal_schema_rejected
proposal_not_grounded
unsupported_evidence_reference
unsupported_strategy_reference
invalid_target_reference
unready_recommendation
evaluation_invalid
evaluation_pair_mismatch
adviser_disposed
adviser_internal_failure
```

Failures must contain:

- code;
- stage;
- safe public message;
- adviser request ID when valid;
- invocation ID when valid;
- observation ID when safe;
- optional safe diagnostics.

Failures must not expose:

- credentials;
- provider headers;
- full prompts;
- raw malformed model output by default;
- hidden memory records;
- restricted-record counts;
- local paths;
- stack traces;
- engine internals.

---

## 32. Immutability and mutation isolation

Tests must prove:

- strategies are immutable;
- portfolio snapshots are immutable;
- applicability results are immutable;
- retrieval inputs are not mutated;
- working-memory inputs are not mutated;
- bridge requests are immutable;
- model output is cloned before public return;
- proposal validation does not mutate the proposal;
- evidence drafting does not mutate the adviser result;
- evaluation aggregation does not mutate cases;
- caller mutation after completion cannot change any result;
- concurrent requests do not share mutable state.

---

## 33. Security and prohibited APIs

The transferable and KTS tactical-adviser production files must not use:

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

No production file may contain:

- provider SDK imports;
- credentials;
- remote endpoints;
- direct network transport;
- global mutable singletons;
- payload logging;
- analytics;
- telemetry;
- background scheduling;
- dynamic code execution;
- model downloads;
- direct D1 binding access;
- engine execution;
- runtime integration;
- UI rendering.

The accepted model bridge and memory repository interfaces are the only permitted invocation and retrieval boundaries.

---

## 34. Required focused tests

At least **220 focused named tests** are required across the ten authorized test files.

### Strategy contract tests

Must cover:

- schema identity;
- every family;
- every classification;
- identity and version validation;
- canonical digest;
- evidence and counterexample references;
- parent lineage;
- calibration;
- immutable records;
- collision equivalence.

### Strategy portfolio tests

Must cover:

- registration;
- exact lookup;
- byte-equivalent idempotency;
- conflicting collision;
- candidate budgets;
- deterministic applicability sorting;
- no hidden alias;
- no promotion;
- immutable snapshot;
- disposal;
- 10,000-strategy bounded scale.

### Context tests

Must cover:

- role separation;
- fixed instruction versioning;
- evidence-as-context;
- instruction-like memory text remaining context;
- required-item protection;
- optional omission metadata;
- zero-memory mode;
- contradictory evidence preservation;
- strategy and evidence budgets;
- character and message budgets;
- no exact token-count claim;
- immutability.

### Coordinator tests

Must cover:

- exact provider and model request;
- one attempt;
- no retry or fallback;
- deterministic test-provider success;
- bridge-failure preservation;
- cancellation;
- deadline;
- malformed output;
- schema rejection;
- unsupported references;
- abstention;
- independent concurrency;
- disposal;
- no persistence.

### Evaluation tests

Must cover:

- every adviser classification;
- matched comparisons;
- mismatched seed rejection;
- version mismatch rejection;
- unknown outcomes;
- descriptive differences;
- evidence grounding;
- confidence calibration with labels;
- 10,000-case bounded aggregation;
- immutable reports.

### KTS proposal tests

Must cover every:

- intent;
- fire recommendation;
- recovery recommendation;
- power-transfer recommendation;
- target kind;
- uncertainty class;
- abstention code;
- confidence boundary;
- reason boundary;
- schema version;
- immutable proposal.

### KTS validator tests

Must cover:

- observation lineage;
- source-state digest;
- target existence;
- truncated target rejection;
- fire readiness;
- recovery readiness;
- every power-transfer readiness direction;
- applicable strategy requirement;
- evidence and contradiction references;
- supporting facts;
- unsupported certainty;
- advisory-versus-engine-authority wording;
- no mutation.

### Rule-based adviser tests

Must cover:

- deterministic equivalence;
- all baseline strategies;
- signal-preservation conditions;
- defence-preservation conditions;
- projectile-threat conditions;
- recovery conditions;
- rebalance conditions;
- wave-progress conditions;
- uncertainty-safe hold;
- abstention;
- same validator path;
- no model or memory use.

### Evidence tests

Must cover:

- proposal evidence;
- evaluation evidence;
- model provenance;
- baseline provenance;
- observation lineage;
- strategy references;
- memory and evidence references;
- validation classification;
- caller governance metadata;
- digest;
- no repository write;
- immutability.

### Boundary tests

Must cover:

- exact production file sets;
- no engine execution import;
- no runtime import;
- no presentation import;
- no player import;
- no route or React import;
- no provider SDK;
- no direct network;
- no storage API;
- no direct D1 access;
- no random or wall clock;
- no strategy promotion;
- no action execution;
- no UI;
- no package or configuration dependency.

---

## 35. Complete repository validation

Required before implementation acceptance:

```text
focused KTS-I4-E tests
complete repository tests
typecheck
client production build
SSR production build
lint
format check
git diff --check
```

Required static scans:

- prohibited APIs;
- provider SDKs and credentials;
- model downloads and endpoints;
- direct D1 access;
- payload logging;
- engine execution;
- action execution;
- runtime, presentation, player, route, and React imports;
- strategy promotion methods;
- update or delete memory methods;
- live provider implementations.

Required boundary diffs:

- no KTS engine change;
- no KTS runtime change;
- no KTS presentation change;
- no KTS player change;
- no route or home change;
- no KTS-I4-B model-bridge change;
- no KTS-I4-C observation-adapter change;
- no KTS-I4-D memory-fabric or D1 change;
- no migration change;
- no package or lock-file change;
- no Wrangler, Vite, Vitest, or worker change;
- protected hero stash unchanged.

---

## 36. Result record

Implementation must create:

```text
docs/game/KTS-I4-E-TACTICAL-ADVISER-STRATEGY-PORTFOLIO-RESULT.md
```

It must record:

- governing, contract, and implementation commits;
- exact changed paths;
- schema and role identities;
- proposal fields and enums;
- strategy families and baseline identities;
- applicability and portfolio ordering;
- context and retrieval budgets;
- prompt-role separation;
- bridge invocation rules;
- validator rules;
- rule-based baseline;
- evidence-drafting rules;
- evaluation classes and metrics;
- scale cases;
- focused and repository test totals;
- type, build, lint, format, and diff results;
- static scans;
- boundary diffs;
- protected stash;
- known limitations;
- confirmation that no live provider was added or called;
- confirmation that no gameplay action was executed;
- confirmation that no evidence or memory was persisted;
- confirmation that no strategy was promoted;
- confirmation that no model was trained or fine-tuned.

---

## 37. Explicit non-goals

KTS-I4-E does not include:

- live provider adapters;
- provider credentials;
- local model installation;
- model download;
- remote inference;
- streaming;
- tool calling;
- embeddings;
- semantic retrieval;
- reranking;
- live D1 activation;
- live runtime ingestion;
- adviser UI;
- audio advice;
- automatic control;
- engine action execution;
- strategy promotion;
- semantic-claim promotion;
- procedural-skill promotion;
- consolidation;
- verified forgetting;
- deletion;
- tombstones;
- training-example generation;
- training;
- fine-tuning;
- deployment.

---

## 38. Acceptance criteria

KTS-I4-E may be accepted only when:

- the adviser remains advisory;
- engine authority is unchanged;
- strategy records are immutable and evidence-linked;
- the portfolio is bounded and deterministic;
- no strategy-promotion API exists;
- initial KTS baselines are explicit and non-optimality claims are avoided;
- retrieval is explicit, authorized, bounded, and contradiction-preserving;
- context roles separate instructions from evidence;
- required context fails closed rather than being silently omitted;
- the bridge is called once with exact provider and model identity;
- no live provider is included or called;
- model output must pass strict schema validation;
- unsupported references fail;
- abstention remains available;
- KTS readiness checks remain advisory rather than final engine legality;
- the deterministic rule-based baseline uses the same proposal validator;
- proposal and evaluation evidence are drafted but not persisted;
- evaluation rejects unmatched comparisons;
- at least 220 focused tests pass;
- scale tests remain bounded;
- all repository gates pass;
- accepted KTS-I4-B, KTS-I4-C, and KTS-I4-D code remains unchanged;
- no runtime, UI, execution, persistence, promotion, consolidation, deletion, training, or deployment is introduced;
- the result record is complete.

---

## 39. Codex implementation posture

After contract acceptance and explicit implementation authorization, KTS-I4-E should be implemented through the established Byte–Codex workflow:

```text
Byte
    → accepted architecture and exact implementation boundary
Codex
    → repository-native implementation, compilation, tests, and repair loops
Byte
    → evidence review, boundary audit, result finalization, and acceptance recommendation
Nolan
    → operator execution, authorization, commit, and final acceptance
```

Codex must not:

- broaden the slice;
- modify accepted subsystem files;
- add dependencies;
- install or invoke a live model;
- activate D1;
- connect the adviser to runtime or UI;
- stage, commit, push, merge, or deploy unless separately instructed.

---

## 40. Decision statements

Contract acceptance phrase:

```text
ACCEPT KTS-I4-E CONTRACT
```

Implementation authorization phrase:

```text
AUTHORIZE KTS-I4-E
```

Acceptance of this contract does not authorize implementation.

Implementation authorization permits work only within the exact 30 future paths and constraints defined here.

Push, pull request creation, merge, deployment, live provider integration, model installation or invocation, runtime integration, UI integration, persistence, strategy promotion, consolidation, deletion, training, and fine-tuning remain separately unauthorized.

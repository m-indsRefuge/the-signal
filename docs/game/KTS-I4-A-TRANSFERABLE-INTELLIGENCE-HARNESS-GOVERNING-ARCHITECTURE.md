# KTS-I4-A — Transferable Intelligence Harness Governing Architecture

**Document ID:** KTS-I4-A-CONTRACT
**Status:** Proposed documentation-only governing architecture
**Project:** Keep the Signal / Construct Intelligence Harness
**Primary domain adapter:** Keep the Signal
**Future target adapters:** Lighthouse, Batch-87 Apprentice, other approved Construct systems
**Implementation authorization:** Not granted by this document
**Core doctrine:** The model may propose strategy. The governed system must prove it.

---

## 1. Purpose

KTS-I4-A establishes the governing architecture for a transferable intelligence harness that can learn from bounded domain experience, retain and consolidate useful information, distil experience into strategies and model training evidence, forget safely, and transfer reusable infrastructure between Keep the Signal, Lighthouse, Batch-87 Apprentice, and later approved Construct systems.

Keep the Signal is the first controlled environment because it already provides deterministic state progression, explicit seeds, exact input frames, canonical serialization, replay, authoritative outcome evidence, bounded legal actions, and inexpensive repeatable evaluation.

This release does not treat Keep the Signal as a disposable laboratory. KTS remains a real game with an independent product and presentation roadmap. The intelligence harness is attached through a governed adapter boundary and may not become authoritative over the engine.

---

## 2. Architectural thesis

A compact model can achieve substantially greater domain competence when embedded in a governed system that provides:

- precise observations;
- bounded legal actions;
- typed memory;
- evidence provenance;
- deterministic or externally verified outcomes;
- selective retrieval;
- executable strategy representations;
- counterfactual evaluation where the domain permits it;
- deliberate training and distillation;
- verified forgetting;
- explicit promotion gates;
- human authority over irreversible changes.

This is a testable engineering and research thesis. It is not a claim that small models are generally equivalent to larger models, that the harness constitutes artificial general intelligence, or that any algorithm is novel before prior-art review and reproducible evidence establish novelty.

---

## 3. Permanent authority boundaries

### 3.1 Domain authority

The domain system remains authoritative.

For Keep the Signal:

- the deterministic game engine owns state;
- the engine owns legal actions;
- the engine owns damage, scoring, waves, cooldowns, encounters, RNG, serialization, replay, and digest;
- model output is advisory or a bounded proposal until validated;
- no model output may directly mutate authoritative game state.

For Lighthouse and Batch-87, equivalent domain-specific authority contracts must be defined before integration.

### 3.2 Governance authority

The harness may not override:

- human authority;
- consent;
- security;
- privacy;
- protection of personal information;
- applicable law;
- domain safety constraints;
- accepted evidence-integrity rules;
- explicit implementation and deployment authorization.

### 3.3 Learning authority

The harness may:

- observe authorized evidence;
- retrieve accepted memories;
- propose strategies;
- produce candidate abstractions;
- generate candidate training examples;
- propose algorithm candidates inside a sandbox;
- evaluate candidates using accepted evaluators.

The harness may not autonomously:

- promote a candidate strategy into production;
- delete protected evidence;
- overwrite accepted algorithms;
- change governance rules;
- change domain reward or acceptance criteria;
- fine-tune or deploy a model without authorization;
- rewrite itself continuously during live operation;
- conceal uncertainty, provenance gaps, or conflicting evidence.

---

## 4. System decomposition

The transferable system is divided into six governed layers.

### 4.1 Governance and authority kernel

Owns:

- permissions;
- identity and actor roles;
- consent;
- execution authority;
- protected-memory classes;
- promotion gates;
- prohibited operations;
- model and algorithm version approval.

### 4.2 Evidence and provenance ledger

Owns:

- immutable evidence identifiers;
- source type;
- source version;
- timestamps or authoritative ticks;
- content digest;
- parent and derived lineage;
- domain adapter version;
- model version;
- strategy version;
- evaluator version;
- acceptance status.

### 4.3 Memory fabric

Owns:

- working memory;
- episodic memory;
- semantic strategy memory;
- procedural skill memory;
- parametric-memory lineage;
- retrieval;
- consolidation;
- contradiction handling;
- retention;
- archival;
- verified forgetting.

### 4.4 Strategy and skill system

Owns:

- candidate strategy representation;
- strategy families;
- applicability conditions;
- legal-action constraints;
- expected outcomes;
- known failure modes;
- version lineage;
- executable bounded policies;
- strategy routing.

### 4.5 Model and training system

Owns:

- provider-neutral invocation;
- observation packing;
- structured-output validation;
- model routing;
- prompt and schema versioning;
- training-example generation;
- SFT;
- LoRA or QLoRA adapters;
- preference pairs;
- teacher-student distillation;
- evaluation partitions.

### 4.6 Evaluation and algorithm laboratory

Owns:

- baselines;
- deterministic replay evaluation;
- counterfactual branching where valid;
- unseen evaluation partitions;
- ablations;
- scaling tests;
- candidate algorithm sandboxing;
- differential testing;
- promotion evidence.

---

## 5. Core domain-independent types

The harness core must reason in generic typed records rather than Keep the Signal vocabulary.

Minimum conceptual types:

- `Observation`
- `ObservationLayer`
- `LegalAction`
- `ActionProposal`
- `ValidatedAction`
- `Decision`
- `Outcome`
- `Episode`
- `MemoryRecord`
- `SemanticClaim`
- `Strategy`
- `Skill`
- `EvidenceReference`
- `Contradiction`
- `TrainingExample`
- `EvaluationCase`
- `AlgorithmCandidate`
- `PromotionDecision`
- `DeletionDecision`
- `MemoryTombstone`

Every persisted or promoted record must identify its domain, schema version, evidence lineage, and acceptance state.

---

## 6. Domain adapter protocol

Each domain adapter must implement or provide equivalents for:

```text
observe()
observation_layers()
legal_actions()
validate_proposal()
execute_or_reject()
score_outcome()
episode_boundary()
replay()
counterfactual_capabilities()
protected_evidence_classes()
domain_metrics()
```

### 6.1 Keep the Signal adapter

The first adapter must expose bounded, versioned observations including:

- seed;
- authoritative tick;
- wave and phase;
- player state;
- Signal and Defence;
- power allocation;
- cooldowns;
- visible threats;
- permitted actions;
- recent meaningful events;
- score and coherence;
- engine, rules, observation, and adapter versions.

The adapter must never expose mutable engine references to the model layer.

### 6.2 Transfer expectation

Transfer means reuse of harness infrastructure, not automatic transfer of domain competence.

Expected reusable components:

- evidence ledger;
- memory lifecycle;
- retrieval;
- consolidation;
- strategy schema;
- model invocation;
- training pipeline;
- evaluation orchestration;
- algorithm laboratory;
- promotion and deletion governance.

Expected domain-specific components:

- ontology;
- observations;
- legal actions;
- reward and outcome definitions;
- tool safety;
- executable skills;
- domain benchmarks.

---

## 7. Hierarchical observation architecture

Observations must be layered to prevent complexity from growing linearly with domain depth.

### Level 0 — Immediate tactical state

Contains only information required for the next bounded decision.

### Level 1 — Local situation summary

Contains current objective, active threats, local resource posture, and short trajectory.

### Level 2 — Episode trajectory

Contains compressed history, turning points, prior decisions, and unresolved uncertainties.

### Level 3 — Strategic context

Contains retrieved strategies, analogous episodes, applicable claims, and known failure patterns.

### Level 4 — Cross-domain principles

Contains only explicitly approved abstractions that have survived transfer evaluation.

A model role receives only the layers required for that role. No role automatically receives the full memory corpus.

---

## 8. Two learning clocks

### 8.1 Fast operational loop

```text
observe
→ retrieve within budget
→ construct bounded context
→ propose
→ validate
→ execute or reject
→ record evidence
```

The operational loop must have explicit limits for:

- inference time;
- context tokens;
- retrieved memories;
- candidate strategies;
- evaluator calls;
- action frequency.

### 8.2 Slow consolidation loop

```text
select episodes
→ cluster
→ identify patterns
→ generate candidate abstractions
→ test against supporting and contradictory evidence
→ compile strategies or skills
→ generate training evidence
→ evaluate
→ promote, retain, archive, or reject
```

The slow loop may not silently modify live production behaviour.

---

## 9. Memory architecture

### 9.1 Working memory

Temporary context for the active decision or task.

Properties:

- bounded;
- non-authoritative;
- disposable after the decision unless selected as evidence;
- assembled from typed sources;
- must distinguish observation, instruction, inference, and retrieved memory.

### 9.2 Episodic memory

Selected records of experience.

An episode must preserve:

- initial conditions;
- observation sequence or accepted compression;
- proposals;
- accepted and rejected actions;
- outcomes;
- model and strategy versions;
- evidence digest;
- surprise or significance classification;
- human corrections;
- contradictions.

### 9.3 Semantic strategy memory

Generalized claims supported by episodes.

Every semantic claim must include:

- claim text or structured representation;
- applicability conditions;
- supporting evidence;
- counterexamples;
- confidence;
- extraction method;
- validation state;
- domain scope;
- transfer status.

### 9.4 Procedural skill memory

Machine-checkable or executable behaviours.

Permitted representations include:

- decision trees;
- finite-state policies;
- bounded heuristics;
- typed workflow graphs;
- validated code fragments;
- small classifiers;
- strategy-routing rules.

Procedural skills require tests before promotion.

### 9.5 Parametric memory

Knowledge incorporated into model weights or adapters.

Every model adapter must retain:

- base model identity;
- training dataset version;
- training-example lineage;
- hyperparameters;
- software and hardware environment;
- evaluation results;
- known regressions;
- accepted use scope.

---

## 10. Memory diffusion and consolidation

Knowledge may move through the following governed progression:

```text
authoritative events
→ episode
→ episode cluster
→ candidate pattern
→ validated semantic claim
→ executable strategy or skill
→ training example
→ model adapter
```

No stage erases the identity of its evidence sources.

### 10.1 Consolidation requirements

A candidate abstraction must be tested against:

- supporting episodes;
- counterexamples;
- unseen episodes;
- competing explanations;
- domain invariants;
- known version boundaries.

### 10.2 Contradiction preservation

Contradictory evidence must not be averaged away merely to produce a simpler claim.

The system must support:

- coexistence of context-dependent strategies;
- explicit uncertainty;
- conditional applicability;
- rejected generalizations;
- unresolved contradictions.

---

## 11. Verified forgetting

Memory deletion is a governed evidence operation.

A memory may become deletion-eligible only when:

1. required information is preserved in an accepted higher-level representation;
2. provenance remains traceable;
3. it is not the only supporting example;
4. it is not a unique counterexample or failure;
5. it is not protected by governance, audit, reproducibility, or retention policy;
6. removal passes reconstruction and retrieval-quality checks;
7. a deterministic deletion policy authorizes removal;
8. a tombstone is written.

### 11.1 Tombstone requirements

A tombstone preserves:

- deleted memory ID;
- type;
- digest;
- lineage references;
- deletion reason;
- policy version;
- authorizing actor;
- evaluation evidence;
- deletion time.

### 11.2 Protected classes

The following are not automatically deletable:

- governance violations;
- safety failures;
- unique failures;
- human corrections;
- contradictory evidence;
- benchmark evidence;
- training lineage;
- promotion and rejection evidence;
- model-version transitions;
- records required to reproduce accepted results.

---

## 12. Strategy representation and scaling

A strategy must be decomposable.

Minimum fields:

- strategy ID and version;
- domain and strategy family;
- objective;
- trigger conditions;
- applicability constraints;
- action preferences;
- termination conditions;
- expected effects;
- known failure modes;
- evidence references;
- confidence and calibration;
- evaluator results;
- parent strategies or mutations.

### 12.1 Strategy families

The harness must support portfolios rather than one universal policy.

Example generic families:

- preservation;
- aggressive progress;
- recovery management;
- threat avoidance;
- uncertainty-safe behaviour;
- long-horizon planning;
- diagnostic exploration;
- evidence acquisition.

### 12.2 Hierarchical decision structure

As action spaces grow, the harness must support:

```text
objective
→ strategic posture
→ plan
→ tactic
→ legal action
```

The system must not require enumeration of all future action sequences.

### 12.3 Intuition and learned representations

The architecture permits learned value estimates, embeddings, compact policy representations, and model proposals that are not fully reducible to explicit verbal rules.

However:

- proposals may be intuitive;
- acceptance must remain testable;
- confidence must be represented;
- unsupported certainty is prohibited;
- opaque policies require stronger evaluation before promotion.

---

## 13. Retrieval and bounded computation

Retrieval must not depend on a single embedding index.

Supported retrieval views should include:

- exact identity;
- typed metadata;
- structural similarity;
- semantic similarity;
- temporal relation;
- causal relation;
- strategy lineage;
- outcome statistics;
- domain and version compatibility.

Every inference role must define budgets for:

- retrieved records;
- compressed summaries;
- total tokens;
- strategy candidates;
- deliberation depth;
- latency;
- fallback behaviour.

The system must degrade safely when a budget is exceeded.

---

## 14. Model roles

Initial model roles are restricted to:

- tactical adviser;
- post-episode analyst;
- memory abstraction proposer;
- strategy candidate generator;
- training-example proposer;
- evaluator assistant where deterministic evaluation is insufficient.

Later optional roles may include:

- approval-gated co-pilot;
- sandboxed benchmark autopilot;
- strategy router;
- domain transfer assistant.

No role may bypass the domain validator.

---

## 15. Training and fine-tuning

Training is part of the architecture but requires separate authorization.

Permitted future methods include:

- supervised fine-tuning;
- LoRA;
- QLoRA;
- preference optimization;
- teacher-student distillation;
- curriculum learning;
- hard-negative and failure-correction training;
- replay-based continual training;
- adapter composition experiments.

### 15.1 Dataset requirements

Training examples must identify:

- source episode;
- observation schema;
- target schema;
- accepted or rejected status;
- teacher or generator;
- reviewer;
- model and strategy versions;
- train, validation, or test partition;
- evidence digest.

### 15.2 Partitioning

Training and evaluation must be separated by:

- seed or incident identity;
- episode family;
- version;
- temporal boundary where applicable;
- domain transfer split where applicable.

### 15.3 Small-model META

The first target should be a compact model suitable for local inference and adapter training.

The research objective is highest verified domain quality per unit of compute, not maximum model size.

---

## 16. Algorithm laboratory

The harness may host constrained algorithm experiments.

Initial candidate areas:

- memory ranking;
- replay selection;
- episode clustering;
- context packing;
- strategy retrieval;
- strategy routing;
- consolidation scheduling;
- compression;
- model routing;
- evaluator allocation.

### 16.1 Candidate workflow

```text
accepted baseline
→ bounded candidate generation or mutation
→ static checks
→ invariant and property tests
→ differential evaluation
→ unseen benchmark
→ scaling test
→ ablation
→ human review
→ acceptance or rejection
```

### 16.2 Protected algorithms

The laboratory may not initially rewrite:

- KTS authoritative engine rules;
- KTS digest or serialization;
- Lighthouse action-safety controls;
- Batch-87 governance;
- authorization systems;
- evidence-integrity mechanisms;
- retention requirements.

Any future work in protected areas requires a separate contract.

---

## 17. Scalability requirements

The harness must be tested as the following increase:

- episode count;
- strategy count;
- memory depth;
- domain complexity;
- action-space size;
- observation size;
- model count;
- adapter count;
- model and strategy versions.

Required scaling measures include:

- retrieval latency;
- inference latency;
- context size;
- memory growth;
- consolidation cost;
- evaluation cost;
- deletion eligibility rate;
- reconstruction quality;
- strategy-selection quality;
- performance under reduced budgets.

A system that works only at small memory volume is not accepted as scalable.

---

## 18. Keep the Signal first experiment

The first accepted experiment should be advisory, not autonomous.

### 18.1 Role

**Signal Officer / Tactical Adviser**

### 18.2 Behaviour

The model receives a bounded tactical observation and emits a schema-validated proposal containing:

- intent;
- movement priority;
- optional power-transfer recommendation;
- recovery recommendation;
- target or threat priority;
- confidence;
- concise reason;
- evidence references where retrieved memory influenced the result.

### 18.3 Comparison baselines

The adviser must be compared against:

- no adviser;
- deterministic rule-based adviser;
- base compact model without retrieval;
- base compact model with retrieval;
- later fine-tuned model;
- human-only play;
- human play with adviser.

### 18.4 Initial success metrics

- schema compliance;
- legal proposal rate;
- latency;
- unsupported-claim rate;
- player usefulness;
- Signal retained;
- Defence retained;
- coherence;
- score;
- wave completion;
- rejected or wasted recommendation rate;
- performance on unseen seeds.

---

## 19. Concurrent product development

Keep the Signal may continue evolving as a game while the harness is developed.

Game work may include:

- visual refinement;
- arcade-style ships and enemies;
- new effects;
- encounter balancing;
- enemy archetypes;
- additional game modes;
- accessibility and audio improvements.

Purely presentational work does not require harness generalization.

New mechanics require adapter review only when they change:

- observations;
- legal actions;
- outcomes;
- strategic depth;
- authority;
- evaluation.

---

## 20. Production, experiment, and hypothesis separation

All work must be classified as one of:

### Accepted production

Validated and approved for active use.

### Experimental candidate

Implemented in a sandbox with explicit evaluation and no production authority.

### Research hypothesis

A proposed idea without implementation or acceptance.

No candidate or hypothesis may be described as accepted intelligence.

---

## 21. Proposed implementation progression

This governing architecture defines the following future slices:

- **KTS-I4-B — Provider-Neutral Model and Invocation Bridge**
- **KTS-I4-C — Keep the Signal Domain Adapter and Observation Contract**
- **KTS-I4-D — Evidence-Grounded Memory Fabric**
- **KTS-I4-E — Tactical Adviser and Strategy Portfolio**
- **KTS-I4-F — Consolidation and Verified Forgetting**
- **KTS-I4-G — Training-Evidence and Distillation Pipeline**
- **KTS-I4-H — First Compact-Model Fine-Tuning Experiment**
- **KTS-I4-I — Algorithm Laboratory**
- **KTS-I4-J — Cross-Domain Transfer Trial**

Each slice requires its own contract, acceptance criteria, implementation authorization, evidence, and result record.

---

## 22. Non-goals of KTS-I4-A

This document does not authorize:

- model integration;
- provider credentials;
- model downloads;
- inference calls;
- training;
- fine-tuning;
- new persistence;
- background workers;
- network services;
- gameplay changes;
- algorithm mutation;
- memory deletion;
- autonomous execution;
- deployment;
- package changes;
- hero or presentation changes;
- transfer into Lighthouse or Batch-87.

---

## 23. Acceptance requirements

KTS-I4-A may be accepted only if it clearly establishes:

- domain authority;
- governance authority;
- transferable core versus domain adapter boundaries;
- hierarchical observations;
- two learning clocks;
- five memory classes;
- provenance-preserving consolidation;
- verified forgetting;
- scalable strategy representation;
- bounded retrieval and computation;
- small-model training architecture;
- constrained algorithm experimentation;
- concurrent KTS product development;
- cross-domain transfer expectations;
- production, candidate, and hypothesis separation;
- no implementation authorization.

---

## 24. Decision statement

Acceptance of KTS-I4-A means:

> The Construct may proceed to design a provider-neutral intelligence harness whose first domain is Keep the Signal, while preserving deterministic domain authority, evidence lineage, bounded computation, safe memory consolidation, verified forgetting, small-model training discipline, and transferability to later approved domains.

Acceptance does not authorize implementation.

The exact acceptance phrase is:

```text
ACCEPT KTS-I4-A GOVERNING ARCHITECTURE
```

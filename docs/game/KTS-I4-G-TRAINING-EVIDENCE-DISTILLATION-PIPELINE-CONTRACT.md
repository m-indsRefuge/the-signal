# KTS-I4-G — Training-Evidence and Distillation Pipeline Contract

**Document ID:** KTS-I4-G-CONTRACT
**Status:** Proposed implementation contract
**Project:** Construct Intelligence Harness / Keep the Signal
**Governing architecture:** KTS-I4-A
**Accepted model bridge:** KTS-I4-B
**Accepted KTS observation adapter:** KTS-I4-C
**Accepted evidence-grounded memory fabric:** KTS-I4-D
**Accepted tactical adviser and strategy portfolio:** KTS-I4-E
**Accepted consolidation and verified-forgetting layer:** KTS-I4-F
**Base checkpoint requirement:** Accepted KTS-I4-F implementation commit whose parent is `7b02108415107c36cd4699f6c63de695915fa2cd`
**Target branch:** `game/keep-the-signal-i4-intelligence-harness`
**Implementation method:** Byte Coding until Codex availability is restored
**Implementation authorization:** Not granted by this document
**Operational classification:** Experimental candidate; dataset construction and evaluation planning only
**Core doctrine:** Training evidence may be compiled only from traceable accepted sources. A dataset candidate is not permission to train.

---

## 1. Purpose

KTS-I4-G establishes the first governed training-evidence and distillation-planning layer above the accepted evidence, episodic-memory, tactical-adviser, evaluation, and consolidation subsystems.

The slice provides deterministic, provenance-preserving contracts and reference implementations for:

- selecting eligible source records through a read-only boundary;
- constructing typed training-example candidates;
- compiling supervised targets;
- compiling preference pairs;
- compiling correction and rejection examples;
- compiling abstention and uncertainty examples;
- compiling retrieval-grounding examples;
- compiling strategy-routing examples;
- preserving accepted and rejected labels without collapsing them;
- grouping related records before partition assignment;
- deterministic train, validation, test, and quarantine partitioning;
- seed, episode-family, lineage, version, and temporal leakage prevention;
- exact and structural duplicate detection;
- contradiction and protected-evidence checks;
- quality-gate decisions;
- deterministic curriculum plans;
- deterministic sampling plans;
- teacher-student distillation plans from already recorded outputs;
- immutable dataset manifests;
- bounded in-memory export drafts;
- dataset metrics and audit reports;
- Keep the Signal-specific evidence projection.

KTS-I4-G does not train or fine-tune any model.

It does not:

- invoke a teacher model;
- invoke a student model;
- call a provider;
- download model weights;
- create an adapter;
- change model weights;
- start SFT, LoRA, QLoRA, preference optimization, or distillation;
- write a dataset to durable storage;
- persist a training example;
- promote a dataset;
- promote a strategy;
- alter evidence or memory;
- delete or archive evidence;
- execute gameplay actions;
- integrate with the live runtime or UI;
- create a background training job;
- deploy anything.

The implementation produces reviewable training-evidence candidates, partition manifests, quality reports, curriculum plans, and distillation plans only.

---

## 2. Architectural position

```text
Accepted evidence and episodic memory
Accepted KTS observations and proposals
Accepted adviser evaluations
Accepted consolidation candidates and validation reports
    ↓
Explicit read-only source selection
    ↓
Source eligibility and governance checks
    ↓
Typed example construction
      supervised target
      preference pair
      correction
      abstention
      retrieval grounding
      strategy routing
    ↓
Lineage-family grouping
    ↓
Deterministic partition assignment
      train
      validation
      test
      quarantine
    ↓
Leakage and duplicate audit
    ↓
Contradiction, protection, consent, and policy audit
    ↓
Quality-gate decision
    ↓
Curriculum and sampling plan
    ↓
Recorded-output distillation plan
    ↓
Immutable dataset manifest and in-memory export draft
```

Nothing in this flow may invoke a model, train a model, persist a dataset, or mutate accepted evidence.

---

## 3. Meaning of training evidence

KTS-I4-G defines **training-evidence candidates**, not accepted training data.

A training-example candidate is a typed derivative record that:

- identifies every authoritative or accepted source;
- identifies its construction policy and version;
- contains only the bounded input and target required for its declared task;
- preserves accepted, rejected, corrected, abstained, and uncertain outcomes explicitly;
- identifies the intended partition;
- records quality-gate results;
- records whether human review is required;
- remains non-authoritative until separately approved.

A dataset manifest may be classified only as:

```text
draft
review_required
validation_candidate
rejected
quarantined
superseded
```

KTS-I4-G must not emit:

```text
training_started
training_complete
fine_tuned
deployed
production_model
accepted_adapter
```

A later KTS-I4-H contract is required before any compact-model fine-tuning experiment.

---

## 4. Permanent authority boundaries

### 4.1 Evidence authority

Accepted KTS-I4-D evidence and episodic memory remain authoritative and immutable.

KTS-I4-G may:

- retrieve accepted records through an explicitly read-only source;
- reference accepted KTS-I4-C observations;
- reference KTS-I4-E proposals, abstentions, rejections, and evaluations;
- reference KTS-I4-F candidate abstractions and validation reports;
- construct immutable derivative candidates;
- preserve contradictory and rejected evidence;
- quarantine ineligible derivatives.

KTS-I4-G may not:

- call a repository write operation;
- change an evidence classification;
- rewrite a proposal or outcome;
- replace a human correction;
- convert an experimental abstraction into accepted knowledge;
- infer acceptance merely because an example passes schema validation.

### 4.2 Training authority

KTS-I4-G may create:

- example candidates;
- preference candidates;
- dataset manifests;
- quality reports;
- partition assignments;
- curriculum plans;
- sampling plans;
- distillation plans;
- export drafts.

KTS-I4-G may not:

- start a training process;
- create model weights or adapters;
- invoke an optimizer;
- select hardware;
- allocate remote compute;
- upload data;
- persist an export;
- approve a dataset for training;
- approve a model for use.

### 4.3 Teacher authority

A teacher contribution must be an already recorded, reviewable output with known identity and provenance.

KTS-I4-G may not call a teacher model.

A teacher record must identify:

- teacher kind;
- teacher identity;
- teacher version;
- generation or recording method;
- source observation and context;
- output schema;
- reviewer status;
- evidence references;
- known uncertainty;
- known rejection or correction status.

Permitted teacher kinds:

```text
human
deterministic_policy
recorded_model
accepted_strategy
accepted_result
```

A recorded model output is not accepted merely because it came from a larger model.

### 4.4 Human and governance authority

Only governance may:

- approve a dataset;
- approve use of protected evidence;
- approve a human-authored correction as a target;
- authorize a fine-tuning experiment;
- approve a base model;
- approve model downloads;
- approve training infrastructure;
- accept or reject resulting adapters.

---

## 5. Source eligibility

A source record is eligible for example construction only when all required checks pass.

Required checks include:

- valid public identity;
- accepted domain and schema identity;
- intact digest and lineage;
- source classification permitted by policy;
- explicit target task compatibility;
- accepted consent and privacy status where applicable;
- no unresolved authorization prohibition;
- no unsupported target inference;
- partition group identity available;
- construction policy version available.

Source eligibility outcomes:

```text
eligible
review_required
ineligible
quarantined
```

A protected record may be used only when the policy explicitly permits its declared purpose.

A record may be retained for evaluation or audit while remaining prohibited from training partitions.

---

## 6. Training-example kinds

KTS-I4-G must support these transferable example kinds:

```text
supervised_target
preference_pair
correction
abstention
retrieval_grounding
strategy_routing
```

### 6.1 Supervised target

Contains:

- bounded model input;
- one schema-valid target;
- target acceptance status;
- source outcome evidence;
- legal-action or proposal constraints where applicable.

### 6.2 Preference pair

Contains:

- one shared bounded input;
- preferred candidate;
- dispreferred candidate;
- preference basis;
- evaluator identity;
- evidence supporting the comparison;
- tie or indeterminate status where preference cannot be established.

A pair must not be created when the evidence does not justify an ordering.

### 6.3 Correction

Contains:

- original proposal or target;
- correction;
- correcting actor;
- correction basis;
- source evidence;
- whether the original was unsafe, illegal, unsupported, ineffective, or merely suboptimal.

### 6.4 Abstention

Contains:

- bounded input;
- abstention code;
- uncertainty;
- missing evidence or blocked condition;
- evidence that abstention was preferable to unsupported action.

### 6.5 Retrieval grounding

Contains:

- bounded observation;
- included context identities;
- target proposal;
- cited evidence identities;
- omitted-context identities;
- grounding-validation result.

An example must fail when the target cites evidence not present in the included context.

### 6.6 Strategy routing

Contains:

- bounded observation features;
- applicable strategy candidates;
- selected strategy or abstention;
- applicability evidence;
- selection ordering;
- evaluator outcome.

---

## 7. Example contract

Every example candidate must include:

- example ID and version;
- example kind;
- domain and domain version;
- observation schema ID and version;
- target schema ID and version;
- construction policy ID and version;
- source record references;
- lineage-family ID;
- partition-group IDs;
- input;
- target or pair;
- acceptance and rejection labels;
- uncertainty;
- evidence references;
- contradiction references;
- protected-source references;
- teacher reference where applicable;
- reviewer status;
- partition assignment;
- quality-gate results;
- content digest;
- created-at value supplied by the caller.

All example records must be immutable.

No example may contain:

- provider credentials;
- hidden model reasoning;
- private chain-of-thought;
- unrestricted raw logs;
- mutable engine references;
- live runtime handles;
- executable code not separately authorized;
- unbounded memory dumps.

Concise rationale summaries are permitted only when they are source-grounded and explicitly distinguished from hidden reasoning.

---

## 8. Labels and negative evidence

The pipeline must preserve negative and uncertain evidence.

Required target labels:

```text
accepted
rejected
corrected
abstained
indeterminate
quarantined
```

Required rejection classes include:

```text
schema_invalid
illegal_proposal
unsupported_claim
ungrounded_reference
wrong_strategy
unsafe_recommendation
ineffective_outcome
contradicted
version_incompatible
policy_prohibited
review_missing
```

A rejected example may become:

- a dispreferred preference candidate;
- a correction source;
- an abstention example;
- a quarantine record;
- an evaluation-only case.

It must not silently become a supervised positive target.

---

## 9. Partitioning and contamination prevention

Partitioning must occur by groups, not individual rows.

Required grouping dimensions:

- domain;
- seed or incident identity;
- episode identity;
- episode family;
- source lineage family;
- engine or domain version;
- observation schema version;
- strategy lineage;
- teacher-output lineage;
- temporal boundary where applicable.

Required partitions:

```text
train
validation
test
quarantine
```

Rules:

1. A lineage family may appear in only one train, validation, or test partition.
2. A seed or incident identity may appear in only one train, validation, or test partition.
3. Derived siblings must remain together.
4. Test partition membership must be stable under input ordering.
5. Quarantined records may not influence train, validation, or test metrics.
6. Later-added descendants inherit the family partition unless governance explicitly creates a new versioned split.
7. Partition reassignment requires a new manifest version.
8. Test evidence may not influence target construction for training examples.
9. Version-transition evaluation cases may be held out as a dedicated test group.
10. Cross-domain transfer cases must remain separate from same-domain training examples.

The partitioner must be deterministic and locale-independent.

---

## 10. Duplicate and leakage audit

The pipeline must provide deterministic audits for:

- exact example duplicates;
- exact input duplicates with conflicting targets;
- structural duplicates;
- source-lineage overlap;
- seed overlap;
- episode-family overlap;
- teacher-output overlap;
- evaluation-target leakage;
- train/test evidence contamination;
- accepted/rejected target collision;
- version-boundary leakage.

Structural duplicate detection in KTS-I4-G must use explicit normalized fields and digests.

KTS-I4-G may not introduce:

- embeddings;
- vector databases;
- learned similarity;
- external search;
- provider calls.

Audit outcomes:

```text
pass
warning
fail
unknown
not_applicable
```

A blocking leakage failure prevents `validation_candidate` status.

---

## 11. Quality gates

Every example and dataset manifest must pass explicit quality gates.

Minimum gates:

- schema validity;
- digest integrity;
- source existence;
- source eligibility;
- lineage completeness;
- target support;
- legal proposal compatibility;
- grounding completeness;
- contradiction preservation;
- protected-evidence policy;
- consent and privacy status;
- reviewer requirement;
- partition validity;
- exact duplicate audit;
- structural duplicate audit;
- leakage audit;
- class-balance report;
- unresolved uncertainty report;
- version compatibility;
- deterministic reconstruction.

Gate classifications:

```text
pass
warning
fail
unknown
not_applicable
```

Blocking gates must be explicit and versioned.

No aggregate score may override a blocking failure.

---

## 12. Dataset manifest

A dataset manifest must include:

- dataset ID and version;
- domain scope;
- intended model role;
- intended training method compatibility;
- example counts by kind;
- counts by label;
- counts by partition;
- counts by domain and version;
- source-policy versions;
- partition-policy version;
- quality-policy version;
- curriculum-plan reference;
- distillation-plan reference where applicable;
- included example digests;
- excluded and quarantined counts;
- leakage-audit digest;
- quality-report digest;
- known limitations;
- reviewer status;
- manifest digest.

A manifest is a candidate record only.

It must not claim that the underlying data has been persisted or used for training.

---

## 13. Curriculum and sampling plans

KTS-I4-G may produce deterministic plans for later training.

Supported curriculum stages:

```text
schema_compliance
legal_proposals
grounded_proposals
abstention_and_uncertainty
strategy_routing
correction_and_failure_recovery
outcome_sensitive_advice
mixed_difficulty
```

A curriculum plan must identify:

- stage order;
- included example kinds;
- inclusion and exclusion rules;
- deterministic sampling weights;
- maximum examples per source family;
- protected-example handling;
- failure and correction coverage;
- validation checkpoints;
- known risks.

Sampling plans must:

- avoid silently oversampling one lineage family;
- preserve rare safety and correction cases;
- report class imbalance;
- remain deterministic;
- not modify the source dataset.

---

## 14. Distillation planning

KTS-I4-G supports **recorded-output distillation planning** only.

A distillation plan may pair:

- bounded student input;
- recorded teacher target;
- target schema;
- teacher identity and version;
- source evidence;
- reviewer status;
- confidence;
- rejection or correction status;
- partition;
- curriculum stage.

A distillation plan must reject:

- unreviewed teacher outputs when review is required;
- targets with missing source lineage;
- targets citing omitted evidence;
- hidden-reasoning fields;
- targets that fail the domain validator;
- teacher/student schema incompatibility;
- train/test leakage;
- protected evidence prohibited by policy.

The plan may describe compatible future methods:

```text
supervised_fine_tuning
lora
qlora
preference_optimization
teacher_student_distillation
```

This compatibility field does not authorize any method.

---

## 15. In-memory export drafts

The pipeline may produce bounded in-memory export drafts for review.

Supported logical formats:

```text
json
jsonl
manifest_only
```

An export draft must include:

- exact manifest identity;
- ordered example identities;
- serialized character count;
- segment count;
- per-segment digest;
- total digest;
- omitted and quarantined counts;
- format version.

Production code may not:

- access the filesystem;
- access object storage;
- access D1;
- upload data;
- write a file;
- open a network connection.

External operator tooling for a future authorized export requires a separate contract.

---

## 16. Keep the Signal adapter

The KTS adapter may construct candidates from accepted records including:

- KTS-I4-C bounded observations;
- KTS-I4-E validated proposals;
- KTS-I4-E abstentions;
- KTS-I4-E rejected proposals;
- deterministic rule-based adviser outputs;
- matched adviser evaluations;
- human corrections where explicitly supplied;
- accepted outcome evidence;
- KTS-I4-F consolidation validation reports.

The adapter must preserve:

- seed;
- episode or encounter identity;
- engine version;
- ruleset version;
- observation schema identity;
- proposal schema identity;
- strategy identity and version;
- adviser classification;
- proposal-validation result;
- evidence references;
- contradiction references;
- outcome metrics;
- evaluation classification.

The adapter must not invent:

- a better action;
- a preference;
- a correction;
- a human review;
- a teacher output;
- an outcome;
- an acceptance decision.

---

## 17. Initial KTS dataset tasks

The first reference compiler must support candidate datasets for:

1. tactical proposal schema compliance;
2. legal versus rejected proposal classification;
3. grounded tactical proposals;
4. uncertainty-safe abstention;
5. deterministic strategy selection;
6. accepted versus rejected proposal preferences;
7. human or evaluator correction;
8. outcome-sensitive adviser comparison.

KTS-I4-G does not require that every task produce a non-empty candidate dataset.

An empty result with explicit exclusion reasons is valid.

---

## 18. Failure taxonomy

Required public failure codes:

```text
invalid_training_source
invalid_source_identity
source_not_found
source_not_eligible
source_policy_prohibited
source_lineage_incomplete
source_digest_mismatch
invalid_training_example
invalid_example_identity
invalid_example_digest
example_identity_collision
unsupported_example_kind
invalid_target
target_not_supported
target_schema_incompatible
target_illegal
target_ungrounded
invalid_preference_pair
preference_not_established
invalid_correction
correction_not_supported
invalid_teacher_record
teacher_review_missing
teacher_schema_incompatible
hidden_reasoning_prohibited
invalid_partition_policy
partition_group_missing
partition_collision
partition_leakage
test_contamination
duplicate_example
conflicting_duplicate
structural_duplicate_blocked
invalid_quality_policy
quality_gate_failed
protected_evidence_prohibited
consent_status_unknown
privacy_status_unknown
review_required
invalid_curriculum_plan
invalid_sampling_plan
invalid_distillation_plan
invalid_dataset_manifest
invalid_export_draft
export_budget_exceeded
compiler_cancelled
compiler_disposed
compiler_internal_failure
```

Failures must use safe public messages and must not expose raw protected payloads.

---

## 19. Determinism and bounded computation

All production operations must be deterministic for equivalent inputs.

The implementation must not use:

- `Date.now`;
- `performance.now`;
- `Math.random`;
- `crypto.getRandomValues`;
- locale-sensitive ordering;
- environment-derived partition assignment;
- unstable object-key ordering.

Every operation must have explicit bounds for:

- selected source records;
- generated examples;
- source references per example;
- input characters;
- target characters;
- duplicate candidates;
- partition groups;
- manifest examples;
- curriculum stages;
- distillation records;
- export segments;
- total serialized characters.

Budget overflow must fail safely or produce explicit deterministic truncation according to the caller-supplied policy.

---

## 20. Scale and stress requirements

The implementation must test:

- 10,000 source records;
- 10,000 example candidates;
- 10,000 lineage-family assignments;
- 10,000 deterministic partition decisions;
- 10,000 duplicate-audit entries;
- 10,000 quality-gate decisions;
- 10,000 curriculum sampling decisions;
- 10,000 distillation-plan records;
- reduced budgets;
- zero-example datasets;
- mixed accepted, rejected, corrected, abstained, and quarantined examples;
- version transitions;
- conflicting duplicates;
- train/test leakage;
- repeated equivalent compilation;
- concurrent independent compilers.

Wall-clock thresholds are diagnostic only and may not determine acceptance.

---

## 21. Exact implementation boundary

The future implementation may create exactly these 37 paths.

### 21.1 Transferable training-evidence core

Directory:

```text
app/features/intelligence-harness/training-evidence/
```

Paths:

```text
failures.ts
source-contract.ts
training-example-contract.ts
training-example-builder.ts
target-contract.ts
dataset-contract.ts
partition-contract.ts
partitioner.ts
leakage-auditor.ts
duplicate-auditor.ts
quality-gates.ts
curriculum-contract.ts
curriculum-planner.ts
distillation-contract.ts
distillation-planner.ts
export-contract.ts
dataset-compiler.ts
dataset-metrics.ts
index.ts
```

### 21.2 Keep the Signal training adapter

Directory:

```text
app/features/keep-the-signal/training-evidence/
```

Paths:

```text
kts-example-contract.ts
kts-example-projector.ts
kts-preference-builder.ts
kts-correction-builder.ts
kts-partition-policy.ts
kts-distillation-plan.ts
index.ts
```

### 21.3 Focused tests

```text
test/intelligence-training-example-contract.test.ts
test/intelligence-training-example-builder.test.ts
test/intelligence-training-partitioner.test.ts
test/intelligence-training-leakage-auditor.test.ts
test/intelligence-training-quality-gates.test.ts
test/intelligence-training-curriculum.test.ts
test/intelligence-training-distillation.test.ts
test/intelligence-training-dataset-compiler.test.ts
test/keep-the-signal-training-evidence.test.ts
test/keep-the-signal-training-boundaries.test.ts
```

### 21.4 Result record

```text
docs/game/KTS-I4-G-TRAINING-EVIDENCE-DISTILLATION-PIPELINE-RESULT.md
```

No other repository path is authorized without a contract amendment.

---

## 22. Focused test requirement

The implementation must provide at least **320 substantive named focused tests** across the exact ten authorized focused test files.

The tests must cover:

- all public enum values;
- exact schemas;
- immutability;
- digest stability;
- safe failures;
- source eligibility;
- positive and negative targets;
- corrections and abstentions;
- grounding;
- preference evidence;
- deterministic grouping;
- partition stability;
- leakage blocking;
- duplicate handling;
- protected evidence;
- consent and privacy gates;
- curriculum planning;
- distillation planning;
- export budgets;
- 10,000-record scale cases;
- concurrency;
- static production boundaries;
- exact path boundaries.

Repeated generated assertions without distinct behavioural meaning do not count as substantive tests.

---

## 23. Production restrictions

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
```

They may not import:

- provider SDKs;
- model download tools;
- training frameworks;
- optimizer libraries;
- D1 repositories;
- object-storage clients;
- runtime, engine, presentation, player, route, or React modules;
- deployment or worker tooling.

They may not expose APIs named or equivalent to:

```text
train
fineTune
fit
optimize
backpropagate
uploadDataset
writeDataset
persistExample
promoteDataset
promoteModel
downloadModel
invokeTeacher
invokeStudent
deployAdapter
```

Schema compatibility strings describing future methods are permitted only as inert values.

---

## 24. Validation gates

Required validation:

```text
exact ten focused test files
at least 320 focused tests
complete repository test suite
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
accepted KTS-I4-B through KTS-I4-F boundary checks
protected hero stash verification
```

The result record must identify exact test totals and all known limitations.

---

## 25. Acceptance criteria

KTS-I4-G implementation may be accepted only when:

1. every example has traceable source lineage;
2. negative, corrected, abstained, and uncertain evidence remains explicit;
3. training and evaluation partitions are leakage-resistant;
4. partition assignment is deterministic;
5. test evidence cannot influence training targets;
6. protected evidence is policy-gated;
7. hidden reasoning is prohibited;
8. teacher records are already recorded and reviewable;
9. the pipeline performs no model invocation;
10. the pipeline performs no training or fine-tuning;
11. no dataset is persisted;
12. no accepted evidence or memory is changed;
13. no strategy, dataset, or model is promoted;
14. all scale cases pass;
15. all repository gates pass;
16. the exact path boundary is preserved;
17. the protected stash remains unchanged.

---

## 26. Decision statement

Acceptance of this contract means:

> The Construct may implement a deterministic, provenance-preserving training-evidence and distillation-planning pipeline that compiles reviewable dataset candidates from accepted evidence while preventing partition leakage, preserving negative and contradictory evidence, prohibiting hidden reasoning, and retaining human authority over training.

Acceptance does not authorize implementation.

The exact contract acceptance phrase is:

```text
ACCEPT KTS-I4-G CONTRACT
```

After the contract checkpoint is committed and verified, the separate implementation authorization phrase is:

```text
AUTHORIZE KTS-I4-G
```

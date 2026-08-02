# KTS-I4-K — Governed Demonstration Dataset Admission Contract

## 1. Contract metadata

- Document ID: `KTS-I4-K`
- Title: Governed Demonstration Dataset Admission
- Status: Proposed contract
- Repository: `m-indsRefuge/the-signal`
- Target branch: `game/keep-the-signal-i4-intelligence-harness`
- Required baseline: `156ae1acbc5c79c498de5bc7655987480ad19b0f`
- Required parent slice: accepted KTS-I4-J governed planner demonstration evidence
- Contract decision: pending explicit `ACCEPT KTS-I4-K CONTRACT`
- Implementation authorization: not granted by this document
- Dataset export authorization: not granted
- Model or training authorization: not granted

## 2. Purpose

KTS-I4-K defines the governed boundary by which immutable, reviewed KTS-I4-J
demonstration evidence may be evaluated for admission into a deterministic,
training-framework-independent dataset manifest.

The slice must distinguish:

- evidence existence;
- quarantine;
- review;
- eligibility evaluation;
- admission decision;
- normalized sample projection;
- partition assignment;
- leakage analysis;
- manifest construction;
- dataset export;
- model invocation;
- training;
- fine-tuning;
- promotion; and
- deployment.

No earlier step implies permission for a later step.

An admitted KTS-I4-K sample is an immutable dataset candidate. It is not an
exported file, a loaded training example, permission to invoke a model, or
permission to train.

## 3. Architectural position

```text
accepted KTS-I4-J evidence record
→ immutable review record
→ deterministic eligibility evaluation
→ explicit sample-role classification
→ immutable normalized sample candidate
→ exact and structural duplicate analysis
→ family-bound partition assignment
→ deterministic leakage analysis
→ immutable admission decision
→ immutable dataset manifest
→ future dataset-export contract
→ future immutable training plan
```

KTS-I4-K operates only on caller-supplied immutable evidence and review records.
It does not generate planner demonstrations and does not activate the planner.

## 4. Governing doctrine

The slice must enforce:

> Evidence may enter a dataset only through explicit, reconstructable,
> policy-versioned admission. Partition assignment must preserve family
> boundaries, and no admitted sample may silently become exported training data.

The admission system must prove:

- which evidence was evaluated;
- which review authorized further evaluation;
- which policy versions were applied;
- which sample role was assigned;
- why the record was admitted, rejected, deferred, or quarantined;
- how duplicate and leakage risks were resolved;
- which partition was assigned;
- which manifest contains the sample; and
- that export and training authority remain absent.

## 5. Scope

KTS-I4-K may implement only:

- immutable admission requests;
- immutable eligibility evaluations;
- versioned eligibility policies;
- explicit sample-role classifications;
- immutable normalized sample candidates;
- deterministic sample digests;
- exact and structural duplicate analysis;
- deterministic family identities;
- versioned partition policies;
- deterministic partition assignments;
- cross-partition leakage detection;
- immutable admission decisions;
- immutable audit records;
- immutable dataset manifests;
- deterministic manifest digests;
- bounded descriptive metrics;
- pure in-memory controllers;
- KTS-specific evidence adapters;
- synthetic deterministic fixtures used only by tests; and
- a final KTS-I4-K result record.

## 6. Explicit non-scope

KTS-I4-K must not:

- generate new planner demonstrations;
- activate the planner in gameplay;
- execute or enqueue game actions;
- mutate authoritative engine state;
- alter KTS-I4-J evidence or review records;
- automatically approve missing review;
- persist manifests or samples;
- write JSONL, CSV, Parquet, Arrow, database, archive, or model-ready files;
- upload, stream, or transmit dataset content;
- expose framework-specific dataset adapters;
- tokenize text;
- invoke a local or remote model;
- choose or download a model;
- train, fine-tune, distill, align, or evaluate model weights;
- create adapters, checkpoints, gradients, optimizer state, or trainer state;
- use wall-clock time, randomness, locale-sensitive ordering, or
  platform-dependent identity;
- read browser, route, UI, audio, network, storage, environment, secret, or
  deployment state;
- merge, push, deploy, or provision infrastructure.

## 7. Authoritative inputs

Every admission request must bind exact caller-supplied identities and digests for:

- domain ID and version;
- evidence schema ID and version;
- evidence record identity and digest;
- evidence outcome;
- evidence quality labels;
- evidence risk labels;
- review record identity and digest;
- reviewer identity;
- review decision;
- eligibility-policy ID and version;
- sample-role-policy ID and version;
- sample-schema ID and version;
- duplicate-policy ID and version;
- family-policy ID and version;
- partition-policy ID and version;
- leakage-policy ID and version;
- manifest-policy ID and version;
- caller-supplied admission-request identity;
- caller-supplied ISO-8601 request time when required; and
- explicit dataset-purpose identity.

The implementation must never invent missing authoritative identities, versions,
digests, timestamps, review decisions, purpose identities, or authorization.

## 8. Admission outcomes

The admission decision contract must support exactly:

- `admitted`
- `rejected`
- `deferred`
- `quarantined`
- `conflict`

`admitted` means only that the candidate satisfies the exact KTS-I4-K admission
policy for inclusion in an immutable in-memory manifest.

It does not mean:

- exported;
- training-ready;
- model-compatible;
- tokenized;
- optimal;
- safe beyond supplied evidence;
- representative;
- unbiased;
- sufficient for training; or
- authorized for model use.

## 9. Review requirement

Normal admission requires an immutable KTS-I4-J review record whose decision is:

```text
accepted_for_further_evaluation
```

The review record must match the evidence identity and digest exactly.

The following review states must never produce `admitted`:

- `rejected`
- `deferred`
- `needs_more_evidence`
- missing review
- mismatched evidence identity
- mismatched evidence digest
- unsupported review-policy version
- malformed review record

Admission must not mutate or replace the original evidence or review record.

## 10. Sample-role classifications

The initial transferable contract must support exactly these dataset sample roles:

- `accepted_demonstration`
- `rejected_proposal`
- `planner_abstention`
- `planner_budget_exhaustion`
- `planner_cancellation`
- `planner_rejection`
- `planner_failure`

Role assignment must derive deterministically from the KTS-I4-J evidence outcome,
validator decision, quality labels, risk labels, and review record.

A sample role describes evidence semantics. It does not prescribe a training loss,
model architecture, framework, or optimization objective.

## 11. Eligibility policy

The initial eligibility policy must independently evaluate:

- schema support;
- evidence digest integrity;
- review digest integrity;
- evidence-review binding;
- source-lineage completeness;
- legal-action-set binding;
- planner-result binding;
- proposal-projector binding when applicable;
- validator-result binding when applicable;
- deterministic reconstructability;
- declared truncation;
- blocking evidence risk;
- unsupported version;
- duplicate status;
- family identity availability;
- dataset-purpose compatibility;
- sample-role determinability; and
- caller-supplied policy compatibility.

Each evaluation must produce:

- one final eligibility state;
- exact ordered reason codes;
- exact ordered limitations;
- exact policy identities and versions; and
- a canonical evaluation digest.

Eligibility states must be:

- `eligible`
- `ineligible`
- `deferred`
- `unknown`

`unknown` must never be coerced to `eligible`.

## 12. Normalized sample candidate

An eligible record may be projected into an immutable normalized sample candidate
containing, at minimum:

- sample identity and digest;
- sample schema ID and version;
- dataset-purpose identity;
- evidence identity and digest;
- review identity and digest;
- sample role;
- domain and version;
- scenario-family identity;
- episode-family identity when present;
- duplicate-family identity;
- partition-family identity;
- seed identity;
- observation identity and digest;
- canonical observation projection;
- canonical legal-action-set projection;
- planner-request identity and digest;
- planner-result identity and digest;
- selected plan or explicit non-plan outcome;
- projected proposal when applicable;
- validator decision and reasons when applicable;
- exact quality labels;
- exact risk labels;
- explicit limitations;
- reconstruction status;
- admission-policy identities and versions;
- `exportAuthorization: "absent"`;
- `trainingAuthorization: "absent"`; and
- `frameworkBinding: "none"`.

Every returned sample and nested collection must be deeply immutable and isolated
from caller mutation.

## 13. Duplicate policy

Duplicate analysis must distinguish exactly:

- `unique`
- `exact_duplicate`
- `structural_duplicate`
- `conflicting_duplicate`

An exact duplicate must be idempotently recognized and may appear only once in a
manifest.

A structural duplicate may be retained only when:

- its distinct evidence identity is preserved;
- its duplicate-family identity is explicit;
- its partition-family identity is shared with all related samples;
- the partition policy keeps the full family in one partition; and
- the manifest reports the family cardinality.

A conflicting duplicate must produce an admission outcome of `conflict`.

Approximate semantic similarity, embeddings, model judgments, and fuzzy matching
are out of scope.

## 14. Family identity

The implementation must compute or validate deterministic family identities for:

- scenario family;
- episode family when applicable;
- duplicate family;
- partition family; and
- provenance family.

Partition-family identity must conservatively bind all samples that could leak
substantially shared scenario, seed, trajectory, observation, proposal, or
lineage information across partitions.

Missing or ambiguous family identity must produce `deferred` or `unknown`, never
silent assignment.

## 15. Dataset partitions

The initial partition contract must support exactly:

- `train`
- `validation`
- `test`
- `holdout`

Partition assignment must be:

- deterministic;
- policy-versioned;
- family-bound;
- seed-independent after family identity is established;
- order-independent;
- reconstructable;
- stable for the same policy and input family;
- bounded;
- free from wall-clock time and randomness; and
- independent of model or framework selection.

The partition policy must expose explicit integer allocation weights whose sum is
exactly 10,000 basis points.

No sample may appear in more than one partition within one manifest.

## 16. Leakage controls

The initial leakage detector must report independently:

- exact sample overlap;
- evidence identity overlap;
- review identity overlap;
- scenario-family overlap;
- episode-family overlap;
- duplicate-family overlap;
- partition-family overlap;
- observation digest overlap;
- legal-action-set digest overlap;
- planner-request digest overlap;
- planner-result digest overlap;
- proposal digest overlap;
- validator-result digest overlap;
- provenance-family overlap; and
- unsupported or unknown comparison.

Leakage results must be:

- `clear`
- `blocked`
- `unknown`

Any partition-family overlap across partitions must produce `blocked`.

Any unsupported comparison must produce `unknown`, never `clear`.

## 17. Admission decision

Every admission decision must preserve:

- admission-decision identity;
- admission-request identity and digest;
- evidence identity and digest;
- review identity and digest;
- eligibility result and digest;
- sample-role result;
- duplicate result;
- family identities;
- proposed partition;
- leakage result;
- final admission outcome;
- exact ordered reason codes;
- exact ordered limitations;
- all applied policy identities and versions;
- caller-supplied decision time when required;
- canonical decision digest;
- `exportAuthorization: "absent"`; and
- `trainingAuthorization: "absent"`.

Admission decisions are append-only immutable records. They must not mutate source
evidence, reviews, samples, or prior decisions.

## 18. Manifest contract

An immutable dataset manifest must contain:

- manifest identity and digest;
- manifest schema ID and version;
- dataset-purpose identity;
- domain ID and compatible version set;
- exact policy identities and versions;
- canonical partition weights;
- admitted sample identities and digests;
- sample-role counts;
- partition counts;
- family counts;
- duplicate counts;
- leakage summary;
- rejected, deferred, quarantined, and conflict counts;
- exact bounded admission-decision references;
- exact limitations;
- deterministic construction metrics;
- `persistence: "none"`;
- `exportAuthorization: "absent"`;
- `trainingAuthorization: "absent"`;
- `frameworkBinding: "none"`; and
- `tokenization: "not_performed"`.

Manifest construction must be deterministic and order-independent.

A manifest may contain only `admitted` samples with leakage result `clear`.

## 19. Audit contract

The audit layer must preserve deterministic records for:

- eligibility evaluation;
- role assignment;
- duplicate classification;
- family assignment;
- partition assignment;
- leakage evaluation;
- admission decision;
- manifest inclusion or exclusion; and
- bounded truncation.

Audit records must be immutable, canonical, and independently digestible.

The audit layer must not read logs, environment data, system time, or external
telemetry.

## 20. Metrics

KTS-I4-K metrics may report only bounded descriptive facts:

- admission-request count;
- eligibility-state counts;
- sample-role counts;
- duplicate-status counts;
- admission-outcome counts;
- partition counts;
- family counts;
- leakage-result counts;
- manifest sample count;
- rejected, deferred, quarantined, and conflict counts;
- truncation counts;
- serialized character counts; and
- deterministic failure counts.

Metrics must not claim model quality, training readiness, expected reward,
generalization, fairness, safety, representativeness, or production suitability.

## 21. Hard budgets

The implementation must enforce these absolute maxima:

- Admission requests per controller call: 10,000
- Admission decisions retained in one controller: 10,000
- Samples retained in one manifest: 10,000
- Manifests retained in one controller: 64
- Policy reason codes per evaluation: 64
- Limitations per evaluation or decision: 64
- Quality labels per sample: 64
- Risk labels per sample: 64
- Family identities per sample: 16
- Duplicate-family members returned: 10,000
- Leakage findings per comparison: 64
- Audit records per decision: 64
- Returned decisions per list operation: 10,000
- Returned samples per list operation: 10,000
- Serialized characters per sample: 262,144
- Serialized characters per decision: 131,072
- Serialized characters per manifest: 16,777,216
- Serialized characters per controller snapshot: 16,777,216

All numeric budgets and partition weights must be safe integers and validated
before allocation or serialization.

## 22. Failure taxonomy

The transferable implementation must expose deterministic failures for:

- invalid request shape;
- unsupported schema;
- missing identity or version;
- malformed caller-supplied timestamp;
- evidence digest mismatch;
- review digest mismatch;
- evidence-review binding mismatch;
- unsupported review decision;
- unsupported policy version;
- indeterminate sample role;
- sample projection mismatch;
- sample digest mismatch;
- duplicate identity conflict;
- ambiguous family identity;
- partition-policy mismatch;
- invalid partition weights;
- cross-partition leakage;
- unknown leakage comparison;
- decision digest mismatch;
- manifest digest mismatch;
- record-count budget exceeded;
- serialized-size budget exceeded;
- cancellation;
- controller disposed;
- prohibited export request;
- prohibited persistence request; and
- prohibited training request.

Failures must contain no environment-derived data.

## 23. Controller boundaries

Controllers may coordinate only caller-supplied immutable records and pure
deterministic policies.

They may retain bounded in-memory state explicitly permitted by this contract.

Controllers must:

- expose no persistence method;
- expose no exporter;
- expose no tokenizer;
- expose no model or trainer method;
- expose no action-execution method;
- expose no live-game activation method;
- expose no autonomous collection loop;
- support deterministic cancellation where applicable;
- dispose idempotently; and
- reject commands after disposal.

## 24. Static prohibited-capability boundary

Production modules and tests must prove the absence of:

- `fetch`, `XMLHttpRequest`, WebSocket, EventSource, and network clients;
- filesystem reads or writes;
- D1, R2, KV, cache, database, and storage clients;
- `process.env` and secret access;
- wall-clock time, timers, and schedulers;
- `Math.random`, crypto randomness, UUID generation, and nondeterministic identity;
- locale-sensitive comparison;
- dynamic import of external capabilities;
- model SDKs, inference APIs, tokenizers, trainers, adapters, and checkpoint code;
- JSONL, CSV, Parquet, Arrow, archive, or framework dataset exporters;
- route, UI, audio, renderer, browser-runtime, and deployment imports;
- live authoritative-engine mutation;
- action dispatch or queueing; and
- production activation code.

## 25. Exact implementation boundary

No existing path may be modified.

Implementation, once separately authorized, is limited to exactly 47 new paths.

### 25.1 Transferable dataset-admission modules — 25 paths

`app/features/intelligence-harness/dataset-admission/`

1. `failures.ts`
2. `admission-contract.ts`
3. `admission-request.ts`
4. `evidence-eligibility.ts`
5. `eligibility-policy.ts`
6. `sample-role.ts`
7. `sample-contract.ts`
8. `sample-projector.ts`
9. `sample-digest.ts`
10. `family-identity.ts`
11. `deduplication-policy.ts`
12. `partition-contract.ts`
13. `partition-policy.ts`
14. `partition-assignment.ts`
15. `leakage-contract.ts`
16. `leakage-detector.ts`
17. `admission-decision.ts`
18. `decision-digest.ts`
19. `manifest-contract.ts`
20. `manifest-builder.ts`
21. `manifest-digest.ts`
22. `admission-metrics.ts`
23. `admission-controller.ts`
24. `audit-contract.ts`
25. `index.ts`

### 25.2 KTS-specific dataset-admission adapters — 7 paths

`app/features/keep-the-signal/dataset-admission/`

26. `kts-admission-source.ts`
27. `kts-sample-role-policy.ts`
28. `kts-sample-projector.ts`
29. `kts-partition-family.ts`
30. `kts-leakage-policy.ts`
31. `kts-admission-controller.ts`
32. `index.ts`

### 25.3 Focused tests — 14 paths

33. `test/intelligence-dataset-admission-contract.test.ts`
34. `test/intelligence-dataset-admission-eligibility.test.ts`
35. `test/intelligence-dataset-admission-samples.test.ts`
36. `test/intelligence-dataset-admission-roles.test.ts`
37. `test/intelligence-dataset-admission-duplicates.test.ts`
38. `test/intelligence-dataset-admission-partitions.test.ts`
39. `test/intelligence-dataset-admission-leakage.test.ts`
40. `test/intelligence-dataset-admission-decisions.test.ts`
41. `test/intelligence-dataset-admission-manifests.test.ts`
42. `test/intelligence-dataset-admission-metrics.test.ts`
43. `test/intelligence-dataset-admission-controller.test.ts`
44. `test/intelligence-dataset-admission-scale.test.ts`
45. `test/keep-the-signal-dataset-admission-adapter.test.ts`
46. `test/keep-the-signal-dataset-admission-boundaries.test.ts`

### 25.4 Result record — 1 path

47. `docs/game/KTS-I4-K-GOVERNED-DEMONSTRATION-DATASET-ADMISSION-RESULT.md`

## 26. Required focused validation

The implementation must provide at least 720 focused tests across the 14 exact
test paths.

Focused validation must prove:

- every schema, enum, state, role, and partition;
- deep immutability and defensive cloning;
- canonical identity and digest behavior;
- exact evidence-review binding;
- every eligibility result;
- every admission outcome;
- every sample role;
- exact and structural duplicate handling;
- conflicting duplicate rejection;
- family identity stability;
- deterministic partition weights and assignment;
- order-independent manifest construction;
- all leakage checks;
- blocked and unknown leakage behavior;
- manifest inclusion and exclusion;
- immutable audit records;
- hard-budget enforcement;
- cancellation and controller disposal;
- 10,000-record bounded scale cases;
- locale-independent ordering;
- no mutation of accepted KTS-I4-J values;
- no planner activation or demonstration generation;
- no persistence, export, tokenization, model, trainer, runtime, UI, route, audio,
  browser, deployment, or network capability; and
- exact 47-path implementation scope.

## 27. Repository acceptance gates

Before implementation acceptance, all of the following must pass:

1. Exact branch and exact accepted parent checkpoint.
2. Exact 47-path implementation boundary.
3. No modification to existing paths.
4. Minimum focused test count met.
5. Complete repository tests.
6. Type checking.
7. Client and SSR builds.
8. Lint.
9. Prettier format check.
10. Git diff check.
11. Explicit trailing-whitespace scan.
12. Static prohibited-capability scans.
13. Clean exact-path staging.
14. Exact implementation commit with the contract checkpoint as direct parent.
15. Formal operator acceptance bound to the exact implementation commit SHA.
16. Separate authorization before push.
17. No merge before the complete KTS-I4 closure gate.

## 28. Result-record requirements

The final result record must state:

- exact contract checkpoint;
- exact implementation checkpoint;
- exact parent;
- exact 47 paths;
- focused and repository test totals;
- type, build, lint, format, diff, whitespace, and prohibited-scan outcomes;
- all implementation repairs;
- deterministic fixtures used by tests;
- hard-budget evidence;
- duplicate, family, partition, and leakage evidence;
- all unresolved limitations;
- confirmation that no planner activation occurred;
- confirmation that no production demonstrations were generated;
- confirmation that no persistent dataset store was created;
- confirmation that no dataset was exported;
- confirmation that no model was invoked;
- confirmation that no training or fine-tuning occurred;
- confirmation that no push, merge, or deployment occurred before authorization;
  and
- the protected stash state.

## 29. Deferred work

The following remain deferred:

- production demonstration-generation authorization;
- persistent evidence or dataset storage;
- dataset export;
- training-framework adapters;
- tokenization;
- immutable dataset artifact publication;
- base-model selection;
- hardware and framework selection;
- immutable KTS-I4-H training plan;
- model invocation;
- training or fine-tuning;
- adapter or checkpoint creation;
- model evaluation;
- promotion;
- deployment; and
- complete KTS-I4 closure and merge.

## 30. Contract decision

Acceptance must be explicit:

```text
ACCEPT KTS-I4-K CONTRACT
```

Implementation authorization must be explicit and separate:

```text
AUTHORIZE KTS-I4-K
```

Until both decisions exist and the accepted contract checkpoint is verified,
implementation must not begin.

Even after implementation acceptance, dataset export, persistence, model
invocation, training, fine-tuning, push, merge, and deployment remain separately
controlled.

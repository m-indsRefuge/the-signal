# KTS-I4-J — Governed Planner Demonstration Evidence Contract

## 1. Contract metadata

| Field                            | Value                                          |
| -------------------------------- | ---------------------------------------------- |
| Document ID                      | KTS-I4-J                                       |
| Title                            | Governed Planner Demonstration Evidence        |
| Status                           | Proposed contract                              |
| Repository                       | `m-indsRefuge/the-signal`                      |
| Target branch                    | `game/keep-the-signal-i4-intelligence-harness` |
| Required baseline                | `5aa41a1f1d3dfc8cd1dcf548987998376d0a80c1`     |
| Required parent slice            | Accepted KTS-I4-I bounded planning strategist  |
| Contract decision                | Pending explicit `ACCEPT KTS-I4-J CONTRACT`    |
| Implementation authorization     | Not granted by this document                   |
| Runtime generation authorization | Not granted                                    |
| Dataset admission authorization  | Not granted                                    |
| Model or training authorization  | Not granted                                    |

## 2. Purpose

KTS-I4-J defines the first governed evidence layer that may represent the output of
the accepted deterministic KTS-I4-I planner as immutable, bounded, reconstructable
demonstration evidence.

The slice exists to preserve exact provenance between:

1. an accepted deterministic scenario and observation;
2. the legal-action set supplied to the planner;
3. the planner request and bounded search execution;
4. the selected plan or explicit non-plan outcome;
5. the projected tactical proposal;
6. the existing deterministic proposal-validator decision;
7. the resulting evidence classification;
8. later human review records; and
9. any future, separately authorized dataset-admission decision.

A KTS-I4-J evidence record is not a training example, not a dataset row, not
permission to export data, and not permission to train or invoke a model.

## 3. Architectural position

```text
accepted deterministic scenario
→ immutable planning observation
→ accepted KTS-I4-I bounded planner
→ ranked plan or explicit abstention/failure outcome
→ KTS tactical proposal projection
→ existing deterministic proposal validation
→ immutable KTS-I4-J demonstration evidence
→ bounded quarantine collection
→ explicit review record
→ future dataset-admission contract
```

The planner remains advisory. The evidence layer observes and records governed
results; it does not execute actions, advance the live engine, or activate the
planner in production.

## 4. Governing doctrine

The slice must enforce the following doctrine:

> The planner may propose strategy. The governed system must prove the source,
> legality, validation outcome, lineage, and reproducibility of every recorded
> demonstration before any later system may consider it for training.

The evidence layer must preserve the strict distinction among:

- planner output;
- validator output;
- evidence generation;
- quarantine;
- human review;
- dataset admission;
- dataset export;
- model inference;
- training;
- fine-tuning;
- promotion; and
- deployment.

No earlier step implies authorization for a later step.

## 5. Scope

KTS-I4-J may implement only:

- immutable demonstration-source records;
- immutable planner-result evidence;
- immutable selected-plan lineage;
- immutable projected-proposal evidence;
- immutable proposal-validator evidence;
- explicit evidence-outcome classifications;
- deterministic evidence digests;
- deterministic reconstruction checks;
- derived quality and risk classifications;
- duplicate and conflicting-duplicate detection;
- bounded in-memory quarantine;
- immutable operator-supplied review records;
- deterministic batch construction;
- bounded evidence metrics;
- KTS-specific adapters for accepted KTS observations, planner results, proposal
  projection, and validator results;
- pure controllers with explicit disposal;
- synthetic deterministic fixtures used only by tests; and
- a final KTS-I4-J result record.

## 6. Explicit non-scope

KTS-I4-J must not:

- activate the planner in live gameplay;
- execute or enqueue any game action;
- mutate authoritative engine state;
- bypass or replace proposal validation;
- create a production event listener or autonomous collector;
- read browser, route, UI, audio, network, storage, environment, or deployment state;
- persist records to D1, R2, KV, SQLite, IndexedDB, filesystem, cache, or remote service;
- export JSONL, Parquet, CSV, Arrow, database dumps, or training-framework datasets;
- admit evidence into train, validation, test, preference, or distillation partitions;
- invoke a local or remote model;
- select, download, load, evaluate, train, or fine-tune a model;
- create adapters, checkpoints, weights, gradients, optimizer state, or trainer state;
- generate production demonstrations without a later explicit authorization;
- use wall-clock time, `Date.now`, random values, locale-sensitive ordering, or
  platform-dependent identity;
- silently label an example as correct, useful, safe, or training-eligible; or
- merge, push, deploy, or provision infrastructure.

## 7. Authoritative inputs

Every demonstration-evidence request must receive immutable caller-supplied inputs
containing exact identities and digests for:

- domain ID and domain version;
- engine version;
- ruleset version;
- observation schema ID and version;
- observation level;
- scenario or episode family identity;
- partition-family identity placeholder;
- deterministic seed identity;
- authoritative observation identity and digest;
- canonical legal-action-set identity and digest;
- planner contract ID and version;
- planner implementation identity;
- planner request digest;
- planner result digest;
- simulation contract ID and version;
- scoring-policy ID and version;
- risk-policy ID and version;
- tie-break-policy ID and version;
- proposal-projector ID and version;
- proposal-validator ID and version;
- caller-supplied recording identity; and
- caller-supplied ISO-8601 recording time, when required.

The implementation must never invent missing authoritative identity, version,
digest, timestamp, review, or authorization values.

## 8. Evidence outcome classifications

The transferable evidence contract must support exactly these planner evidence
outcomes:

- `proposal_accepted`
- `proposal_rejected`
- `planner_abstained`
- `planner_budget_exhausted`
- `planner_cancelled`
- `planner_rejected`
- `planner_failed`

`proposal_accepted` means only that the existing deterministic proposal validator
accepted the projected proposal. It does not mean the proposal was executed,
successful, useful, optimal, reviewed, or training-eligible.

`proposal_rejected` must preserve the validator's exact rejection reasons.

Non-plan outcomes must preserve the planner's explicit status, reasons, budget
usage, and reconstructability evidence without fabricating a proposal target.

## 9. Immutable demonstration evidence record

Each evidence record must contain, at minimum:

- stable evidence record identity;
- evidence schema ID and version;
- evidence outcome;
- complete source-lineage block;
- observation identity and digest;
- legal-action-set identity and digest;
- planner request identity and digest;
- planner result identity and digest;
- planner status;
- planner budget limits and actual usage;
- selected-plan evidence when a selected plan exists;
- selected action sequence and exact ordering;
- complete selected-candidate lineage;
- explicit score components;
- explicit risk flags;
- explanation references;
- projected proposal identity, canonical content, and digest when applicable;
- deterministic proposal-validator identity, version, decision, reasons, and digest;
- reconstruction-policy identity and version;
- derived quality classifications;
- derived risk classifications;
- explicit limitations;
- duplicate-family identity;
- partition-family identity placeholder;
- caller-supplied recording metadata;
- canonical record digest; and
- `trainingAdmission: "not_evaluated"`.

Every returned record and nested collection must be deeply immutable and isolated
from later caller mutation.

## 10. Selected-plan evidence

When the planner returns a selected plan, evidence must preserve:

- plan identity and digest;
- rank;
- total score;
- every score component and bounded value;
- every risk flag;
- every explanation reference;
- action count;
- ordered action identities;
- parent candidate identity for each retained lineage step;
- candidate depth;
- simulation-result identity and digest for each retained lineage step;
- terminal classification;
- future-option value when present;
- tie-break values used to establish rank; and
- any truncation or omission marker.

The evidence layer may preserve only the bounded selected plan and the planner's
already bounded returned alternatives. It must not rerun search to create extra
alternatives.

## 11. Deterministic proposal-validation evidence

For a projected proposal, the evidence layer must record:

- the exact proposal schema ID and version;
- canonical proposal content;
- proposal digest;
- validator contract ID and version;
- validator implementation identity;
- validator decision;
- exact ordered validation reasons;
- exact ordered unsupported references;
- exact ordered legality findings;
- exact ordered risk findings;
- validator-result digest; and
- an explicit `actionExecuted: false` marker.

The evidence layer must reject any request that claims a proposal was accepted
without a supplied validator result whose identity, digest, and proposal digest
match exactly.

## 12. Quality classifications

Quality labels must be deterministic, explicit, versioned, and derived only from
supplied evidence. The initial quality policy must support:

- `schema_complete`
- `lineage_complete`
- `legal_action_set_bound`
- `planner_result_bound`
- `proposal_projection_bound`
- `validator_result_bound`
- `deterministically_reconstructable`
- `bounded_without_truncation`
- `bounded_with_declared_truncation`
- `human_review_missing`
- `outcome_evidence_missing`
- `quality_unknown`

Quality labels must not claim:

- gameplay success;
- human usefulness;
- optimality;
- policy superiority;
- safety beyond the validator's explicit decision;
- correctness beyond structural and deterministic checks; or
- training eligibility.

Those claims require later authoritative outcome evidence or human review.

## 13. Risk classifications

The initial evidence-risk policy must support:

- `none_observed`
- `validator_rejected`
- `blocking_planner_risk`
- `lineage_mismatch`
- `digest_mismatch`
- `version_mismatch`
- `unreconstructable`
- `budget_truncated`
- `duplicate`
- `conflicting_duplicate`
- `review_required`
- `risk_unknown`

A record containing any blocking integrity mismatch must be rejected from normal
quarantine and returned as a failed evidence-generation result.

## 14. Duplicate and conflict handling

Duplicate analysis must use canonical identities and digests, not approximate text
similarity.

The duplicate contract must distinguish:

- `unique`
- `exact_duplicate`
- `structural_duplicate`
- `conflicting_duplicate`

An exact duplicate may be idempotently recognized but must not increase quarantine
record count.

A structural duplicate may be retained only with explicit family linkage and must
remain independently addressable.

A conflicting duplicate must be rejected from ordinary quarantine and represented
by an immutable conflict result preserving both identities and digests.

Input ordering must not affect duplicate classification or returned ordering.

## 15. Quarantine contract

The initial quarantine mechanism must be bounded and in-memory only.

Every newly generated evidence record begins with:

```text
quarantineState: quarantined
trainingAdmission: not_evaluated
exportAuthorization: absent
```

The quarantine ledger may:

- register an immutable record;
- recognize an exact idempotent duplicate;
- reject conflicting identity reuse;
- retrieve an independent immutable clone by exact identity;
- list records in canonical identity order;
- report bounded truncation;
- produce an immutable snapshot;
- register immutable review records separately; and
- dispose all private in-memory state.

The quarantine ledger must not persist, export, upload, stream, or automatically
forward records.

## 16. Review contract

Human or operator review must be represented by a new immutable review record.
Review must never mutate or replace the original evidence record.

Review decisions must support:

- `accepted_for_further_evaluation`
- `rejected`
- `deferred`
- `needs_more_evidence`

Each review record must contain:

- review identity;
- evidence record identity and digest;
- reviewer identity supplied by the caller;
- decision;
- ordered reason codes;
- bounded rationale references;
- caller-supplied review time;
- review-policy ID and version;
- limitations;
- canonical review digest; and
- `datasetAdmission: "not_performed"`.

`accepted_for_further_evaluation` is not dataset admission and must not be named or
treated as dataset acceptance.

## 17. Reconstruction contract

A reconstruction request must bind:

- the original evidence record;
- exact authoritative observation;
- exact legal action set;
- exact planner request;
- exact planner, simulator, score, risk, and tie-break versions;
- exact proposal projector;
- exact proposal validator; and
- explicit reconstruction budgets.

A reconstruction result must report independently:

- source identity match;
- observation digest match;
- legal-action-set digest match;
- planner request digest match;
- planner result digest match;
- selected-plan digest match;
- projected-proposal digest match;
- validator-result digest match;
- evidence-record digest match;
- overall result: `pass`, `fail`, or `unknown`; and
- exact ordered mismatch reasons.

Unknown or unavailable dependencies must produce `unknown`, never an invented pass.

## 18. Batch contract

A demonstration-evidence batch must:

- contain records from one explicit domain and compatible version set;
- preserve scenario-family identities;
- preserve partition-family identities without assigning a partition;
- order records canonically;
- deduplicate exact duplicates;
- preserve structural duplicates with explicit linkage;
- reject conflicting duplicates;
- report record-count and serialized-size truncation;
- include a stable batch digest;
- include exact policy identities and versions;
- include metrics derived only from contained records; and
- retain `datasetAdmission: "not_performed"`.

A batch must not expose an exporter or training-framework adapter.

## 19. Metrics

KTS-I4-J metrics may report only bounded descriptive evidence facts, including:

- request count;
- generated record count;
- exact duplicate count;
- structural duplicate count;
- conflicting duplicate count;
- planner-outcome counts;
- validator-decision counts;
- reconstruction pass, fail, and unknown counts;
- quality-label counts;
- risk-label counts;
- quarantined record count;
- reviewed record count;
- review-decision counts;
- truncated record count;
- serialized character count; and
- generation-failure counts.

Metrics must not report invented success rates, reward, utility, model quality, or
training readiness.

## 20. Hard budgets

The implementation must enforce these absolute maxima:

| Budget                                        |    Maximum |
| --------------------------------------------- | ---------: |
| Evidence records per batch                    |     10,000 |
| Records retained in one quarantine ledger     |     10,000 |
| Review records retained in one ledger         |     10,000 |
| Returned records per list operation           |     10,000 |
| Source-lineage references per record          |         64 |
| Selected plan actions                         |          8 |
| Returned alternative plans preserved          |         16 |
| Score components per plan                     |         64 |
| Risk flags per plan                           |         64 |
| Explanation references per plan               |         64 |
| Validator reasons per record                  |         64 |
| Unsupported references per record             |         64 |
| Quality labels per record                     |         64 |
| Evidence risk labels per record               |         64 |
| Limitations per record                        |         64 |
| Review reason codes                           |         64 |
| Review rationale references                   |         64 |
| Duplicate family members returned             |     10,000 |
| Reconstruction mismatch reasons               |         64 |
| Serialized characters per evidence record     |    262,144 |
| Serialized characters per review record       |     65,536 |
| Serialized characters per batch               | 16,777,216 |
| Serialized characters per quarantine snapshot | 16,777,216 |

Budgets must be validated as positive safe integers and enforced before unbounded
allocation or serialization.

## 21. Failure taxonomy

The transferable implementation must expose explicit failures for:

- invalid request shape;
- invalid or unsupported schema;
- missing identity or version;
- non-canonical identity;
- malformed caller-supplied timestamp;
- observation digest mismatch;
- legal-action-set digest mismatch;
- planner request mismatch;
- planner result mismatch;
- selected-plan lineage mismatch;
- proposal projection mismatch;
- validator result mismatch;
- evidence digest mismatch;
- duplicate identity conflict;
- unsupported review transition claim;
- reconstruction unavailable;
- reconstruction mismatch;
- record-count budget exceeded;
- serialized-size budget exceeded;
- cancellation;
- controller disposed; and
- prohibited admission or export request.

Failures must be deterministic and contain no environment-derived data.

## 22. Controller boundaries

Controllers must be pure coordinators over caller-supplied ports and immutable
records.

They may retain only bounded in-memory state explicitly permitted by the quarantine
contract.

Controllers must:

- expose no action-execution method;
- expose no live-game activation method;
- expose no autonomous collection loop;
- expose no persistence or export method;
- expose no dataset-admission method;
- expose no model or trainer method;
- support deterministic cancellation where applicable;
- dispose idempotently; and
- reject commands after disposal.

## 23. Static prohibited-capability boundary

Production modules and tests must prove the absence of:

- `fetch`, `XMLHttpRequest`, WebSocket, EventSource, and network clients;
- filesystem writes or reads;
- database, D1, R2, KV, cache, and storage clients;
- `process.env` and secret access;
- `Date.now`, `new Date()` without caller input, timers, and schedulers;
- `Math.random`, crypto randomness, UUID generation, and nondeterministic identity;
- locale-sensitive comparison;
- dynamic import of external capabilities;
- model SDKs, inference APIs, tokenizers, trainers, adapters, and checkpoint code;
- JSONL, CSV, Parquet, Arrow, or training-data exporters;
- route, UI, audio, renderer, browser-runtime, and deployment imports;
- live authoritative-engine mutation;
- action dispatch or queueing; and
- production activation code.

## 24. Exact implementation boundary

No existing path may be modified.

Implementation, once separately authorized, is limited to exactly these 43 new
paths.

### 24.1 Transferable demonstration-evidence modules — 23 paths

`app/features/intelligence-harness/demonstrations/`

1. `failures.ts`
2. `demonstration-contract.ts`
3. `source-lineage.ts`
4. `evidence-input.ts`
5. `evidence-target.ts`
6. `evidence-record.ts`
7. `evidence-digest.ts`
8. `quality-policy.ts`
9. `risk-classification.ts`
10. `reconstruction-contract.ts`
11. `reconstruction-evaluator.ts`
12. `duplicate-contract.ts`
13. `duplicate-detector.ts`
14. `quarantine-contract.ts`
15. `quarantine-ledger.ts`
16. `review-contract.ts`
17. `review-record.ts`
18. `admission-boundary.ts`
19. `batch-contract.ts`
20. `batch-builder.ts`
21. `evidence-metrics.ts`
22. `evidence-controller.ts`
23. `index.ts`

### 24.2 KTS-specific demonstration adapters — 7 paths

`app/features/keep-the-signal/demonstrations/`

24. `kts-demonstration-source.ts`
25. `kts-plan-evidence-projector.ts`
26. `kts-validator-evidence.ts`
27. `kts-quality-policy.ts`
28. `kts-reconstruction-adapter.ts`
29. `kts-demonstration-controller.ts`
30. `index.ts`

### 24.3 Focused tests — 12 paths

31. `test/intelligence-demonstration-contract.test.ts`
32. `test/intelligence-demonstration-lineage.test.ts`
33. `test/intelligence-demonstration-records.test.ts`
34. `test/intelligence-demonstration-quality.test.ts`
35. `test/intelligence-demonstration-reconstruction.test.ts`
36. `test/intelligence-demonstration-duplicates.test.ts`
37. `test/intelligence-demonstration-quarantine.test.ts`
38. `test/intelligence-demonstration-review.test.ts`
39. `test/intelligence-demonstration-batches.test.ts`
40. `test/intelligence-demonstration-controller.test.ts`
41. `test/keep-the-signal-demonstration-adapter.test.ts`
42. `test/keep-the-signal-demonstration-boundaries.test.ts`

### 24.4 Result record — 1 path

43. `docs/game/KTS-I4-J-GOVERNED-PLANNER-DEMONSTRATION-EVIDENCE-RESULT.md`

## 25. Required focused validation

The implementation must provide at least 540 focused tests across the 12 exact
test paths.

Focused validation must prove:

- every schema and enum value;
- deep immutability and defensive cloning;
- canonical identity and digest behavior;
- complete planner and validator lineage;
- every evidence outcome;
- every quality and risk classification;
- accepted and rejected proposal evidence;
- abstention, budget, cancellation, rejection, and failure evidence;
- exact duplicate idempotence;
- structural duplicate preservation;
- conflicting duplicate rejection;
- bounded quarantine behavior;
- review immutability and separation;
- reconstruction pass, fail, and unknown outcomes;
- batch determinism and bounds;
- controller cancellation and disposal;
- 10,000-record bounded scale cases;
- locale-independent ordering;
- no mutation of accepted KTS-I4-I source values;
- no action execution;
- no persistence, export, dataset admission, model, trainer, runtime, UI, route,
  audio, browser, deployment, or network capability; and
- exact 43-path implementation scope.

## 26. Repository acceptance gates

Before implementation acceptance, all of the following must pass:

1. Exact branch and exact accepted parent checkpoint.
2. Exact 43-path implementation boundary.
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

## 27. Result-record requirements

The final result record must state:

- exact contract checkpoint;
- exact implementation checkpoint;
- exact parent;
- exact 43 paths;
- focused and repository test totals;
- type, build, lint, format, diff, whitespace, and prohibited-scan outcomes;
- all implementation repairs;
- deterministic evidence fixtures used by tests;
- hard-budget evidence;
- duplicate and reconstruction evidence;
- all unresolved limitations;
- confirmation that no live planner activation occurred;
- confirmation that no production demonstrations were generated;
- confirmation that no persistent evidence store was created;
- confirmation that no dataset was admitted or exported;
- confirmation that no model was invoked;
- confirmation that no training or fine-tuning occurred;
- confirmation that no push, merge, or deployment occurred before authorization; and
- the protected stash state.

## 28. Deferred work

The following remain deferred to later contracts:

- production demonstration-generation authorization;
- persistent evidence storage;
- planner-outcome evidence from live gameplay;
- human-review UI;
- authoritative gameplay-outcome attachment;
- dataset-admission policy;
- train, validation, test, preference, and distillation partition construction;
- dataset export;
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

## 29. Contract decision

Acceptance of this document must be explicit:

```text
ACCEPT KTS-I4-J CONTRACT
```

Implementation authorization must also be explicit and separate:

```text
AUTHORIZE KTS-I4-J
```

Until both decisions exist and the accepted contract checkpoint is verified,
implementation must not begin.

Even after implementation acceptance, runtime evidence generation, persistence,
dataset admission, export, model invocation, training, fine-tuning, push, merge,
and deployment remain separately controlled.

# KTS-I4-F — Consolidation and Verified Forgetting Contract

**Document ID:** KTS-I4-F-CONTRACT
**Status:** Proposed implementation contract
**Project:** Construct Intelligence Harness / Keep the Signal
**Governing architecture:** KTS-I4-A
**Accepted model bridge:** KTS-I4-B
**Accepted KTS observation adapter:** KTS-I4-C
**Accepted evidence-grounded memory fabric:** KTS-I4-D
**Accepted tactical adviser and strategy portfolio:** KTS-I4-E
**Base commit:** `fa9df3d`
**Target branch:** `game/keep-the-signal-i4-intelligence-harness`
**Implementation method:** Byte Coding until Codex availability is restored
**Implementation authorization:** Not granted by this document
**Operational classification:** Experimental candidate; planning and evaluation only
**Core doctrine:** Consolidation may propose what knowledge means. Forgetting must prove what can be removed. Neither may silently change accepted memory.

---

## 1. Purpose

KTS-I4-F establishes the first governed slow-learning layer above the accepted append-only evidence and episodic-memory fabric.

The slice provides deterministic, evidence-grounded contracts and reference implementations for:

- bounded episode selection;
- immutable consolidation snapshots;
- explicit deterministic clustering;
- candidate pattern and semantic-abstraction records;
- supporting, contradictory, counterexample, unseen, competing-explanation, and invariant evidence matrices;
- consolidation validation;
- preservation targets and information-preservation mappings;
- deterministic retention planning;
- protected-memory classification;
- simulated forgetting without repository mutation;
- reconstruction checks;
- retrieval-quality checks;
- lineage-continuity checks;
- forgetting-eligibility decisions;
- immutable tombstone drafts;
- KTS-specific consolidation features and verification probes.

KTS-I4-F does not alter durable memory.

It does not:

- update an evidence record;
- update an episodic-memory record;
- delete evidence;
- delete memory;
- archive a record;
- write a tombstone;
- create a durable semantic claim;
- create or promote a procedural skill;
- promote a strategy;
- consolidate live memory automatically;
- activate background processing;
- generate training examples;
- train or fine-tune a model.

The implementation produces reviewable candidate plans and proofs only.

---

## 2. Architectural position

```text
Accepted KTS-I4-D read-only evidence and episode source
    ↓
Explicit bounded episode selection
    ↓
Immutable consolidation snapshot
    ↓
Explicit deterministic feature projection
    ↓
Deterministic cluster assignment
    ↓
Candidate pattern or semantic abstraction
    ↓
Evidence matrix
      supporting
      contradictory
      counterexample
      unseen
      competing explanation
      invariant and version checks
    ↓
Consolidation validation
    ↓
Retention plan
      retain
      protect
      archive candidate
      forgetting candidate
      reject consolidation
    ↓
Accepted higher-level preservation target supplied by governance
    ↓
Virtual retained view
    ↓
Reconstruction, retrieval-quality, lineage, and reproducibility probes
    ↓
Forgetting eligibility or ineligibility
    ↓
Tombstone draft
```

Nothing in this flow may mutate the accepted repository.

---

## 3. Meaning of verified forgetting in KTS-I4-F

KTS-I4-F defines **verified forgetting eligibility**, not deletion execution.

A successful forgetting evaluation proves only that, under an explicit policy and bounded test set, a record is eligible to be considered for a later authorized removal operation.

The implementation must never describe a record as deleted, forgotten, purged, removed, or archived merely because eligibility passed.

Required language:

```text
forgetting_eligible
forgetting_ineligible
protected
retain
archive_candidate
```

Prohibited language for KTS-I4-F outputs unless describing an external historical fact:

```text
deleted
removed
purged
forgotten
archived
```

Actual deletion requires a later contract that introduces an authorized deletion executor, repository support, durable tombstone persistence, infrastructure activation, and separate human approval.

---

## 4. Permanent authority boundaries

### 4.1 Evidence and memory authority

Accepted KTS-I4-D evidence and episodic-memory records remain authoritative and immutable.

KTS-I4-F may:

- retrieve them through an explicitly read-only source;
- clone them into immutable snapshots;
- classify them for planning;
- reference them in candidates;
- simulate a retained view that excludes proposed forgetting candidates.

KTS-I4-F may not:

- call any repository `put` operation;
- change acceptance state;
- change classification;
- change retention class;
- change tags;
- rewrite lineage;
- replace contradictory evidence;
- infer that a candidate abstraction is accepted knowledge.

### 4.2 Consolidation authority

KTS-I4-F may create:

- candidate patterns;
- candidate semantic abstractions;
- candidate strategy refinements;
- rejected or quarantined candidate abstractions;
- consolidation validation reports.

These outputs remain experimental candidates.

KTS-I4-F may not create an active KTS-I4-D durable memory kind other than accepted episodic memory, and it may not promote any candidate into:

- accepted semantic memory;
- accepted procedural memory;
- an accepted production strategy;
- model weights or adapters.

### 4.3 Forgetting authority

KTS-I4-F may produce:

- protected classifications;
- retention decisions;
- simulated-forgetting evaluations;
- forgetting-eligibility decisions;
- tombstone drafts.

It may not execute any retention action.

Only a separately accepted governance and repository operation may later:

- archive;
- delete;
- persist a tombstone;
- apply retention changes.

### 4.4 Human and governance authority

Governance remains sole authority over:

- protected-class policy;
- acceptance of a higher-level preservation target;
- promotion of candidate abstractions;
- approval of archive or deletion;
- weakening or changing retention policy;
- approving a tombstone;
- authorizing a future deletion executor;
- approving training use;
- deployment.

---

## 5. Production, experiment, and hypothesis classification

All KTS-I4-F outputs must use one of:

```text
experimental_candidate
validated_candidate
rejected
quarantined
superseded
accepted_external_reference
```

`accepted_external_reference` may describe a caller-supplied representation that was accepted outside KTS-I4-F.

KTS-I4-F may verify the structure and supplied acceptance evidence of that reference.

It may not create the acceptance decision.

No consolidation candidate becomes accepted production merely because:

- it has many supporting episodes;
- it has high confidence;
- it passes reconstruction;
- no counterexample was found;
- a forgetting evaluation passed;
- it was selected repeatedly.

---

## 6. Exact implementation boundary

### 6.1 Transferable consolidation core

Authorized production directory:

```text
app/features/intelligence-harness/consolidation/
```

Authorized files:

```text
app/features/intelligence-harness/consolidation/failures.ts
app/features/intelligence-harness/consolidation/source-contract.ts
app/features/intelligence-harness/consolidation/episode-snapshot.ts
app/features/intelligence-harness/consolidation/selection-contract.ts
app/features/intelligence-harness/consolidation/cluster-contract.ts
app/features/intelligence-harness/consolidation/deterministic-clusterer.ts
app/features/intelligence-harness/consolidation/abstraction-contract.ts
app/features/intelligence-harness/consolidation/evidence-matrix.ts
app/features/intelligence-harness/consolidation/consolidation-validator.ts
app/features/intelligence-harness/consolidation/preservation-contract.ts
app/features/intelligence-harness/consolidation/retention-policy.ts
app/features/intelligence-harness/consolidation/forgetting-contract.ts
app/features/intelligence-harness/consolidation/forgetting-evaluator.ts
app/features/intelligence-harness/consolidation/tombstone-contract.ts
app/features/intelligence-harness/consolidation/consolidation-coordinator.ts
app/features/intelligence-harness/consolidation/index.ts
```

### 6.2 Keep the Signal consolidation adapter

Authorized production directory:

```text
app/features/keep-the-signal/consolidation/
```

Authorized files:

```text
app/features/keep-the-signal/consolidation/kts-consolidation-features.ts
app/features/keep-the-signal/consolidation/kts-consolidation-policy.ts
app/features/keep-the-signal/consolidation/kts-forgetting-probes.ts
app/features/keep-the-signal/consolidation/kts-consolidation-adapter.ts
app/features/keep-the-signal/consolidation/index.ts
```

### 6.3 Focused tests

Authorized test files:

```text
test/intelligence-consolidation-contract.test.ts
test/intelligence-consolidation-selection.test.ts
test/intelligence-consolidation-clustering.test.ts
test/intelligence-consolidation-evidence-matrix.test.ts
test/intelligence-consolidation-validator.test.ts
test/intelligence-forgetting-policy.test.ts
test/intelligence-forgetting-evaluator.test.ts
test/intelligence-consolidation-coordinator.test.ts
test/keep-the-signal-consolidation-adapter.test.ts
test/keep-the-signal-consolidation-boundaries.test.ts
```

### 6.4 Result record

Authorized result record:

```text
docs/game/KTS-I4-F-CONSOLIDATION-VERIFIED-FORGETTING-RESULT.md
```

Total authorized future implementation paths:

```text
32
```

No other path is authorized without an accepted contract amendment.

---

## 7. Dependency direction

Permitted:

```text
transferable consolidation core
    → accepted KTS-I4-D canonical JSON, digest, evidence, memory, relation, and retrieval contracts

KTS consolidation adapter
    → transferable consolidation core
    → accepted KTS-I4-D evidence and episodic-memory contracts
    → accepted KTS-I4-E strategy classification and evaluation contracts where required
```

Prohibited:

```text
KTS-I4-D memory fabric → consolidation
KTS-I4-E tactical adviser → consolidation
KTS engine → consolidation
KTS runtime → consolidation
KTS presentation → consolidation
KTS player → consolidation
routes → consolidation
worker → consolidation
```

No consolidation production file may import:

- engine execution;
- runtime;
- presentation;
- player;
- routes;
- React;
- Canvas;
- Web Audio;
- D1 adapters;
- Wrangler configuration;
- provider SDKs.

---

## 8. Read-only consolidation source

KTS-I4-F must not receive the full write-capable `MemoryRepository` interface.

It must define a narrow read-only source containing only bounded operations equivalent to:

```text
getEvidence()
getEvidenceRelations()
queryEvidence()
getMemory()
getMemoryRelations()
queryMemory()
```

The source may also expose explicitly bounded attachment retrieval when required, but it must not expose:

```text
putEvidence()
putEvidenceRelation()
putMemory()
putMemoryRelation()
attachEvidence()
putEpisodeBundle()
update()
delete()
archive()
purge()
truncate()
```

The source contract must be dependency-injected.

No global repository lookup is permitted.

Every source request must preserve KTS-I4-D access policy and retrieval budgets.

---

## 9. Consolidation request

Every consolidation request must be immutable and caller supplied.

Required fields:

- consolidation request ID;
- domain ID and version;
- source schema ID and version;
- selection policy;
- cluster policy;
- abstraction policy;
- validation policy;
- retention policy;
- forgetting policy;
- retrieval budgets;
- maximum candidate count;
- maximum cluster count;
- maximum episode count;
- maximum evidence count;
- maximum serialized characters;
- caller-supplied recorded-at time;
- actor ID;
- optional session, batch, predecessor, or governance-decision identity.

The coordinator must not generate:

- IDs;
- times;
- actors;
- permissions;
- retention rules;
- cluster policy;
- confidence;
- acceptance status.

---

## 10. Episode selection

Selection must be explicit, deterministic, authorized, and bounded.

Required selection filters:

- allowed domains;
- allowed classifications;
- accepted retention classes;
- accepted memory acceptance states;
- accepted episode-significance classes;
- optional exact episode IDs;
- optional tag filters;
- optional recorded-at range;
- optional authoritative-tick range where evidence supplies ticks;
- optional required evidence roles;
- result limit;
- serialized-character budget;
- relation traversal limit.

Selection must:

- preserve source order only when explicitly requested;
- otherwise use deterministic canonical ordering;
- report truncation;
- report omissions;
- never widen access permissions;
- reject unbounded queries;
- preserve contradictory and corrective relationships;
- never silently remove protected episodes before policy evaluation.

---

## 11. Consolidation snapshot

A consolidation snapshot is an immutable view of selected episodic records and the evidence required for evaluation.

Every snapshot must preserve:

- snapshot ID and schema version;
- request ID;
- domain and version;
- selected episodic-memory records;
- memory-to-evidence attachments;
- selected evidence records;
- relevant memory and evidence relations;
- source retrieval reports;
- accepted access policy;
- omitted and truncated references;
- canonical serialized size;
- content digest;
- caller-supplied recorded-at time;
- actor identity.

The snapshot must be independent of later mutation by the source or caller.

A snapshot is not a durable memory record.

---

## 12. Feature projection

Feature projection converts an episode snapshot into explicit typed features suitable for deterministic clustering and validation.

Every feature record must preserve:

- feature-record ID and version;
- source episode ID and digest;
- domain and domain version;
- feature schema ID and version;
- exact feature names;
- JSON-compatible feature values;
- missing-feature indicators;
- extraction method ID and version;
- source evidence references;
- source attachment references;
- source relation references;
- projection limitations;
- content digest.

Feature extraction must be deterministic.

It must not use:

- a model;
- embeddings;
- semantic similarity;
- wall clock;
- randomness;
- hidden learned weights;
- network access.

Unknown or unavailable values must remain explicitly unknown.

---

## 13. Deterministic cluster policy

KTS-I4-F supports explicit deterministic clustering only.

Required cluster modes:

```text
exact_feature_match
explicit_bucket
caller_supplied_assignment
```

Optional deterministic modes may be added only when their ordering and equality semantics are fully specified and require no hidden learned representation.

Each cluster policy must define:

- policy ID and version;
- cluster mode;
- feature keys;
- missing-value treatment;
- bucket boundaries when applicable;
- maximum clusters;
- maximum members per cluster;
- ordering;
- overflow behaviour;
- minimum cluster size;
- singleton treatment.

No default locale-sensitive ordering is permitted.

No K-means, embedding clustering, nearest-neighbour search, stochastic seeding, or model-assisted grouping is permitted in KTS-I4-F.

---

## 14. Cluster records

Every cluster record must preserve:

- cluster ID and version;
- cluster-policy identity;
- member episode IDs;
- member episode digests;
- member feature-record IDs;
- shared feature basis;
- divergent feature report;
- contradiction report;
- member count;
- overflow and truncation report;
- canonical ordering;
- content digest.

A cluster is a grouping hypothesis.

It is not evidence that a semantic claim is true.

Contradictory members must remain individually identifiable.

---

## 15. Candidate abstraction

Permitted candidate kinds:

```text
pattern_candidate
semantic_claim_candidate
strategy_refinement_candidate
```

No active `semantic_claim`, `procedural_skill`, or `parametric_lineage` memory kind may be created.

Every candidate abstraction must include:

- candidate ID and version;
- schema ID and version;
- candidate kind;
- domain and version scope;
- source cluster IDs;
- source episode IDs;
- source evidence IDs;
- structured representation;
- applicability conditions;
- exclusion conditions;
- expected effects where applicable;
- known failure modes;
- confidence basis points;
- uncertainty classification;
- extraction method ID and version;
- version boundaries;
- supporting references;
- contradiction references;
- counterexample references;
- unseen-evaluation references;
- competing-explanation references;
- invariant-check references;
- candidate status;
- actor identity;
- recorded-at time;
- content digest.

Permitted candidate statuses:

```text
experimental_candidate
validated_candidate
rejected
quarantined
superseded
```

No candidate status represents accepted production.

---

## 16. Evidence matrix

Every candidate must be evaluated through an immutable evidence matrix.

Required evidence classes:

```text
support
contradiction
counterexample
unseen
competing_explanation
domain_invariant
version_boundary
reproducibility
```

Every matrix entry must include:

- entry ID;
- candidate ID and version;
- evidence class;
- referenced episode, evidence, strategy, result, or external-acceptance identity;
- evaluator ID and version;
- outcome;
- weight basis or `not_applicable`;
- explanation code;
- optional concise public note;
- limitations;
- recorded-at time.

Required outcomes:

```text
supports
weakly_supports
neutral
weakly_refutes
refutes
unknown
not_applicable
```

Contradictions and counterexamples may not be merged into support counts.

Unknown evidence must remain unknown.

---

## 17. Consolidation validation

A consolidation validation report must test the candidate against:

- supporting episodes;
- counterexamples;
- contradictions;
- unseen episodes;
- competing explanations;
- domain invariants;
- known engine and ruleset version boundaries;
- accepted observation-schema boundaries;
- reproducibility requirements;
- minimum support cardinality;
- maximum unsupported certainty;
- required applicability and exclusion conditions;
- protected-evidence preservation.

Required validation classifications:

```text
candidate_validated
candidate_rejected
candidate_quarantined
needs_more_evidence
```

`candidate_validated` means the candidate passed the supplied evaluation policy.

It does not mean accepted production or durable semantic memory.

The validator must fail closed when:

- required evidence is unavailable;
- a unique counterexample was omitted;
- a contradiction is unaddressed;
- version compatibility is unknown;
- confidence exceeds supplied evidence;
- the candidate representation is broader than its support.

---

## 18. Confidence and uncertainty

Confidence must use integer basis points:

```text
0 to 10,000
```

Required uncertainty classes:

```text
low
medium
high
unknown
```

Confidence must be caller supplied or calculated through an explicit deterministic policy.

The calculation policy must be versioned and must preserve:

- inputs;
- weights;
- unknown handling;
- contradiction penalties;
- counterexample penalties;
- unseen-evaluation treatment;
- output rounding.

KTS-I4-F must not infer confidence through opaque heuristics.

---

## 19. Preservation target

Forgetting eligibility requires a supplied accepted higher-level preservation target.

Permitted target types:

```text
accepted_strategy
accepted_semantic_claim
accepted_procedural_skill
accepted_result
governed_archive
```

A preservation target must include:

- target ID and version;
- target type;
- domain and version;
- acceptance classification `accepted_external_reference`;
- acceptance evidence ID;
- acceptance decision ID;
- target digest;
- represented information map;
- source lineage references;
- applicability and version boundaries;
- actor and recorded-at time.

KTS-I4-F does not create or accept the target.

It validates the supplied reference and tests whether required information is represented.

---

## 20. Information-preservation map

Every proposed forgetting candidate must have an explicit preservation map.

The map must identify:

- source memory ID and digest;
- essential information units;
- destination target IDs;
- destination field or representation paths;
- transformation method;
- reconstruction method;
- residual information not preserved;
- unique evidence that remains only in the source;
- contradiction and correction preservation;
- version and scope constraints;
- evaluator identity;
- content digest.

An information unit may not be marked preserved merely because the target contains similar prose.

Preservation must use typed paths, structured identities, or deterministic reconstruction logic.

---

## 21. Retention policy

Every retention decision must be produced by an immutable versioned policy.

Required decisions:

```text
retain
protected
archive_candidate
forgetting_candidate
consolidation_rejected
```

The policy must consider:

- memory significance;
- acceptance state;
- classification;
- retention class;
- evidence roles;
- evidence source types;
- contradiction and correction relations;
- uniqueness;
- reproduction requirements;
- benchmark status;
- training lineage;
- promotion and rejection lineage;
- model-version transitions;
- governance and safety evidence;
- legal or consent constraints supplied by governance;
- minimum support cardinality;
- higher-level preservation availability.

No policy may silently weaken the source record’s accepted retention class.

---

## 22. Protected classes

The default reference policy must classify the following as protected or ineligible unless explicit governance evidence says otherwise:

- governance violations;
- safety failures;
- unique failures;
- unique counterexamples;
- human corrections;
- contradictory evidence;
- benchmark evidence;
- training lineage;
- promotion evidence;
- rejection evidence;
- model-version transitions;
- records required to reproduce accepted results;
- the sole support for an accepted representation;
- records under protected retention;
- records whose legal, consent, or audit status is unknown.

A protected decision must list every applicable reason.

No protected reason may be hidden by a higher aggregate score.

---

## 23. Forgetting request

Every forgetting evaluation request must be immutable and caller supplied.

Required fields:

- evaluation ID;
- source snapshot ID and digest;
- candidate memory IDs;
- retention-policy ID and version;
- preservation targets;
- preservation maps;
- reconstruction probes;
- retrieval-quality probes;
- lineage probes;
- reproducibility probes;
- allowed classifications;
- accepted retention classes;
- maximum candidate count;
- maximum probe count;
- maximum serialized characters;
- caller-supplied actor;
- caller-supplied evaluation time;
- optional governance-decision identity.

The evaluator must not generate the target list or decide to execute deletion.

---

## 24. Virtual retained view

KTS-I4-F must simulate forgetting using an immutable virtual view.

The virtual view must:

- preserve the original snapshot;
- mark proposed forgetting candidates as virtually excluded;
- preserve all other records;
- preserve tombstone-draft metadata separately;
- expose no write or delete operation;
- use deterministic lookup and retrieval;
- report attempts to access virtually excluded records;
- preserve source digests and lineage;
- support before-and-after probes.

The virtual view is an evaluator artifact only.

It must never be substituted for the authoritative repository.

---

## 25. Reconstruction probes

A reconstruction probe verifies whether required information can be recovered after virtual exclusion.

Every probe must define:

- probe ID and version;
- required information-unit IDs;
- allowed preservation targets;
- allowed retained evidence and memory;
- reconstruction method;
- expected canonical result or verifier;
- maximum operations;
- maximum serialized characters;
- acceptance rule.

Required outcomes:

```text
pass
fail
unknown
not_applicable
```

A forgetting candidate fails eligibility when a required probe is `fail` or `unknown`, unless the policy explicitly permits that probe to be non-blocking.

---

## 26. Retrieval-quality probes

A retrieval-quality probe compares bounded retrieval before and after virtual exclusion.

Every probe must define:

- probe ID and version;
- retrieval query;
- required result identities;
- prohibited result identities;
- ranking or ordering expectations;
- maximum result loss;
- maximum character-budget difference;
- contradiction-preservation requirement;
- acceptance rule.

The report must preserve:

- before results;
- after results;
- omitted and truncated identities;
- required-result retention;
- prohibited-result absence;
- contradiction retention;
- result-count difference;
- serialized-character difference;
- outcome.

No semantic similarity metric is permitted in KTS-I4-F.

---

## 27. Lineage and reproducibility probes

Lineage probes must prove that:

- the higher-level target retains source lineage;
- every source can still be traced from the target;
- contradictions and corrections remain traceable;
- promotion and rejection evidence remains traceable;
- tombstone drafts retain the source digest and lineage.

Reproducibility probes must prove that:

- accepted result reconstruction still has all required inputs;
- benchmark re-execution inputs remain available;
- model or strategy version transitions remain attributable;
- no unique authoritative evidence disappears from the virtual view.

Unknown lineage or reproduction status blocks eligibility.

---

## 28. Forgetting eligibility

Required classifications:

```text
forgetting_eligible
forgetting_ineligible
protected
evaluation_failed
```

A record may be `forgetting_eligible` only when:

1. required information is preserved in an accepted external target;
2. lineage remains traceable;
3. the record is not the only supporting example;
4. the record is not a unique counterexample or failure;
5. no protected class applies;
6. all blocking reconstruction probes pass;
7. all blocking retrieval-quality probes pass;
8. lineage and reproducibility probes pass;
9. a deterministic retention policy permits eligibility;
10. a complete tombstone draft can be constructed.

Every decision must contain explicit passed and failed conditions.

No aggregate score may override a failed blocking condition.

---

## 29. Tombstone draft

A tombstone draft must preserve:

- tombstone ID and schema version;
- source memory ID;
- source memory kind;
- source digest;
- domain and version;
- lineage references;
- evidence references;
- preservation-target references;
- forgetting reason;
- retention-policy ID and version;
- evaluation ID;
- evaluation-evidence references;
- authorizing actor identity supplied by the caller;
- proposed deletion time supplied by the caller;
- draft recorded-at time;
- draft status;
- content digest.

Required draft statuses:

```text
draft
governance_review_required
rejected
```

KTS-I4-F must not create a persisted tombstone or describe the draft as applied.

---

## 30. Consolidation coordinator

The coordinator may:

- read from the read-only source;
- build snapshots;
- project deterministic features;
- cluster;
- create candidate abstractions supplied through explicit deterministic builders;
- build evidence matrices;
- validate candidates;
- produce retention plans;
- run simulated forgetting;
- produce tombstone drafts.

The coordinator may not:

- call a model;
- call the KTS-I4-B bridge;
- persist evidence or memory;
- mutate a strategy portfolio;
- promote a strategy;
- execute an archive or deletion operation;
- run in the live KTS runtime;
- schedule itself;
- retry silently;
- widen source permissions.

A coordinator result must be immutable and classified as:

```text
completed
partial
rejected
failed
cancelled
```

---

## 31. KTS consolidation feature adapter

The KTS adapter may consume only accepted records whose domain is:

```text
keep-the-signal
```

It must preserve, when available:

- episode ID and digest;
- engine version;
- ruleset version;
- observation schema and level;
- seed;
- authoritative tick range;
- terminal or non-terminal outcome;
- score;
- wave and encounter identifiers;
- Signal, Defence, Weapons, coherence, and recovery outcome facts;
- adviser classification;
- strategy references;
- proposal-validation classification;
- supporting and contradictory evidence references;
- significance;
- corrections;
- benchmark status;
- known truncation or omission.

The adapter must not invent unavailable gameplay facts.

It must not import the KTS engine, runtime, presentation, player, routes, React, or model bridge.

---

## 32. KTS reference retention policy

The KTS reference policy must protect:

- deterministic replay and accepted-result reproduction evidence;
- engine and ruleset transition evidence;
- unique seeds that expose failures;
- unique encounter failures;
- human corrections;
- contradictory tactical outcomes;
- benchmark episodes;
- strategy promotion and rejection evidence;
- adviser validation failures;
- malformed or unsupported proposal evidence relevant to regression;
- training lineage when it later exists.

Routine redundant episodes may become forgetting candidates only when all general eligibility requirements pass.

---

## 33. KTS forgetting probes

The KTS adapter must provide deterministic probe builders for:

- accepted replay reproduction inputs;
- seed and version traceability;
- outcome reconstruction;
- strategy and adviser provenance;
- contradiction retention;
- benchmark retention;
- retrieval of required failure and correction records;
- accepted result reproduction;
- preservation of observation and source-state digests.

These probes operate only on supplied snapshots and virtual views.

They do not run the KTS engine or simulation.

---

## 34. Failure taxonomy

Required closed failure codes:

```text
invalid_consolidation_request
invalid_source
source_not_authorized
source_query_failed
selection_budget_exceeded
invalid_snapshot
snapshot_digest_mismatch
invalid_feature_record
invalid_cluster_policy
cluster_budget_exceeded
invalid_cluster
invalid_abstraction
abstraction_digest_mismatch
invalid_evidence_matrix
missing_required_evidence
unresolved_contradiction
unsupported_confidence
invalid_preservation_target
invalid_preservation_map
information_not_preserved
invalid_retention_policy
protected_record
invalid_forgetting_request
invalid_virtual_view
reconstruction_failed
retrieval_quality_failed
lineage_verification_failed
reproducibility_failed
forgetting_ineligible
invalid_tombstone_draft
consolidation_cancelled
consolidation_disposed
consolidation_internal_failure
```

Failures must contain:

- code;
- stage;
- safe public message;
- request ID when valid;
- snapshot, candidate, memory, or evaluation identity when safe;
- optional safe diagnostics.

Failures must not expose:

- restricted record contents;
- hidden counts for inaccessible classifications;
- credentials;
- local paths;
- stack traces;
- full source payloads;
- full preservation-target payloads;
- private governance evidence.

---

## 35. Immutability and mutation isolation

Tests must prove:

- source inputs are not mutated;
- repository-returned records are cloned into independent snapshots;
- feature records are immutable;
- cluster records are immutable;
- candidates are immutable;
- evidence matrices are immutable;
- retention policies are immutable;
- virtual views cannot mutate snapshots;
- preservation targets and maps are immutable;
- evaluator results are immutable;
- tombstone drafts are immutable;
- caller mutation after completion cannot alter a result;
- concurrent coordinators share no mutable state;
- disposal clears private in-memory references.

---

## 36. Determinism

The same canonical input and policy versions must produce byte-equivalent:

- selections;
- snapshots;
- feature records;
- cluster assignments;
- cluster records;
- candidate digests;
- evidence matrices;
- validation reports;
- retention decisions;
- virtual views;
- probe reports;
- forgetting decisions;
- tombstone drafts.

The implementation must not depend on:

- locale-sensitive sorting;
- object insertion order;
- wall clock;
- randomness;
- environment state;
- network state;
- hidden global mutable state.

---

## 37. Security and prohibited production APIs

The 21 production modules must not use:

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

They must not contain:

- provider SDK imports;
- credentials;
- remote endpoints;
- model invocation;
- embeddings;
- vector databases;
- direct D1 access;
- repository write calls;
- update or delete APIs;
- filesystem access;
- payload logging;
- analytics;
- telemetry;
- background scheduling;
- engine execution;
- runtime integration;
- UI rendering;
- strategy promotion;
- memory promotion;
- training-example generation;
- training;
- fine-tuning.

---

## 38. Performance and scale requirements

Focused validation must include:

- 10,000 episodic-memory selection candidates;
- bounded snapshot construction from at least 10,000 episodes;
- 10,000 deterministic feature records;
- at least 1,000 clusters before bounded truncation;
- a cluster containing at least 10,000 members;
- at least 10,000 evidence-matrix entries;
- 10,000 retention decisions;
- 10,000 virtual-view records;
- 10,000 forgetting evaluations;
- mixed contradictions, corrections, failures, benchmarks, and routine episodes;
- zero-result and zero-budget cases;
- maximum accepted budgets;
- repeated equivalent requests;
- concurrent independent requests.

Acceptance is based on bounded deterministic results, not wall-clock thresholds.

---

## 39. Required focused tests

At least **280 substantive named tests** are required across the ten authorized test files.

### Consolidation contract tests

Must cover:

- every candidate kind;
- every candidate status;
- every evidence class and outcome;
- confidence and uncertainty boundaries;
- identity and timestamp validation;
- canonical digest;
- exact shapes;
- immutable records;
- malformed runtime input;
- safe failures.

### Selection tests

Must cover:

- every filter;
- access allowlists;
- significance;
- tags;
- exact IDs;
- time and tick ranges;
- evidence roles;
- count and character budgets;
- truncation and omission;
- contradictions and corrections;
- no permission widening;
- 10,000-record scale.

### Clustering tests

Must cover:

- every cluster mode;
- exact-feature equality;
- explicit buckets;
- caller assignments;
- missing values;
- canonical ordering;
- overflow;
- singleton treatment;
- minimum size;
- 1,000-cluster scale;
- 10,000-member cluster;
- locale-independent ordering;
- determinism.

### Evidence-matrix tests

Must cover:

- every evidence class and outcome;
- unique references;
- contradictions separate from support;
- counterexamples separate from support;
- unknown handling;
- competing explanations;
- invariants;
- version boundaries;
- reproducibility;
- 10,000-entry scale.

### Consolidation-validator tests

Must cover:

- support cardinality;
- unique counterexample;
- unresolved contradiction;
- unseen evidence;
- competing explanation;
- invariant failure;
- version mismatch;
- unsupported certainty;
- candidate scope broader than support;
- protected-evidence preservation;
- all validation classifications;
- no production acceptance.

### Retention-policy tests

Must cover every decision and every protected class, including:

- governance violation;
- safety failure;
- unique failure;
- unique counterexample;
- human correction;
- contradiction;
- benchmark;
- training lineage;
- promotion and rejection evidence;
- model transition;
- reproducibility;
- sole support;
- protected retention;
- unknown legal or consent status;
- routine redundant candidate.

### Forgetting-evaluator tests

Must cover:

- all eligibility conditions;
- every blocking failure;
- preservation maps;
- virtual exclusion;
- before-and-after retrieval;
- reconstruction;
- lineage;
- reproducibility;
- contradiction retention;
- unknown outcomes;
- protected records;
- 10,000-record virtual view;
- 10,000 evaluations;
- immutable reports.

### Coordinator tests

Must cover:

- read-only source only;
- no repository writes;
- no model invocation;
- bounded full flow;
- partial result;
- rejection;
- cancellation;
- independent concurrency;
- disposal;
- no retry;
- no permission widening;
- no retention action execution.

### KTS adapter tests

Must cover:

- accepted KTS domain;
- wrong domain rejection;
- engine and ruleset versions;
- observation schema and level;
- seed and ticks;
- outcome facts;
- adviser and strategy provenance;
- contradictions and corrections;
- benchmark and failure features;
- unavailable facts remain unknown;
- KTS reference policy;
- every KTS probe builder;
- no engine or runtime import.

### Boundary tests

Must cover:

- exact production file set;
- exact test file set;
- read-only source shape;
- no repository writes;
- no update/delete/archive API;
- no direct D1;
- no model bridge;
- no engine/runtime/presentation/player/route/React import;
- no provider, embedding, vector, network, filesystem, clock, or randomness API;
- no training or promotion;
- no package or configuration dependency.

---

## 40. Complete repository validation

Required before implementation acceptance:

```text
focused KTS-I4-F tests
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
- model or provider code;
- embeddings and vector search;
- direct D1 access;
- repository writes;
- update/delete/archive/purge/truncate APIs;
- filesystem access;
- payload logging;
- engine or action execution;
- runtime, presentation, player, route, and React imports;
- strategy or memory promotion;
- training-example generation;
- training and fine-tuning;
- background scheduling.

Required boundary diffs:

- no KTS-I4-B change;
- no KTS-I4-C change;
- no KTS-I4-D change;
- no KTS-I4-E change;
- no KTS engine change;
- no KTS runtime change;
- no KTS presentation change;
- no KTS player change;
- no route or home change;
- no migration change;
- no package or lock-file change;
- no Wrangler, Vite, Vitest, TypeScript, worker, or deployment change;
- protected hero stash unchanged.

---

## 41. Result record

Implementation must create:

```text
docs/game/KTS-I4-F-CONSOLIDATION-VERIFIED-FORGETTING-RESULT.md
```

It must record:

- governing, contract, and implementation commits;
- exact changed paths;
- read-only source operations;
- snapshot, feature, cluster, candidate, evidence-matrix, retention, forgetting, and tombstone schemas;
- candidate kinds and statuses;
- cluster modes;
- evidence classes and outcomes;
- protected classes;
- retention decisions;
- preservation-target types;
- virtual-view behaviour;
- probe types and results;
- eligibility classifications;
- KTS feature and policy rules;
- focused and repository test totals;
- scale cases;
- typecheck, build, lint, format, and diff results;
- static scans;
- boundary diffs;
- protected stash;
- known limitations;
- confirmation that no record was updated, archived, deleted, consolidated durably, or tombstoned;
- confirmation that no semantic or procedural memory was promoted;
- confirmation that no model was invoked;
- confirmation that no training evidence, training, or fine-tuning occurred;
- confirmation that nothing was pushed, merged, or deployed.

---

## 42. Explicit non-goals

KTS-I4-F does not include:

- durable semantic-memory activation;
- procedural-skill activation;
- strategy promotion;
- live memory consolidation;
- memory update;
- evidence update;
- archive execution;
- deletion execution;
- tombstone persistence;
- D1 schema changes;
- D1 resource activation;
- queues;
- cron or background workers;
- model invocation;
- embeddings;
- vector search;
- training-example generation;
- distillation;
- training;
- fine-tuning;
- runtime integration;
- UI integration;
- gameplay changes;
- deployment;
- cross-domain transfer.

---

## 43. Acceptance criteria

KTS-I4-F may be accepted only when:

- the source interface is read-only;
- accepted evidence and episodic memory remain immutable;
- every selection is explicit, authorized, and bounded;
- snapshots preserve full selected lineage and retrieval reports;
- feature projection is deterministic and transparent;
- clustering is deterministic and non-learned;
- contradictions and counterexamples remain separate;
- candidates remain non-production;
- consolidation validation fails closed;
- higher-level preservation targets are supplied, not created or accepted by the slice;
- information preservation is typed and reconstructable;
- protected classes cannot be overridden by aggregate scores;
- forgetting occurs only in an immutable virtual view;
- every blocking probe must pass for eligibility;
- unknown reconstruction, lineage, or reproducibility blocks eligibility;
- tombstones remain drafts;
- no archive, delete, or repository write operation exists;
- KTS features never invent unavailable facts;
- at least 280 substantive focused tests pass;
- all scale cases remain bounded and deterministic;
- all repository gates pass;
- accepted KTS-I4-B, C, D, and E code remains unchanged;
- no model, provider, embedding, D1, runtime, UI, promotion, persistence mutation, deletion, training, or deployment is introduced;
- the result record is complete.

---

## 44. Byte Coding posture

After contract acceptance and explicit implementation authorization, Byte may implement KTS-I4-F through a guarded delivery package.

Byte must:

- implement only the exact 32 future paths;
- compile and test outside the repository first;
- provide a guarded installer;
- provide an authoritative validator;
- package all source, tests, and the candidate result record;
- perform direct source review before commit eligibility;
- preserve the accepted repository and protected stash.

Byte must not:

- write directly to Nolan’s repository;
- stage or commit;
- push, merge, or deploy;
- activate a live model, provider, D1 resource, queue, or worker;
- introduce deletion or archive execution;
- promote a candidate;
- train or fine-tune.

Nolan retains operator authority over applying, validating, staging, committing, and accepting the implementation.

---

## 45. Decision statements

Contract acceptance phrase:

```text
ACCEPT KTS-I4-F CONTRACT
```

Implementation authorization phrase:

```text
AUTHORIZE KTS-I4-F
```

Acceptance of this contract does not authorize implementation.

Implementation authorization permits Byte Coding only within the exact 32 future paths and constraints defined here.

Push, pull-request creation, merge, deployment, live provider or model invocation, runtime integration, UI integration, repository writes, archive or deletion execution, tombstone persistence, strategy or memory promotion, training-example generation, training, and fine-tuning remain separately unauthorized.

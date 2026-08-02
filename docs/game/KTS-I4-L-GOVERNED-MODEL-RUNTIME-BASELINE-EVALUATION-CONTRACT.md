# KTS-I4-L — Governed Model, Runtime and Baseline Evaluation Contract

## 1. Contract metadata

- Document ID: `KTS-I4-L`
- Title: Governed Model, Runtime and Baseline Evaluation
- Status: Proposed contract
- Repository: `m-indsRefuge/the-signal`
- Target branch: `game/keep-the-signal-i4-intelligence-harness`
- Required baseline: `2d41f67e41e6feafd604c309fd656b89a9e3e3c8`
- Required parent slice: accepted KTS-I4-K governed dataset admission
- Contract decision: pending explicit `ACCEPT KTS-I4-L CONTRACT`
- Implementation authorization: not granted by this document
- Model-artifact acquisition authorization: not granted
- Runtime installation authorization: not granted
- Baseline execution authorization: not granted
- Model selection: not granted
- Training or fine-tuning authorization: not granted

## 2. Purpose

KTS-I4-L defines the governed control plane for evaluating compact local language
models as bounded advisory strategists for Keep the Signal.

The slice must establish exact, reconstructable contracts for:

- workstation and accelerator evidence;
- candidate model identity and licensing evidence;
- model artifact identity and integrity;
- local runtime identity and capabilities;
- deterministic prompt and generation settings;
- KTS-specific baseline cases;
- output parsing and normalization;
- proposal validation;
- bounded performance evidence;
- repeatability and cross-runtime comparison;
- candidate ranking; and
- explicit human model selection.

KTS-I4-L separates control-plane implementation from any live model acquisition
or execution. Implementing the evaluation harness does not authorize downloading
weights, installing runtimes, invoking a model, selecting a model, exporting a
dataset, or training.

## 3. Architectural position

```text
accepted KTS-I4-K admission control plane
→ immutable hardware snapshot
→ immutable runtime profile
→ immutable model-candidate profile
→ immutable artifact and licence evidence
→ deterministic baseline suite
→ separately authorized local model acquisition
→ separately authorized baseline execution
→ immutable run evidence
→ deterministic comparison
→ explicit operator model-selection decision
→ future dataset materialization contract
→ future immutable training plan
→ separately authorized first fine-tuning run
```

## 4. Governing doctrine

The slice must enforce:

> A model is not selected because it is available or popular. It is selected
> only after its exact artifact, runtime, prompt rendering, outputs, resource
> use, and KTS validator performance are recorded and compared under a
> reconstructable baseline.

The system must prove:

- which workstation state was used;
- which runtime binary and backend were used;
- which exact model revision and artifact were used;
- which licence evidence was reviewed;
- which tokenizer and chat template were used;
- which prompts and generation parameters were rendered;
- which outputs were received;
- which outputs parsed successfully;
- which proposals passed deterministic KTS validation;
- which cases required abstention or rejection;
- which repeatability and resource measurements were observed;
- how candidates were compared; and
- that model selection and training remained separate decisions.

## 5. Recorded provisional workstation baseline

The following historical facts may seed the hardware-evidence form but must not
be treated as current execution evidence:

- Device family: Lenovo 83JE Windows 11 laptop
- CPU: Intel Core i7-14700HX
- System memory: 32 GB
- GPU: NVIDIA GeForce RTX 5060 Laptop GPU
- Reported dedicated VRAM: approximately 8,151 MiB
- Storage: approximately 1 TB NVMe SSD
- WSL2 Ubuntu: previously validated
- CUDA in WSL: previously validated
- Ollama: previously recorded as installed
- llama.cpp: installation not yet evidenced

Before any model acquisition or baseline execution, a fresh caller-supplied
snapshot must bind exact current values and evidence digests.

## 6. Initial candidate-family register

The initial evaluation register may contain exactly these candidate families:

1. `Qwen/Qwen3-0.6B`
2. `Qwen/Qwen3-1.7B`
3. `HuggingFaceTB/SmolLM3-3B`
4. `google/gemma-3-1b-it`

This is a candidate-family register only.

For each candidate, later evidence must bind:

- publisher;
- repository ID;
- exact immutable revision;
- base or instruction-tuned role;
- parameter count;
- architecture and configuration digest;
- tokenizer identity and digest;
- chat-template identity and digest;
- context-window declaration;
- licence identifier;
- licence text or terms evidence digest;
- access restrictions;
- source-weight artifact identities and hashes;
- GGUF conversion provenance when applicable;
- exact quantization identity;
- quantized artifact hash;
- known limitations; and
- acquisition authorization identity.

No mutable `main`, `latest`, unqualified Ollama tag, or community alias may serve
as an accepted model identity.

## 7. Initial runtime register

The initial runtime register may contain exactly:

- `llama.cpp`
- `Ollama`
- `Transformers/PyTorch` as a later comparison runtime

The first governed baseline should treat:

- `llama.cpp` as the reference GGUF inference runtime;
- `Ollama` as the convenience and integration runtime; and
- `Transformers/PyTorch` as optional until exact memory feasibility is proven.

Each runtime profile must bind:

- runtime ID;
- exact version or commit;
- executable or package digest;
- installation source;
- operating environment;
- accelerator backend;
- CUDA or CPU capability;
- device identity;
- GPU offload configuration;
- context allocation;
- thread and batch settings;
- prompt-template behavior;
- seed support;
- deterministic-setting support;
- output protocol;
- telemetry capability;
- known limitations; and
- runtime authorization identity.

## 8. Scope

KTS-I4-L implementation may provide only:

- immutable hardware-snapshot contracts;
- immutable candidate-model profiles;
- immutable licence-review profiles;
- immutable model-artifact profiles;
- immutable runtime profiles;
- immutable invocation requests;
- immutable generation-parameter profiles;
- deterministic prompt templates;
- deterministic prompt suites;
- immutable raw-response envelopes;
- deterministic output parsers and normalizers;
- KTS proposal-validator bridges;
- immutable baseline-case definitions;
- immutable baseline-run evidence;
- repeatability audits;
- bounded descriptive performance metrics;
- deterministic candidate comparisons;
- deterministic candidate-ranking recommendations;
- pure in-memory controllers;
- KTS-specific adapters;
- synthetic deterministic fixtures used only by tests; and
- one KTS-I4-L result record.

## 9. Explicit non-scope

KTS-I4-L implementation must not:

- inspect the host machine directly;
- invoke PowerShell, shell, WMI, `nvidia-smi`, CUDA tools, or system APIs;
- install or update Ollama, llama.cpp, Python, CUDA, drivers, packages, or tools;
- download or upload model artifacts;
- resolve mutable model revisions over a network;
- start, stop, or configure a model server;
- invoke a local or remote model;
- open network sockets;
- read environment variables or secrets;
- read or write model files;
- persist hardware, runtime, model, prompt, response, or score records;
- generate or export training datasets;
- tokenize training data;
- train, fine-tune, distill, align, or evaluate model weights;
- create adapters, checkpoints, gradients, optimizer state, or trainer state;
- execute or enqueue game actions;
- mutate authoritative KTS engine state;
- activate the model in live gameplay;
- make an autonomous model-selection decision;
- push, merge, deploy, or provision infrastructure.

## 10. Hardware snapshot contract

A hardware snapshot must contain, at minimum:

- snapshot identity and schema version;
- caller-supplied capture time;
- machine identity alias;
- operating-system identity and version;
- host or WSL environment identity;
- CPU identity, logical processors, and architecture;
- total and available system memory;
- storage volume identity, capacity, and available space;
- GPU identity;
- GPU architecture or compute capability when known;
- total and available VRAM;
- driver version;
- CUDA driver and toolkit versions when present;
- power-mode declaration;
- thermal-mode declaration;
- charger-state declaration;
- evidence source identities;
- evidence digests;
- explicit unknown fields;
- exact limitations;
- canonical snapshot digest; and
- `executionAuthorization: "absent"`.

Missing measurements must remain explicitly unknown.

## 11. Hardware feasibility policy

The initial policy must independently evaluate:

- model artifact storage feasibility;
- runtime installation feasibility;
- quantized inference VRAM feasibility;
- context-allocation feasibility;
- system-memory fallback feasibility;
- thermal and power evidence completeness;
- training feasibility as a separate non-authoritative estimate; and
- unsupported or unknown hardware evidence.

Feasibility results must be:

- `feasible`
- `conditionally_feasible`
- `infeasible`
- `unknown`

An `unknown` result must never be coerced to `feasible`.

Training feasibility is descriptive only and does not authorize training.

## 12. Model candidate contract

Every candidate profile must bind:

- candidate identity;
- publisher;
- repository ID;
- immutable revision;
- model-family identity;
- architecture;
- parameter count;
- base or instruction-tuned role;
- supported languages when declared;
- context-window declaration;
- model-card digest;
- configuration digest;
- tokenizer identity and digest;
- chat-template identity and digest;
- licence profile;
- artifact profiles;
- supported runtime profiles;
- expected precision or quantization;
- known limitations;
- suitability hypotheses;
- canonical candidate digest; and
- `selectionState: "not_selected"`.

Candidate registration is not model selection.

## 13. Licence review contract

Licence evidence must preserve:

- licence identifier;
- licence source identity;
- licence text or terms digest;
- access or acceptance requirement;
- redistribution conditions;
- derivative-work conditions;
- commercial-use declaration when available;
- attribution requirements;
- acceptable-use restrictions;
- reviewer identity;
- caller-supplied review time;
- review decision;
- exact reason codes;
- exact limitations; and
- canonical review digest.

Licence-review decisions must be:

- `approved_for_baseline_evaluation`
- `conditionally_approved`
- `rejected`
- `unknown`

Only `approved_for_baseline_evaluation` may proceed to separately authorized
artifact acquisition.

Licence approval for baseline evaluation does not authorize redistribution,
training, publication, promotion, or deployment.

## 14. Artifact integrity contract

Every model artifact profile must bind:

- artifact identity;
- candidate identity and revision;
- source repository;
- filename;
- format;
- quantization;
- byte length;
- SHA-256 digest;
- conversion provenance when applicable;
- source-artifact identities and digests;
- tokenizer and template compatibility;
- acquisition time supplied by the caller;
- acquisition authorization identity;
- integrity status;
- exact limitations; and
- canonical artifact digest.

Integrity states must be:

- `verified`
- `mismatch`
- `incomplete`
- `unknown`

Only `verified` artifacts may be used in baseline execution.

## 15. Runtime capability contract

Runtime capability evidence must independently represent:

- executable availability;
- executable digest;
- version identity;
- supported artifact format;
- supported model architecture;
- CUDA backend availability;
- CPU fallback availability;
- GPU offload support;
- deterministic seed support;
- chat-template support;
- structured-output support;
- context configuration;
- token accounting;
- timing evidence;
- memory telemetry;
- server mode;
- CLI mode;
- cancellation;
- timeout enforcement;
- output capture; and
- unsupported or unknown capability.

Capability states must be:

- `supported`
- `unsupported`
- `unknown`

Unknown capabilities must not be treated as supported.

## 16. Invocation request contract

A future separately authorized invocation request must bind:

- invocation identity;
- baseline-suite identity and digest;
- baseline-case identity and digest;
- hardware-snapshot identity and digest;
- candidate identity and digest;
- artifact identity and digest;
- runtime identity and digest;
- exact rendered prompt identity and digest;
- exact generation-parameter identity and digest;
- exact expected response protocol;
- caller-supplied start deadline;
- cancellation identity;
- invocation authorization identity; and
- `actionExecution: false`.

The control-plane implementation may create and validate invocation requests but
must not execute them.

## 17. Generation parameter contract

The initial generation profile must support exact values for:

- maximum context tokens;
- maximum generated tokens;
- seed;
- temperature;
- top-p;
- top-k;
- minimum-p when supported;
- repetition penalty;
- stop sequences;
- batch size;
- thread count;
- GPU layers or offload mode;
- flash-attention declaration;
- grammar or structured-output mode;
- thinking mode when supported; and
- timeout budget.

Every numeric value must be finite and within explicit safe bounds.

Comparisons must distinguish unsupported settings rather than silently dropping
them.

## 18. Prompt contract

Every rendered prompt must bind:

- prompt-template identity and version;
- candidate chat-template identity and digest;
- baseline-case identity;
- system instruction;
- immutable KTS observation projection;
- legal action set;
- requested response schema;
- explicit abstention instruction;
- explicit no-action-execution boundary;
- exact rendered messages;
- exact rendered text when available;
- token count when supplied;
- prompt digest; and
- exact limitations.

Prompt rendering must be deterministic for the same inputs and template.

## 19. Initial baseline suite

The initial suite must contain deterministic cases covering:

- valid one-step proposal;
- valid bounded multi-step proposal;
- forced abstention because evidence is insufficient;
- forced rejection because no legal action satisfies the request;
- legal-action-set adherence;
- invalid-action temptation;
- malformed observation handling;
- contradictory observation handling;
- constrained resource allocation;
- signal-preservation prioritization;
- defensive strategy;
- movement strategy;
- transmission-power strategy;
- attack-versus-defence trade-off;
- budget-exhaustion declaration;
- cancellation response handling;
- exact response-schema adherence;
- repeated identical prompt;
- paraphrase stability;
- context-boundary behavior;
- prompt-injection resistance within untrusted observation text;
- no hidden state assumptions;
- no execution-authority claims; and
- deterministic validator projection.

The baseline suite must use synthetic or previously accepted deterministic KTS
fixtures only. It must not generate training data or enter any dataset manifest.

## 20. Response contract

Every response envelope must preserve:

- response identity;
- invocation identity;
- candidate, artifact, and runtime identities;
- raw response text;
- raw response digest;
- response-protocol identity;
- finish reason;
- supplied token counts;
- supplied timing measurements;
- supplied memory measurements;
- runtime warnings;
- truncation declaration;
- cancellation declaration;
- timeout declaration;
- parser result;
- normalized proposal or explicit non-plan outcome;
- exact limitations; and
- `actionExecuted: false`.

Raw responses must remain distinct from parsed outputs and validator decisions.

## 21. Parsing and normalization

Parsing results must be:

- `parsed`
- `schema_rejected`
- `malformed`
- `empty`
- `truncated`
- `cancelled`
- `timed_out`
- `runtime_failed`
- `unknown`

The parser must not repair meaning silently.

Permitted normalization is limited to:

- Unicode normalization under an explicit policy;
- line-ending normalization;
- bounded surrounding-whitespace removal;
- exact code-fence removal when policy allows it; and
- deterministic JSON-object extraction when exactly one unambiguous object is
  present.

Any semantic repair must be recorded as rejected or unsupported.

## 22. Deterministic KTS validation

A parsed proposal must be passed to the accepted deterministic KTS proposal
validator.

The evidence must preserve independently:

- parse result;
- schema result;
- legal-action result;
- proposal-validator decision;
- proposal-validator reasons;
- proposal-validator digest;
- abstention correctness;
- authority-boundary compliance; and
- final case outcome.

A fluent response is not a valid response unless deterministic validation passes.

## 23. Baseline case outcomes

Each case must produce exactly one outcome:

- `passed`
- `failed`
- `abstained_correctly`
- `abstained_incorrectly`
- `schema_rejected`
- `validator_rejected`
- `runtime_failed`
- `timed_out`
- `cancelled`
- `unknown`

Unknown outcomes must not contribute as passes.

## 24. Repeatability audit

The repeatability layer must evaluate:

- exact raw-response equality;
- normalized-response equality;
- proposal equality;
- validator-decision equality;
- case-outcome equality;
- token-count variance;
- latency variance;
- memory variance; and
- unsupported comparisons.

Repeatability results must be:

- `stable`
- `unstable`
- `partially_stable`
- `unknown`

Determinism claims must identify the exact runtime, artifact, seed, template, and
parameter profile.

## 25. Performance evidence

Performance metrics may report only bounded descriptive facts:

- prompt tokens;
- generated tokens;
- total tokens;
- time to first token when supplied;
- total generation duration;
- tokens per second;
- peak GPU memory when supplied;
- peak system memory when supplied;
- GPU utilization when supplied;
- CPU utilization when supplied;
- timeout count;
- failure count; and
- warm versus cold run declaration.

Metrics must not infer unsupported hardware measurements.

## 26. Candidate comparison

Comparison must preserve independent dimensions:

- licence acceptability;
- artifact integrity;
- hardware feasibility;
- runtime compatibility;
- prompt rendering support;
- parse success rate;
- schema compliance rate;
- legal-action compliance rate;
- KTS validator acceptance rate;
- correct abstention rate;
- authority-boundary compliance;
- repeatability;
- latency;
- throughput;
- memory use;
- failure rate;
- context behavior;
- known limitations; and
- unsupported comparisons.

The comparison must not collapse all dimensions into one opaque score.

## 27. Ranking recommendation

A ranking policy may emit:

- `recommended_for_selection_review`
- `recommended_with_conditions`
- `not_recommended`
- `insufficient_evidence`

A recommendation is advisory only.

Final model selection requires the explicit operator decision:

```text
ACCEPT KTS-I4-L MODEL SELECTION
```

The selection record must bind the exact candidate, revision, artifact, runtime,
prompt suite, evidence set, comparison policy, limitations, and operator
decision time.

## 28. Hard budgets

The implementation must enforce these maxima:

- Candidate profiles per comparison: 16
- Runtime profiles per candidate: 8
- Artifacts per candidate: 32
- Baseline cases per suite: 1,000
- Repetitions per case and configuration: 100
- Run evidence records per controller: 100,000
- Raw response characters per record: 1,048,576
- Rendered prompt characters per case: 1,048,576
- Parser reason codes per response: 64
- Validator reason codes per response: 64
- Limitations per record: 128
- Runtime warnings per response: 128
- Comparison dimensions: 64
- Candidate recommendations: 16
- Serialized characters per snapshot: 262,144
- Serialized characters per candidate: 1,048,576
- Serialized characters per response record: 2,097,152
- Serialized characters per comparison: 16,777,216
- Serialized characters per controller snapshot: 33,554,432

All numeric budgets must be validated as finite safe integers before allocation.

## 29. Failure taxonomy

The transferable implementation must expose deterministic failures for:

- invalid hardware snapshot;
- missing hardware evidence;
- unsupported hardware field;
- invalid candidate profile;
- mutable or missing model revision;
- unknown or rejected licence;
- artifact digest mismatch;
- unsupported artifact format;
- incompatible tokenizer;
- incompatible chat template;
- unsupported runtime;
- runtime capability unknown;
- invalid generation parameters;
- prompt rendering mismatch;
- prompt budget exceeded;
- invalid response envelope;
- raw response budget exceeded;
- ambiguous response object;
- schema rejection;
- validator rejection;
- repeatability mismatch;
- unsupported comparison;
- record budget exceeded;
- serialized-size budget exceeded;
- cancellation;
- controller disposed;
- prohibited host inspection;
- prohibited artifact acquisition;
- prohibited runtime installation;
- prohibited model invocation;
- prohibited model selection;
- prohibited persistence;
- prohibited dataset export; and
- prohibited training.

Failures must contain no environment-derived data unless that data was explicitly
supplied in an immutable input record.

## 30. Controller boundaries

Controllers may coordinate only caller-supplied immutable records and pure
deterministic policies.

Controllers must:

- expose no host-inspection method;
- expose no package installer;
- expose no model downloader;
- expose no runtime launcher;
- expose no network client;
- expose no live invocation method;
- expose no model-selection mutation;
- expose no persistence or exporter;
- expose no tokenizer or trainer;
- expose no action-execution method;
- support deterministic cancellation of in-memory evaluation work;
- dispose idempotently; and
- reject commands after disposal.

## 31. Future execution authorizations

After implementation acceptance, the following decisions remain separate.

### 31.1 Hardware and runtime evidence capture

```text
AUTHORIZE KTS-I4-L ENVIRONMENT EVIDENCE CAPTURE
```

This may authorize exact read-only commands under a separately reviewed runner.

### 31.2 Model artifact acquisition

```text
AUTHORIZE KTS-I4-L MODEL ARTIFACT ACQUISITION
```

This must bind exact repositories, revisions, filenames, expected hashes,
licence decisions, storage locations, and byte budgets.

### 31.3 Baseline execution

```text
AUTHORIZE KTS-I4-L BASELINE EXECUTION
```

This must bind exact hardware, runtime, artifact, prompt-suite, generation
parameters, repetition count, time and resource budgets, and evidence output
location.

### 31.4 Model selection

```text
ACCEPT KTS-I4-L MODEL SELECTION
```

None of these decisions authorizes training.

## 32. Static prohibited-capability boundary

Production modules and tests must prove the absence of:

- shell, process, WMI, registry, and host-inspection calls;
- filesystem reads or writes;
- network clients and sockets;
- environment and secret access;
- package, runtime, or driver installation;
- model downloads;
- local or remote model invocation;
- model-server lifecycle control;
- timers, schedulers, and autonomous loops;
- nondeterministic identity or randomness;
- locale-sensitive ordering;
- persistence and storage clients;
- dataset export and tokenization;
- training, adapters, checkpoints, gradients, and optimizer state;
- route, UI, audio, renderer, and browser-runtime imports;
- live authoritative-engine mutation;
- action execution or queueing; and
- production activation code.

## 33. Exact implementation boundary

No existing path may be modified.

Implementation, once separately authorized, is limited to exactly 50 new paths.

### 33.1 Transferable model-evaluation modules — 27 paths

`app/features/intelligence-harness/model-evaluation/`

1. `failures.ts`
2. `evaluation-contract.ts`
3. `hardware-snapshot.ts`
4. `hardware-policy.ts`
5. `model-candidate-contract.ts`
6. `model-identity.ts`
7. `license-contract.ts`
8. `artifact-contract.ts`
9. `runtime-contract.ts`
10. `runtime-capability.ts`
11. `invocation-contract.ts`
12. `generation-parameters.ts`
13. `prompt-contract.ts`
14. `prompt-suite.ts`
15. `response-contract.ts`
16. `output-parser.ts`
17. `output-normalizer.ts`
18. `validator-bridge.ts`
19. `baseline-case.ts`
20. `baseline-run.ts`
21. `baseline-score.ts`
22. `determinism-audit.ts`
23. `performance-metrics.ts`
24. `comparison-contract.ts`
25. `candidate-ranking.ts`
26. `evaluation-controller.ts`
27. `index.ts`

### 33.2 KTS-specific model-evaluation adapters — 8 paths

`app/features/keep-the-signal/model-evaluation/`

28. `kts-hardware-profile.ts`
29. `kts-candidate-register.ts`
30. `kts-prompt-suite.ts`
31. `kts-observation-projector.ts`
32. `kts-response-parser.ts`
33. `kts-validator-bridge.ts`
34. `kts-ranking-policy.ts`
35. `index.ts`

### 33.3 Focused tests — 14 paths

36. `test/intelligence-model-evaluation-contract.test.ts`
37. `test/intelligence-model-evaluation-hardware.test.ts`
38. `test/intelligence-model-evaluation-candidates.test.ts`
39. `test/intelligence-model-evaluation-licenses.test.ts`
40. `test/intelligence-model-evaluation-artifacts.test.ts`
41. `test/intelligence-model-evaluation-runtimes.test.ts`
42. `test/intelligence-model-evaluation-prompts.test.ts`
43. `test/intelligence-model-evaluation-parser.test.ts`
44. `test/intelligence-model-evaluation-validator.test.ts`
45. `test/intelligence-model-evaluation-scoring.test.ts`
46. `test/intelligence-model-evaluation-determinism.test.ts`
47. `test/intelligence-model-evaluation-comparison.test.ts`
48. `test/intelligence-model-evaluation-controller.test.ts`
49. `test/keep-the-signal-model-evaluation-boundaries.test.ts`

### 33.4 Result record — 1 path

50. `docs/game/KTS-I4-L-GOVERNED-MODEL-RUNTIME-BASELINE-EVALUATION-RESULT.md`

## 34. Required focused validation

The implementation must provide at least 800 focused tests across the 14 exact
test paths.

Focused validation must prove:

- every schema, enum, state, outcome, and recommendation;
- deep immutability and defensive cloning;
- canonical identity and digest behavior;
- finite-number and safe-integer enforcement;
- hardware unknowns remain unknown;
- candidate revisions cannot be mutable;
- licence decisions gate acquisition eligibility;
- artifact mismatches block evaluation eligibility;
- runtime unknowns remain unknown;
- generation parameters are exact and bounded;
- prompt rendering is deterministic;
- response normalization is non-semantic;
- ambiguous outputs are rejected;
- all parser outcomes;
- deterministic KTS validator bridging;
- all baseline outcomes;
- repeatability classifications;
- comparison preserves independent dimensions;
- recommendations remain advisory;
- controller cancellation and disposal;
- hard-budget enforcement;
- 1,000-case and 100,000-record bounded scale behavior;
- no mutation of accepted I4-I, I4-J, or I4-K values;
- no host inspection, installation, acquisition, invocation, selection,
  persistence, export, tokenization, training, runtime activation, action
  execution, UI, route, audio, browser, deployment, or network capability; and
- exact 50-path implementation scope.

## 35. Repository acceptance gates

Before implementation acceptance, all of the following must pass:

1. Exact branch and accepted KTS-I4-K checkpoint.
2. Exact 50-path implementation boundary.
3. No modification to existing paths.
4. Minimum focused test count met.
5. Complete repository tests under controlled worker concurrency.
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

## 36. Result-record requirements

The final result record must state:

- exact contract checkpoint;
- exact implementation checkpoint;
- exact parent;
- exact 50 paths;
- focused and repository test totals;
- type, build, lint, format, diff, whitespace, and prohibited-scan outcomes;
- all repairs;
- deterministic fixtures used by tests;
- hard-budget evidence;
- hardware, candidate, licence, artifact, runtime, prompt, parser, validator,
  repeatability, performance, comparison, and ranking evidence;
- all unresolved limitations;
- confirmation that no host inspection occurred;
- confirmation that no runtime was installed or launched;
- confirmation that no model artifact was acquired;
- confirmation that no model was invoked or selected;
- confirmation that no dataset was persisted or exported;
- confirmation that no training or fine-tuning occurred;
- confirmation that no push, merge, or deployment occurred before authorization;
  and
- the protected stash state.

## 37. Deferred work

The following remain deferred:

- environment evidence-capture runner;
- current hardware snapshot;
- llama.cpp installation and verification;
- exact Ollama version and binary evidence;
- model licence review decisions;
- exact model revision selection;
- model artifact acquisition;
- GGUF artifact verification;
- live baseline execution;
- model comparison evidence;
- explicit model selection;
- production demonstration generation;
- persistent evidence storage;
- dataset materialization and export;
- tokenizer-bound training artifacts;
- immutable KTS-I4-H training plan;
- first training dry run;
- model training or fine-tuning;
- model evaluation after training;
- promotion;
- deployment; and
- complete KTS-I4 closure and merge.

## 38. Contract decision

Acceptance must be explicit:

```text
ACCEPT KTS-I4-L CONTRACT
```

Implementation authorization must be explicit and separate:

```text
AUTHORIZE KTS-I4-L
```

Until both decisions exist and the accepted contract checkpoint is verified,
implementation must not begin.

Even after implementation acceptance, environment capture, runtime installation,
artifact acquisition, model invocation, model selection, dataset export,
training, fine-tuning, push, merge, and deployment remain separately controlled.

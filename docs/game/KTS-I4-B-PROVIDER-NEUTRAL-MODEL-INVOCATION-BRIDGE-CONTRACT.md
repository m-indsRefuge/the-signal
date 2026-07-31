# KTS-I4-B — Provider-Neutral Model and Invocation Bridge Contract

**Document ID:** KTS-I4-B-CONTRACT
**Status:** Proposed implementation contract
**Project:** Construct Intelligence Harness / Keep the Signal
**Governing architecture:** KTS-I4-A
**Base commit:** `cb2aea1`
**Target branch:** `game/keep-the-signal-i4-intelligence-harness`
**Implementation authorization:** Not granted by this document
**Core doctrine:** The model may propose strategy. The governed system must prove it.

---

## 1. Purpose

KTS-I4-B defines the first executable component of the Construct Intelligence Harness: a provider-neutral, domain-independent model invocation bridge.

The bridge must provide a stable boundary between future compact local models, future remote providers, domain adapters, training systems, and evaluation harnesses without allowing any model to become authoritative over Keep the Signal or another Construct system.

This slice establishes:

- explicit model and provider identity;
- typed capability discovery;
- immutable invocation requests;
- structured-output contracts;
- bounded invocation budgets;
- cancellation and deadline handling;
- deterministic failure classification;
- provider and model provenance;
- response validation;
- in-memory provider registration;
- safe bridge disposal;
- deterministic test adapters.

This slice does not connect to a live model.

---

## 2. Architectural position

```text
Domain adapter
    ↓ typed observation or task context
Construct Intelligence Harness
    ↓ immutable invocation request
Provider-neutral model bridge
    ↓ provider-specific request
Provider adapter
    ↓ model candidate output
Provider-neutral model bridge
    ↓ validated result or typed failure
Construct Intelligence Harness
    ↓ bounded proposal
Domain validator
    ↓ accept or reject
Authoritative domain system
```

The bridge is infrastructure. It does not understand game rules, Windows telemetry, Batch-87 tasks, strategy quality, memory importance, or training rewards.

---

## 3. Permanent authority boundaries

The bridge may:

- register provider adapters;
- register explicit model descriptors;
- validate invocation requests;
- enforce declared budgets;
- invoke one explicitly selected provider adapter;
- cancel an invocation;
- validate returned model identity;
- decode and validate structured output;
- return typed usage and provenance;
- classify failure.

The bridge may not:

- mutate gameplay or domain state;
- select a strategy;
- execute a proposed action;
- decide whether a proposal is useful;
- access Keep the Signal engine internals;
- persist requests or responses;
- log secrets or model content;
- store memory;
- train or fine-tune;
- retry silently;
- route to an unrequested model;
- fall back to another provider automatically;
- download a model;
- use provider credentials;
- make a network request in the core implementation;
- change package dependencies;
- alter accepted KTS-I1 through KTS-I3 code.

---

## 4. Transferable implementation location

The provider-neutral bridge belongs to the transferable harness, not the Keep the Signal feature directory.

Authorized production path:

```text
app/features/intelligence-harness/model-bridge/
```

Authorized production files:

```text
app/features/intelligence-harness/model-bridge/json-types.ts
app/features/intelligence-harness/model-bridge/model-contract.ts
app/features/intelligence-harness/model-bridge/provider-contract.ts
app/features/intelligence-harness/model-bridge/failures.ts
app/features/intelligence-harness/model-bridge/registry.ts
app/features/intelligence-harness/model-bridge/invocation-coordinator.ts
app/features/intelligence-harness/model-bridge/index.ts
```

Authorized tests:

```text
test/intelligence-harness-model-contract.test.ts
test/intelligence-harness-model-registry.test.ts
test/intelligence-harness-invocation-coordinator.test.ts
test/intelligence-harness-invocation-failures.test.ts
```

Authorized result record:

```text
docs/game/KTS-I4-B-PROVIDER-NEUTRAL-MODEL-INVOCATION-BRIDGE-RESULT.md
```

No other paths are authorized unless a contract amendment is accepted first.

---

## 5. Runtime and platform constraints

The production bridge must be:

- TypeScript;
- environment-neutral;
- usable in browser, Cloudflare, Node-compatible test environments, and future local runtimes;
- free of provider SDK imports;
- free of Node-only filesystem, process, or networking APIs;
- free of React;
- free of Canvas and Web Audio;
- free of storage APIs;
- free of global mutable singletons;
- deterministic under injected provider, clock, and decoder behaviour;
- compatible with strict TypeScript settings.

The bridge may use platform-standard types such as:

- `AbortSignal`;
- `Readonly`;
- `Promise`;
- JSON-compatible values.

A clock must be injected if diagnostic timestamps or elapsed durations are required. Core behaviour must not depend on `Date.now()` or wall-clock time for authority.

---

## 6. JSON value contract

The bridge must define a reusable JSON-compatible type system.

Required conceptual types:

```text
JsonPrimitive
JsonArray
JsonObject
JsonValue
```

Constraints:

- no functions;
- no symbols;
- no `undefined`;
- no `bigint`;
- no cyclic values;
- no class instances crossing the bridge;
- no mutable provider-owned references in returned public records.

Inputs and outputs that cross the bridge must be JSON-compatible or explicitly normalized.

---

## 7. Provider identity

Every provider adapter must expose an immutable descriptor containing at least:

- `providerId`;
- `providerVersion`;
- `executionKind`;
- supported modalities;
- structured-output capability;
- cancellation capability;
- usage-reporting capability;
- maximum concurrent invocations, if known.

Permitted initial execution kinds:

```text
local
remote
embedded
test
```

`test` is permitted only for deterministic validation adapters and may not be described as a live model provider.

Provider IDs and versions must be explicit, non-empty, stable strings.

---

## 8. Model identity

Every invokable model must have an immutable descriptor containing at least:

- `modelId`;
- `providerId`;
- `providerModelName`;
- `modelRevision`;
- `family`;
- `parameterClass`, when known;
- `contextWindowTokens`;
- `maximumOutputTokens`;
- supported input modalities;
- supported output modalities;
- structured-output capability;
- training or adaptation identity, when applicable;
- local or remote execution classification.

A model alias that can silently change revision is not sufficient identity.

If a provider resolves an alias internally, the invocation result must report the actual model and revision. Unexpected model substitution must fail unless the caller explicitly authorizes an accepted substitution policy in a later contract.

KTS-I4-B permits no automatic substitution.

---

## 9. Capability contract

The bridge must expose capabilities without assuming every provider behaves identically.

Initial capability fields should cover:

- text input;
- text output;
- JSON or structured output;
- streaming;
- cancellation;
- usage reporting;
- deterministic seed support;
- temperature control;
- maximum context;
- maximum output;
- local execution;
- remote execution.

Unsupported capabilities must fail before provider invocation when determinable from registered descriptors.

Streaming may be represented in the contracts but must not be implemented as an active production path in KTS-I4-B.

Tool invocation, multimodal input, embeddings, reranking, and training jobs are deferred.

---

## 10. Invocation identity and provenance

Every request must carry an explicit immutable invocation ID supplied by the caller.

The bridge must not generate invocation IDs through hidden randomness.

Every result must identify:

- invocation ID;
- requested provider;
- requested model;
- actual provider;
- actual model;
- provider adapter version;
- request schema version;
- output schema identity;
- bridge version;
- completion classification;
- usage, when available;
- diagnostic timing, when available through an injected clock;
- provider response ID, when available.

The bridge must preserve provenance without persisting it.

---

## 11. Input message contract

The bridge must support an ordered immutable message sequence.

Initial roles:

```text
system
developer
user
assistant
context
```

The `context` role represents retrieved or domain-supplied evidence and must not be silently merged with instruction-bearing roles.

Each message must include:

- role;
- content;
- optional source label;
- optional evidence references;
- optional trust classification.

The bridge does not decide whether content is trustworthy. It preserves the distinctions supplied by the harness.

No message may contain a function, executable callback, or mutable reference.

---

## 12. Structured-output contract

KTS-I4-B must support caller-defined structured output.

Each structured-output contract must include:

- schema ID;
- schema version;
- human-readable purpose;
- JSON-compatible schema descriptor;
- strictness classification;
- decoder and validator supplied by the caller or domain layer.

The provider receives only the serializable schema descriptor.

The decoder and validator execute inside the bridge after provider output returns.

The bridge must distinguish:

- provider returned no output;
- output was not parseable;
- output parsed but violated schema;
- output validated successfully.

Unvalidated model output must never be returned as a successful typed result.

Raw provider output may be included only in a typed failure record when explicitly permitted by the invocation request. The default must avoid returning raw failed output.

---

## 13. Invocation budget

Every request must include a declared immutable budget.

Required fields:

- maximum input tokens;
- maximum output tokens;
- maximum total tokens;
- maximum input characters;
- maximum output characters;
- deadline duration in milliseconds;
- maximum attempts.

KTS-I4-B rules:

- `maximumAttempts` must equal `1`;
- no automatic retry is permitted;
- the bridge must reject internally inconsistent budgets;
- model descriptor limits must cap caller budgets;
- provider limits must cap model limits;
- output over declared character or token limits must fail;
- missing usage data must be represented as unknown, not estimated as fact;
- a provider may perform its own internal tokenization, but the bridge must not claim exact token counts without provider evidence.

A later release may add explicit retry, fallback, or routing policy. KTS-I4-B may not.

---

## 14. Cancellation and deadlines

The invocation coordinator must accept an `AbortSignal`.

Required behaviour:

- abort before invocation prevents provider execution;
- abort during invocation is forwarded when supported;
- an aborted invocation returns a typed cancellation failure;
- deadline expiry returns a typed deadline failure;
- cancellation and deadline outcomes are distinguishable;
- late provider completion after cancellation must not be returned as success;
- listener cleanup is mandatory;
- disposal cancels or rejects active work according to an explicit policy.

The bridge must not assume provider cancellation guarantees immediate compute termination. It only guarantees that cancelled output is not promoted as a successful bridge result.

---

## 15. Failure taxonomy

All failures crossing the bridge must use a closed typed taxonomy.

Required initial failure codes:

```text
invalid_request
unknown_provider
unknown_model
provider_model_mismatch
unsupported_capability
budget_exceeded
input_too_large
output_too_large
cancelled
deadline_exceeded
provider_unavailable
provider_rejected
provider_transport_failure
provider_internal_failure
empty_output
malformed_output
schema_rejected
bridge_disposed
bridge_internal_failure
```

Every failure must include:

- failure code;
- invocation ID, when available;
- retryable classification;
- safe public message;
- requested provider and model, when known;
- stage at which failure occurred;
- optional safe diagnostic metadata.

Raw thrown exceptions must not cross the public bridge boundary.

Secrets, authorization headers, local file paths, full prompts, and raw model output must not appear in safe public failure messages.

---

## 16. Provider adapter contract

A provider adapter must implement a narrow interface equivalent to:

```text
descriptor()
listModels()
invoke(request, signal)
dispose()
```

The exact TypeScript design may differ, but the following rules are mandatory:

- descriptors are immutable;
- registered models belong to the provider;
- invocation accepts only bridge-normalized requests;
- provider output identifies the actual model;
- provider exceptions are caught by the bridge;
- provider adapters may not mutate the request;
- disposal is idempotent;
- disposed providers reject new invocations;
- no live provider implementation is authorized in KTS-I4-B.

Tests may define deterministic scripted adapters inside test files.

---

## 17. Registry contract

The in-memory registry must support:

- provider registration;
- provider lookup;
- model registration or provider-derived model indexing;
- exact model lookup;
- capability inspection;
- duplicate rejection;
- provider removal only when safe;
- immutable snapshots;
- disposal.

Registry requirements:

- no global singleton;
- no persistence;
- no hidden model aliases;
- duplicate provider IDs fail;
- duplicate model identities fail;
- model/provider mismatch fails;
- snapshots cannot mutate registry state;
- removal of a provider with active work must follow explicit coordinator policy;
- registration order must not alter exact lookup semantics.

---

## 18. Invocation coordinator

The coordinator is the only production entry point for invocation.

It must:

1. reject use after disposal;
2. validate request structure;
3. resolve the exact provider and model;
4. verify capabilities;
5. normalize and freeze the provider request;
6. enforce pre-invocation budgets;
7. bind cancellation and deadline handling;
8. invoke exactly one adapter;
9. catch and classify provider failures;
10. verify actual provider and model identity;
11. enforce output budgets;
12. decode structured output;
13. validate the decoded value;
14. construct an immutable success or typed failure result;
15. release listeners and active-invocation state.

It must not:

- perform strategy selection;
- modify messages;
- inject hidden instructions;
- add hidden provider fallbacks;
- retry;
- persist;
- log content;
- execute returned code;
- evaluate domain usefulness.

---

## 19. Success result

A successful result must contain:

- `ok: true`;
- invocation identity;
- requested and actual model provenance;
- validated structured output;
- finish classification;
- usage fields with explicit unknown states;
- safe diagnostics;
- output schema identity;
- immutable metadata.

Success must be impossible when:

- identity mismatches;
- output is empty;
- parsing fails;
- schema validation fails;
- budget limits are exceeded;
- cancellation or deadline has occurred;
- the bridge or provider is disposed.

---

## 20. Immutability

Public descriptors, requests, snapshots, success records, and failure records must be treated as immutable.

The implementation must prevent provider adapters from mutating caller-owned request arrays or message objects.

Tests must prove that:

- caller mutation after invocation begins does not alter the normalized provider request;
- provider mutation attempts do not alter caller records;
- registry snapshots do not expose mutable state;
- result records cannot mutate internal coordinator state.

Deep freezing is permitted but must be implemented safely for JSON-compatible records only.

---

## 21. Concurrency

KTS-I4-B must support multiple independent invocations without shared-state corruption.

Required behaviour:

- invocation IDs are unique among active requests;
- duplicate active invocation IDs fail;
- completion releases the active ID;
- cancellation of one invocation does not cancel another;
- provider concurrency limits are enforced if declared;
- registry snapshots remain stable during invocation;
- disposal behaviour is deterministic;
- no mutable global counters or provider state are shared unintentionally.

The bridge does not need to implement a waiting queue in KTS-I4-B. Exceeding a declared provider concurrency limit may return a typed `provider_unavailable` failure.

---

## 22. Security and privacy

The bridge must be secure by construction.

Required rules:

- no credentials in model descriptors;
- no credentials in invocation requests;
- no environment-variable access in production bridge files;
- no persistence;
- no logging;
- no telemetry;
- no analytics;
- no automatic prompt capture;
- no network implementation;
- no dynamic code execution;
- no `eval`;
- no `Function` constructor;
- no parsing of model output as executable code;
- no secrets in failure records.

Future provider adapters must receive credentials through separate provider-specific configuration outside the portable request contract.

---

## 23. Determinism and testability

Provider output is not assumed deterministic.

Bridge behaviour under a fixed scripted provider must be deterministic.

Tests must use injected deterministic adapters and clocks to prove:

- exact request normalization;
- exact failure classification;
- exact identity verification;
- exact budget handling;
- exact cancellation precedence;
- exact schema-validation outcomes;
- stable immutable result shapes;
- stable registry behaviour.

No test may require internet access, provider credentials, a downloaded model, GPU availability, browser automation, or the KTS game runtime.

---

## 24. Required tests

At least 60 focused named tests are required across the four authorized test files.

Coverage must include:

### Contract tests

- JSON-compatible input acceptance;
- invalid JSON-like values;
- message-role preservation;
- explicit context-role preservation;
- descriptor validation;
- budget validation;
- structured-output contract validation;
- immutability.

### Registry tests

- registration;
- exact lookup;
- duplicate rejection;
- provider/model mismatch;
- immutable snapshots;
- disposal;
- provider removal;
- capability inspection.

### Coordinator tests

- successful validated invocation;
- exact provider selection;
- exact model selection;
- normalized immutable request;
- usage provenance;
- unknown usage representation;
- concurrent invocations;
- duplicate active invocation IDs;
- disposal;
- provider concurrency limits.

### Failure tests

- every required failure code;
- cancellation before invocation;
- cancellation during invocation;
- deadline expiry;
- late completion suppression;
- provider exception sanitization;
- empty output;
- malformed output;
- schema rejection;
- output budget overflow;
- identity mismatch;
- listener cleanup.

---

## 25. Repository validation

Required validation before implementation acceptance:

```text
focused KTS-I4-B tests
complete repository tests
typecheck
production build
lint
format check
git diff --check
```

Required static scans over authorized production paths:

- no `fetch`;
- no `XMLHttpRequest`;
- no `WebSocket`;
- no storage APIs;
- no `process.env`;
- no `Deno.env`;
- no `Bun.env`;
- no `eval`;
- no `new Function`;
- no provider SDK imports;
- no React imports;
- no Keep the Signal engine imports;
- no dependency changes.

Required boundary diffs:

- no KTS engine changes;
- no KTS runtime changes;
- no KTS presentation changes;
- no KTS player changes;
- no home or route changes;
- no package changes;
- no Wrangler or deployment changes;
- hero stash unchanged.

---

## 26. Result record

Implementation must produce:

```text
docs/game/KTS-I4-B-PROVIDER-NEUTRAL-MODEL-INVOCATION-BRIDGE-RESULT.md
```

The result record must include:

- base and final commit;
- exact changed paths;
- implementation summary;
- interface summary;
- failure taxonomy;
- test counts;
- validation results;
- static-scan results;
- boundary confirmation;
- known limitations;
- confirmation that no live model was invoked;
- confirmation that implementation remains non-authoritative.

---

## 27. Explicit non-goals

KTS-I4-B does not include:

- a Keep the Signal observation adapter;
- tactical advice;
- prompt design for gameplay;
- memory storage;
- retrieval;
- embeddings;
- strategy libraries;
- training data;
- fine-tuning;
- LoRA or QLoRA;
- model downloads;
- local inference engines;
- remote API calls;
- provider credentials;
- streaming output;
- tools or function calling;
- multimodal input;
- persistence;
- analytics;
- React integration;
- gameplay changes;
- autonomous action;
- algorithm search;
- deployment.

---

## 28. Acceptance criteria

KTS-I4-B may be accepted only when:

- all authorized code is transferable and domain-independent;
- exact provider and model identity are enforced;
- structured output cannot succeed without validation;
- budgets are explicit and enforced;
- cancellation and deadlines are deterministic;
- failures are typed and sanitized;
- no hidden retry or fallback exists;
- registry and coordinator state are isolated and disposable;
- public records are immutable;
- concurrency behaviour is tested;
- no provider SDK, network, storage, or credential access exists;
- at least 60 focused tests pass;
- all repository gates pass;
- no accepted KTS code is modified;
- the result record is complete.

---

## 29. Decision statements

Contract acceptance phrase:

```text
ACCEPT KTS-I4-B CONTRACT
```

Implementation authorization phrase:

```text
AUTHORIZE KTS-I4-B
```

Acceptance of this contract does not authorize implementation.

Authorization permits implementation only within the exact paths, constraints, and validation requirements defined here.

Push, merge, pull request creation, deployment, provider integration, model download, inference, persistence, and training remain separately unauthorized.

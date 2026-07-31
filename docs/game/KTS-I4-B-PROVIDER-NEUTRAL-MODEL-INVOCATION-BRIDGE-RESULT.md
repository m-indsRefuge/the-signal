# KTS-I4-B — Provider-Neutral Model and Invocation Bridge Result

**Document ID:** KTS-I4-B-RESULT
**Status:** Authoritative repository validation complete; eligible for implementation acceptance
**Project:** Construct Intelligence Harness / Keep the Signal
**Governing architecture:** KTS-I4-A
**Implementation contract:** KTS-I4-B
**Authorized branch:** `game/keep-the-signal-i4-intelligence-harness`
**Governing architecture commit:** `cb2aea1`
**Accepted contract commit:** `fe158b7`
**Implementation checkpoint:** The commit containing this result record and the eleven authorized implementation and test paths
**Validation date:** 2026-07-31
**Operator:** Nolan
**AI collaborator:** Byte through OpenAI
**Core doctrine:** The model may propose strategy. The governed system must prove it.

---

## 1. Result

KTS-I4-B successfully delivers the first executable, transferable component of the Construct Intelligence Harness: a provider-neutral, domain-independent model invocation bridge.

The implementation provides:

- JSON-compatible boundary types;
- explicit provider and model descriptors;
- immutable message and invocation contracts;
- preserved context, trust, source, and evidence distinctions;
- caller-defined structured-output decoding and validation;
- explicit token, character, attempt, and deadline budgets;
- exact provider and model resolution;
- strict actual-model identity verification;
- deterministic cancellation and deadline handling;
- a closed typed failure taxonomy;
- sanitized provider-failure handling;
- immutable success and failure records;
- in-memory provider and model registration;
- bounded provider concurrency;
- deterministic disposal;
- deterministic scripted tests.

No live model, provider SDK, provider credential, network implementation, storage, training, fine-tuning, game adapter, tactical adviser, or model authority was introduced.

---

## 2. Exact implementation paths

Production:

```text
app/features/intelligence-harness/model-bridge/json-types.ts
app/features/intelligence-harness/model-bridge/model-contract.ts
app/features/intelligence-harness/model-bridge/provider-contract.ts
app/features/intelligence-harness/model-bridge/failures.ts
app/features/intelligence-harness/model-bridge/registry.ts
app/features/intelligence-harness/model-bridge/invocation-coordinator.ts
app/features/intelligence-harness/model-bridge/index.ts
```

Tests:

```text
test/intelligence-harness-model-contract.test.ts
test/intelligence-harness-model-registry.test.ts
test/intelligence-harness-invocation-coordinator.test.ts
test/intelligence-harness-invocation-failures.test.ts
```

Result record:

```text
docs/game/KTS-I4-B-PROVIDER-NEUTRAL-MODEL-INVOCATION-BRIDGE-RESULT.md
```

Total authorized implementation paths:

```text
12
```

---

## 3. Interface summary

### Provider contract

A provider adapter exposes:

```text
descriptor()
listModels()
invoke(normalizedRequest, abortSignal)
dispose()
```

The bridge registers immutable copies of provider and model descriptors. No provider alias or mutable descriptor becomes authoritative.

### Invocation contract

Each request carries:

- caller-supplied invocation identity;
- exact provider identity;
- exact model identity;
- ordered typed messages;
- source, trust, and evidence distinctions;
- one immutable budget;
- one structured-output contract;
- optional supported model parameters;
- explicit raw-failure-output permission.

### Coordinator contract

The coordinator:

1. validates the request;
2. resolves one exact provider and model;
3. validates capabilities and budgets;
4. creates an immutable normalized provider request;
5. binds cancellation and deadline handling;
6. invokes exactly one provider adapter;
7. verifies actual model identity;
8. validates usage and output limits;
9. decodes structured output;
10. rejects non-JSON or schema-invalid output;
11. returns an immutable typed result;
12. releases active state and listeners.

There is no retry, queue, fallback, hidden prompt injection, model substitution, or domain-action execution.

---

## 4. Failure taxonomy

The implementation defines and tests all 19 required failure codes:

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

Unclassified provider exceptions are sanitized. Raw exception text does not cross the public bridge boundary.

Raw failed model output is omitted by default and included only when the caller explicitly permits it.

---

## 5. Implementation repairs

Authoritative repository validation identified ESLint-only defects:

- one empty recursive interface equivalent to its supertype;
- unused test parameters;
- one unused type import.

The repairs:

- replaced the empty recursive interface with an equivalent readonly recursive type alias;
- removed or used test-only parameters as appropriate;
- removed the unused type import.

These were implementation-quality and test-harness repairs only.

They did not change:

- the accepted public architecture;
- provider or model identity rules;
- request normalization;
- structured-output validation;
- budgets;
- cancellation;
- deadline behaviour;
- failure classifications;
- concurrency;
- authority boundaries.

---

## 6. Focused KTS-I4-B validation

Authoritative focused test result:

```text
Test files: 4 passed
Tests:      96 passed
Duration:   1.16 seconds
```

Coverage includes:

- JSON-compatible value validation;
- cyclic and class-instance rejection;
- immutable deep cloning;
- provider and model descriptor validation;
- budget validation;
- context-role, trust, source, and evidence preservation;
- exact provider and model registration;
- duplicate and mismatch rejection;
- immutable registry snapshots;
- provider removal and disposal;
- validated structured success;
- immutable normalized provider requests;
- caller and provider mutation isolation;
- explicit unknown usage;
- exact provenance;
- capability rejection before invocation;
- input, output, and token budget enforcement;
- independent concurrency;
- duplicate active invocation rejection;
- provider concurrency limits;
- injected clock diagnostics;
- cancellation before and during invocation;
- deadline expiry;
- late-result suppression;
- active-work disposal;
- provider-fault mapping and sanitization;
- empty, malformed, non-JSON, and schema-invalid output rejection;
- raw-output disclosure policy;
- actual provider, model, name, and revision substitution rejection;
- cancellation-listener and deadline cleanup.

---

## 7. Complete repository validation

Authoritative repository result:

```text
Test files: 21 passed
Tests:      651 passed
Duration:   6.39 seconds
```

This includes all previously accepted Keep the Signal engine, encounter, runtime, presentation, player-surface, route, audio, and integration tests.

No existing repository regression was observed.

---

## 8. Quality gates

The authoritative repository completed:

```text
TypeScript type generation: PASS
Application typecheck:      PASS
Test typecheck:             PASS
Production client build:    PASS
Production SSR build:       PASS
ESLint:                     PASS
Prettier format check:      PASS
git diff --check:           PASS
```

Build evidence:

```text
Client modules transformed: 119
SSR modules transformed:    116
```

Wrangler regenerated existing project types during the accepted typecheck command. No Wrangler configuration or dependency change was introduced.

---

## 9. Static security and isolation scan

The authorized production paths were scanned with no prohibited matches.

No production use was found for:

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
React imports
Keep the Signal engine imports
provider SDK imports
```

The exact working-tree status contained only the twelve authorized KTS-I4-B implementation paths.

Therefore, authoritative validation confirmed:

- no KTS engine change;
- no KTS encounter change;
- no KTS runtime change;
- no KTS presentation change;
- no KTS player change;
- no route or home change;
- no package or lock-file change;
- no Wrangler or deployment change;
- no hero change;
- no unrelated repository change.

---

## 10. Authority and isolation

The bridge remains non-authoritative.

It does not:

- understand Keep the Signal rules;
- observe the KTS engine;
- propose KTS tactics;
- execute actions;
- select strategies;
- retain memory;
- train models;
- access credentials;
- call a network provider;
- download a model;
- store prompts or responses;
- log content;
- change dependencies;
- alter gameplay or presentation.

The model may eventually propose strategy through later accepted layers. The governed domain system must still validate and prove every accepted action.

---

## 11. Protected repository state

The protected hero stash remained intact:

```text
stash@{0}: On design/foundation-0.1: WIP hero landing page before Keep the Signal foundation
```

No stash was applied, dropped, modified, or replaced.

Nothing was pushed, merged, deployed, downloaded, trained, or invoked during KTS-I4-B implementation validation.

---

## 12. Known limitations and deferred work

Deferred by contract:

- live local-provider adapters;
- remote-provider adapters;
- provider configuration and credentials;
- streaming;
- tool or function calling;
- multimodal input;
- embeddings and reranking;
- KTS observation adapter;
- tactical adviser;
- memory and retrieval;
- training evidence;
- LoRA or QLoRA;
- preference optimization;
- model routing and fallback;
- persistence;
- deployment.

These are not KTS-I4-B defects.

---

## 13. Final classification

```text
Contract authorization:            PASS
Implementation delivery:           COMPLETE
Focused deterministic tests:       96/96 PASS
Complete repository tests:         651/651 PASS
Failure taxonomy coverage:         19/19 PASS
Typecheck:                         PASS
Production build:                  PASS
Lint:                              PASS
Format:                            PASS
Diff check:                        PASS
Static prohibited scan:            PASS
Accepted KTS boundaries:           PRESERVED
Protected hero stash:              PRESERVED
Live model invocation:             none
Observed implementation defects:   none remaining
Classification:                    successful_implementation_validation
```

KTS-I4-B is eligible for formal implementation acceptance after the exact twelve authorized paths are committed and the resulting checkpoint is verified.

The exact acceptance phrase is:

```text
ACCEPT KTS-I4-B IMPLEMENTATION
```

Acceptance does not authorize push, pull request creation, merge, deployment, provider integration, model download, live inference, persistence, memory integration, training, or fine-tuning.

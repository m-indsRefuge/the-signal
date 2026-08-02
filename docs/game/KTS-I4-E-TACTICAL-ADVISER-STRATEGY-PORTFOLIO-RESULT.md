# KTS-I4-E Tactical Adviser and Strategy Portfolio Result

## Status

Implementation candidate repaired and source-audited; eligible for formal implementation acceptance

This record reports a bounded implementation candidate. It does not claim architecture or implementation acceptance.

## Governing baseline

- Accepted contract commit: `26f7cf5`
- Implementation base: `26f7cf5`
- Full base commit: `26f7cf5d5d585185e7006fa327daba7154a9a70c`
- Branch: `game/keep-the-signal-i4-intelligence-harness`
- Repository: `C:/Users/nolan/AIProjects/the-signal`

## Byte source audit and narrow repair

- Byte source audit classification: `Validated candidate requires narrow repair`
- Audited candidate archive SHA-256: `E3C971192CDB6A3983E6F7C883B6C84CF0485B9552AAE73CB7B4DFE884ACF02D`
- Repair authority: existing 30 candidate paths only
- Formal implementation acceptance: pending Nolan approval

### Renewed Byte source audit

- Repaired candidate archive SHA-256: `8600CF0F463C693BD2977A6CBB19864FA8403D0552EAB5D3CB4BF2C6F920B9AC`
- Actual archive files: 30/30 authorized
- ZIP directory entries: 3
- Repaired source audit: PASS
- Audit findings A-01 through A-08: PASS
- Hardening finding H-01: PASS
- Accepted authority and dependency boundaries: PASS
- Commit eligibility: PASS
- Observed unresolved implementation defects: none
- Final implementation acceptance: pending Nolan approval after exact commit verification

The renewed audit verified directly that:

- empty strategy selection produces a failure-free abstention without retrieval or model invocation;
- proposal grounding is restricted to strategies, memories, evidence, and contradictions actually included in the final bounded context;
- the rule-based adviser retains a private immutable snapshot of the exact eight KTS baselines;
- accepted KTS-I4-C packet schema, level, lineage, and adapter identities are checked;
- strategy ordering is locale-independent;
- `selectedStrategy` has an exact two-field shape;
- invalid proposal construction uses the closed tactical-adviser failure taxonomy;
- malformed evaluation values fail as `evaluation_invalid`;
- applicability evidence references use valid public identities.

The narrow repair changed these 14 existing candidate paths relative to Byte's audited archive:

1. `app/features/intelligence-harness/tactical-adviser/adviser-coordinator.ts`
2. `app/features/intelligence-harness/tactical-adviser/evaluation-contract.ts`
3. `app/features/intelligence-harness/tactical-adviser/strategy-contract.ts`
4. `app/features/keep-the-signal/tactical-adviser/kts-adviser-adapter.ts`
5. `app/features/keep-the-signal/tactical-adviser/kts-model-context.ts`
6. `app/features/keep-the-signal/tactical-adviser/kts-proposal-contract.ts`
7. `app/features/keep-the-signal/tactical-adviser/kts-rule-based-adviser.ts`
8. `test/intelligence-adviser-coordinator.test.ts`
9. `test/intelligence-adviser-evaluation.test.ts`
10. `test/intelligence-adviser-strategy-contract.test.ts`
11. `test/intelligence-adviser-strategy-portfolio.test.ts`
12. `test/keep-the-signal-rule-based-adviser.test.ts`
13. `test/keep-the-signal-tactical-proposal.test.ts`
14. `docs/game/KTS-I4-E-TACTICAL-ADVISER-STRATEGY-PORTFOLIO-RESULT.md`

Repaired audit findings:

- **A-01:** an empty applicable-strategy selection now returns normal `abstention`, preserves the empty selection report, performs zero retrieval queries and bridge attempts, and carries no failure.
- **A-02:** proposal grounding now authorizes only strategies, memories, evidence, and request-authorized contradictions actually included in the final bounded context; packed-out references are rejected without widening budgets.
- **A-03:** the rule-based adviser captures an independent immutable snapshot of the exact eight validated baselines; later caller registration or disposal cannot broaden or disable its fixed strategy set.
- **A-04:** packet schema ID, packet schema version, requested observation level, request lineage, and adapter ID/version are validated against the accepted KTS-I4-C identity, and the canonical observation snapshot is used through applicability, validation, and evidence drafting.
- **A-05:** strategy identity and version ordering use explicit locale-independent UTF-16/code-unit lexical comparison.
- **A-06:** `selectedStrategy` accepts exactly `strategyId` and `strategyVersion`, with no additional field.
- **A-07:** invalid KTS proposal construction now raises the safe tactical-adviser failure `invalid_proposal` at `proposal_validation` without exposing the raw proposal.
- **A-08:** evaluation runtime validation now checks supported proposal-validation values, plain metric records, strategy-reference arrays and exact shapes, and JSON compatibility of proposal/decision/outcome values; malformed inputs map to `evaluation_invalid`.
- **H-01:** applicability supporting-evidence references now require unique valid public identities while observation field paths remain unique non-empty strings.

## Exact changed paths

The candidate consists of exactly these 30 new, untracked paths:

1. `app/features/intelligence-harness/tactical-adviser/adviser-contract.ts`
2. `app/features/intelligence-harness/tactical-adviser/proposal-contract.ts`
3. `app/features/intelligence-harness/tactical-adviser/strategy-contract.ts`
4. `app/features/intelligence-harness/tactical-adviser/strategy-portfolio.ts`
5. `app/features/intelligence-harness/tactical-adviser/context-contract.ts`
6. `app/features/intelligence-harness/tactical-adviser/context-builder.ts`
7. `app/features/intelligence-harness/tactical-adviser/adviser-coordinator.ts`
8. `app/features/intelligence-harness/tactical-adviser/evaluation-contract.ts`
9. `app/features/intelligence-harness/tactical-adviser/evaluation-aggregator.ts`
10. `app/features/intelligence-harness/tactical-adviser/failures.ts`
11. `app/features/intelligence-harness/tactical-adviser/index.ts`
12. `app/features/keep-the-signal/tactical-adviser/kts-proposal-contract.ts`
13. `app/features/keep-the-signal/tactical-adviser/kts-proposal-validator.ts`
14. `app/features/keep-the-signal/tactical-adviser/kts-strategy-portfolio.ts`
15. `app/features/keep-the-signal/tactical-adviser/kts-rule-based-adviser.ts`
16. `app/features/keep-the-signal/tactical-adviser/kts-model-context.ts`
17. `app/features/keep-the-signal/tactical-adviser/kts-adviser-evidence.ts`
18. `app/features/keep-the-signal/tactical-adviser/kts-adviser-adapter.ts`
19. `app/features/keep-the-signal/tactical-adviser/index.ts`
20. `test/intelligence-adviser-strategy-contract.test.ts`
21. `test/intelligence-adviser-strategy-portfolio.test.ts`
22. `test/intelligence-adviser-context-builder.test.ts`
23. `test/intelligence-adviser-coordinator.test.ts`
24. `test/intelligence-adviser-evaluation.test.ts`
25. `test/keep-the-signal-tactical-proposal.test.ts`
26. `test/keep-the-signal-tactical-validator.test.ts`
27. `test/keep-the-signal-rule-based-adviser.test.ts`
28. `test/keep-the-signal-tactical-adviser-evidence.test.ts`
29. `test/keep-the-signal-tactical-adviser-boundaries.test.ts`
30. `docs/game/KTS-I4-E-TACTICAL-ADVISER-STRATEGY-PORTFOLIO-RESULT.md`

No existing tracked path was modified.

## Identities and boundaries

- Adviser role: `signal_officer_tactical_adviser`, version `1`
- Prompt contract: `kts.signal-officer-prompt`, version `1`
- Strategy schema: `construct.strategy`, version `1`
- KTS tactical-proposal schema: `kts.tactical-proposal`, version `1`
- Evidence schema reused from KTS-I4-D: `construct.evidence`, version `1`
- Role reason limit: 600 characters
- Supported observation levels: 0 and 1
- Adviser authority: advisory only; action execution, authority claims, hidden-reasoning requests, and evidence suppression are prohibited

The generic core depends only on accepted model-bridge and memory-fabric contracts. The KTS adapter depends on the generic core and accepted KTS-I4-C observation adapter. It does not import KTS engine execution, runtime, presentation, player, routes, home, or React.

## Proposal contract

The strict KTS proposal contains exactly:

```text
proposalId
proposalSchemaId
proposalSchemaVersion
adviserRequestId
observationId
sourceStateDigest
intent
movement
fireRecommendation
powerTransferRecommendation
recoveryRecommendation
target
selectedStrategy
confidenceBasisPoints
uncertainty
abstention
reason
supportingFacts
evidenceReferences
contradictionReferences
warnings
```

Intent values:

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

Movement components are `-1`, `0`, or `1`, with `low`, `medium`, or `high` priority. Fire values are `fire_now`, `hold_fire`, `conditional`, and `not_applicable`. Recovery values are `activate_now`, `hold`, `conditional`, and `not_applicable`.

Power-transfer values are `none`, `defence_to_signal`, `defence_to_weapons`, `signal_to_defence`, `signal_to_weapons`, `weapons_to_defence`, and `weapons_to_signal`. Target kinds are `none`, `enemy`, `enemy_projectile`, and `area`; only entity targets carry an entity ID.

Confidence is an integer from 0 through 10,000 basis points. Uncertainty is `low`, `medium`, `high`, or `unknown`. Abstention is first class and uses the accepted seven abstention codes. Supporting facts are typed observation-field, entity, readiness, strategy, evidence, memory, or contradiction references. The concise reason is public explanatory text, not hidden reasoning.

## Strategy contract and portfolio

Generic families:

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

Classifications are `deterministic_baseline`, `experimental_candidate`, `accepted_production`, `rejected`, `quarantined`, and `superseded`. Classification is caller supplied. The portfolio does not infer production acceptance and exposes no promotion API.

Strategy records contain exact ID/version identity, domain lineage, family, objective, triggers, constraints, preferences, termination conditions, expected effects, failure modes, evidence and counterexample references, confidence, calibration, evaluations, parent lineage, caller priority, classification, caller time and actor, and an accepted canonical SHA-256 digest.

The portfolio is instance-local, in-memory, non-persistent, bounded by caller-supplied count and serialized-character budgets, idempotent only for byte-equivalent identities, mutation isolated, snapshot capable, and disposable.

Applicable candidates are ordered deterministically by:

1. applicable records only;
2. higher applicability basis points;
3. higher caller-supplied portfolio priority;
4. lexicographically lower strategy ID;
5. lexicographically lower strategy version.

## Initial deterministic KTS baselines

The exact fixed version-1 baseline set is:

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

Each baseline has explicit triggers, applicability constraints, expected effects, known failure modes, generic family, fixed preference, and `deterministic_baseline` classification. The rule-based adviser rejects any portfolio that differs from this fixed set and validates the accepted observation identity before advising.

The baseline is deterministic, uses no model, memory repository, clock, randomness, or action executor, and passes proposals through the same KTS validator. It does not infer a clear wave-advance path when enemy projection is truncated. It is a comparison instrument, not a claim of optimal play or a gameplay controller.

## Retrieval, context, and trust

All budgets are immutable and caller supplied. Context budgets separately bound messages, serialized characters, strategies, retrieved memories, evidence references, observation characters, public-reason characters, system-instruction characters, and developer-instruction characters. The KTS-I4-B invocation budget remains authoritative for input/output token and character declarations and permits exactly one attempt.

Retrieval is either explicitly disabled with zero result, character, and traversal budgets, or enabled with exact accepted KTS-I4-D memory and optional evidence queries. Enabled queries require an exact domain allowlist, valid classification and retention allowlists, positive result and character limits, and a non-negative relation traversal limit. Semantic retrieval and embeddings are not introduced. Retrieval failures fail closed without widening access.

Context is assembled through the accepted KTS-I4-D bounded working-memory API. Required system, developer, and observation items fail closed if omitted. Optional strategy, memory, and evidence omissions are reported. Supporting and contradictory evidence remain distinct records. Exact token counts are not claimed without provider evidence.

Message trust remains separated:

- `system`: fixed trusted adviser authority and safety rules;
- `developer`: fixed trusted schema and domain instructions;
- `context`: untrusted JSON-compatible observation, strategies, memory, and evidence;
- `user`: bounded trusted tactical request.

Instruction-like stored text remains untrusted context and cannot become system or developer authority.

## Invocation and result behavior

The coordinator invokes only the accepted KTS-I4-B `ModelInvocationCoordinator`. It passes the exact caller-selected provider and model, exact messages, exact invocation budget, strict structured-output contract, raw-failure policy, and out-of-band cancellation signal.

There is one bridge call and one allowed attempt. No retry, fallback, provider substitution, or model substitution exists. Bridge cancellation, deadline, malformed output, empty output, schema rejection, and safe underlying failure codes are mapped without raw malformed output disclosure by default.

Results are immutable and classified as `proposal`, `abstention`, `rejected`, `failed`, `cancelled`, or `deadline_exceeded`. Decoded provider output is canonically cloned before public return. The KTS adapter adds a generic proposal envelope and, only when caller governance is supplied, an evidence draft.

## Deterministic proposal validation

The KTS validator checks:

- strict schema identity, version, keys, enums, and values;
- proposal, request, observation, and source-digest lineage;
- the 600-character Signal Officer reason ceiling and tighter caller budget;
- target kind, target ID, and presence in the bounded observation;
- rejection of omitted entity IDs, including IDs absent because of truncation;
- `fire_now`, `activate_now`, and all six immediate transfer readiness conditions;
- selected strategy candidate membership and applicability;
- evidence, memory, contradiction, and strategy references against supplied context;
- typed observation facts against normalized observation values;
- high-confidence/high-or-unknown-uncertainty conflicts;
- abstention consistency and non-action-like abstention content.

It returns only `schema_valid`, `advisory_valid`, `advisory_rejected`, or `abstained`. It explicitly does not claim final engine legality.

## Evidence drafting

Proposal and evaluation evidence are immutable accepted KTS-I4-D evidence records returned to the caller as drafts. No repository write is available in adviser evidence code.

Proposal evidence preserves observation evidence identity when supplied, observation lineage, request and invocation identity, model or baseline identity, full supplied provider/model provenance, selected strategy and strategy references, retrieved memory, supporting evidence, contradiction references, proposal payload, validation classification, confidence, uncertainty, abstention, and caller governance metadata.

Evaluation evidence preserves the validated case, proposal evidence identity, adviser classification, validation result, matched identity, supplied decision and outcome evidence, metrics, evaluator identity/version, and limitations. Both evidence forms carry canonical digests and `persistencePerformed: false`.

## Evaluation

Supported adviser classifications:

```text
no_adviser
rule_based
base_model_no_retrieval
base_model_with_retrieval
fine_tuned_model
human_only
human_with_adviser
```

`fine_tuned_model` is compatibility vocabulary only; no fine-tuned model is trained or invoked.

Supported supplied-evidence metrics are schema compliance, advisory validity, abstention, unsupported reference, unsupported certainty, evidence grounding, strategy-reference validity, rejected/wasted recommendation, cancellation/deadline, diagnostic latency, Signal retained, Defence retained, coherence, score, wave completion, labelled success, and player usefulness. Human usefulness is derived only when a human rating is supplied. Confidence calibration is calculated only from labelled outcomes. Missing values remain unknown.

Matched comparisons require identical seed or episode family, engine and ruleset versions, observation schema and level, decision point, and partition. Differences are labelled `descriptive_only`; no causal improvement is claimed.

## Focused and scale tests

- Focused files: 10 passed of 10
- Focused named tests: 407 passed of 407
- Full repository files: 42 passed of 42
- Full repository tests: 1,391 passed of 1,391

Focused scale evidence:

- 10,000 immutable strategy records registered;
- 10,000 applicable strategies evaluated before bounded truncation;
- applicable candidate count explicitly exceeds the required 1,000;
- deterministic selection returned 10 candidates and reported truncation;
- 10,000 bounded evaluation cases aggregated;
- mixed supporting and contradictory evidence preserved;
- reduced and zero-memory context budgets exercised;
- the caller's five-memory accepted context budget exercised;
- repeated equivalent baseline requests produced equivalent proposals;
- independent concurrent coordinator requests completed without shared mutable result state.

Acceptance uses bounded deterministic results, not timing thresholds.

## Validation results

- `npx vitest run <exact ten focused files> --reporter=verbose`: PASS, 10 files and 407 tests
- `npm run test`: PASS, 42 files and 1,391 tests
- `npm run typecheck`: PASS, including Wrangler/React Router type generation, app TypeScript, and test TypeScript
- `npm run build`: PASS, client and SSR builds
  - client: 119 modules transformed
  - SSR: 116 modules transformed
- `npm run lint`: PASS with zero warnings
- `npm run format:check`: PASS
- `git diff --check`: PASS
- explicit trailing-whitespace scan over all implementation paths: PASS, no matches

Declared package-manager revalidation:

- `corepack npm --version`: PASS — `11.13.0`
- `corepack npm run test`: PASS — 42 files and 1,391 tests
- `corepack npm run typecheck`: PASS
- `corepack npm run build`: PASS — client 119 modules; SSR 116 modules
- `corepack npm run lint`: PASS with zero warnings
- `corepack npm run format:check`: PASS
- `git diff --check`: PASS

## Static and accepted-boundary validation

Production-source scans returned no matches for:

- prohibited network, storage, environment, dynamic-code, wall-clock, or randomness APIs;
- provider SDKs, credentials, remote endpoints, or model installation/download calls;
- direct D1 access, payload logging, or evidence/memory persistence mutation;
- KTS engine execution, runtime, presentation, player, routes, home, or React imports;
- gameplay action execution, strategy promotion/update/delete/persist, training, or fine-tuning calls;
- analytics, telemetry, background scheduling, or UI rendering.

Tracked-diff boundary validation returned no changes for:

- KTS-I4-B model bridge;
- KTS-I4-C observation adapter;
- KTS-I4-D memory fabric;
- KTS engine, runtime, presentation, and player;
- D1 adapter and SQL migrations;
- routes, home, and hero files;
- package and lock files;
- Wrangler, Vite, Vitest, TypeScript, worker, and deployment configuration.

The final working tree contains exactly the 30 authorized untracked paths and no tracked modification, staged change, or unrelated untracked path.

## Protected stash

- Stash ref: `116d212bc908ae45dae2a9465acfe765a2358a99`
- State: unchanged
- Protected contents:
  - added `app/components/hero-signal-memory.ts`
  - modified `app/components/hero-signal-webgl.ts`
  - modified `app/components/hero-signal.tsx`
  - added `test/hero-signal-memory.test.ts`

The stash was inspected read-only and was not applied, dropped, rewritten, or otherwise modified.

## Known limitations and explicit non-actions

No unresolved implementation defect was found after the Byte narrow repair and renewed direct source audit within the accepted KTS-I4-E boundary. Formal implementation acceptance remains pending Nolan approval against the exact implementation commit. The remaining limitations are intentional contract boundaries:

- no live provider adapter, provider SDK, endpoint, credential, model installation, model download, or live inference was added or called;
- model-path tests use only deterministic in-file test adapters;
- no runtime, UI, route, home, player, or gameplay-control integration exists;
- no adviser-initiated or live gameplay action was executed; final legality remains solely with a later separately invoked engine action boundary;
- no evidence or memory was persisted; drafts require a separate explicit caller action;
- no strategy was promoted, updated, deleted, or persisted;
- no consolidation, forgetting, deletion, training, fine-tuning, deployment, publication, or infrastructure activation occurred;
- evaluation reports are bounded and descriptive, not causal claims;
- the fixed rule baseline is a comparison instrument, not a claim of optimal play.

No path was staged or committed. No branch, history, remote, or stash mutation occurred.

Proposed later commit message, if separately authorized:

```text
feat(signal): add KTS-I4-E tactical adviser
```

---

## Final eligibility classification

```text
Contract acceptance:                       PASS
Implementation authorization:              PASS
Codex implementation delivery:              COMPLETE
Initial Byte source audit:                  NARROW REPAIR REQUIRED
Narrow repair:                              COMPLETE
Renewed Byte source audit:                  PASS
Actual authorized candidate files:          30/30
Focused deterministic tests:                407/407 PASS
Complete repository tests:                  1,391/1,391 PASS
Repository test files:                      42/42 PASS
Declared npm 11.13.0 validation:             PASS
Strategy and evaluation scale cases:        PASS
Typecheck:                                  PASS
Client production build:                    PASS
SSR production build:                       PASS
Lint:                                       PASS
Format:                                     PASS
Diff and whitespace checks:                 PASS
Static prohibited scans:                    PASS
Accepted subsystem boundaries:              PRESERVED
Protected hero stash:                       PRESERVED
Live provider or model invocation:           none
Gameplay action execution:                  none
Evidence or memory persistence:              none
Strategy promotion:                         none
Consolidation or deletion:                   none
Training or fine-tuning:                     none
Push, merge, or deployment:                  none
Observed unresolved implementation defects: none
Classification:                             successful_implementation_validation
```

KTS-I4-E is eligible for formal implementation acceptance after the exact 30 authorized paths are committed and the resulting checkpoint is verified.

The exact acceptance phrase is:

```text
ACCEPT KTS-I4-E IMPLEMENTATION
```

Acceptance does not authorize push, pull-request creation, merge, deployment, live provider integration or invocation, runtime or UI integration, gameplay action execution, evidence or memory persistence, strategy promotion, consolidation, deletion, training, or fine-tuning.

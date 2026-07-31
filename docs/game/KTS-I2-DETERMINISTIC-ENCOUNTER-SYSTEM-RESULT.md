# Keep the Signal — KTS-I2 Deterministic Encounter System Result

**Document ID:** `KTS-I2-RESULT`
**Release:** `KTS-I2`
**Implementation base commit:** `2e558b341dc61484126b5cb40f7f89fd4c1d8cf7`
**Target branch:** `game/keep-the-signal-i2-deterministic-encounters`
**Validation date:** `2026-07-31`
**Status:** Accepted by Nolan and Byte; commit authorized
**Committed:** No

---

## 1. Result

KTS-I2 extends the accepted KTS-I1 fixed-step headless engine with a finite deterministic encounter system.

The implementation candidate includes:

- five deterministic waves;
- sixty scheduled enemies;
- Scout, Interceptor, and Disruptor archetypes;
- seeded archetype and spawn-position selection;
- deterministic enemy movement and firing;
- enemy-projectile movement, expiry, and capacity handling;
- integer squared-distance collision resolution;
- enemy damage, destruction, scoring, and escape;
- Defence and Signal damage routing;
- wave intermissions and encounter completion;
- structured encounter events;
- canonical encounter serialization and digest coverage;
- same-seed replay equivalence;
- different-seed divergence;
- a permanent 7,200-frame canonical fixture.

All required executable gates shown in the final validation run passed.

This document records the validated implementation evidence and Nolan’s explicit implementation acceptance. The implementation is authorized for the exact commit scope recorded below.

---

## 2. Changed paths

### 2.1 Created runtime files

- `app/features/keep-the-signal/engine/collisions.ts`
- `app/features/keep-the-signal/engine/encounters.ts`
- `app/features/keep-the-signal/engine/enemies.ts`

### 2.2 Modified runtime files

- `app/features/keep-the-signal/engine/constants.ts`
- `app/features/keep-the-signal/engine/events.ts`
- `app/features/keep-the-signal/engine/game-engine.ts`
- `app/features/keep-the-signal/engine/game-state.ts`
- `app/features/keep-the-signal/engine/index.ts`

### 2.3 Created test files

- `test/keep-the-signal-encounter-state.test.ts`
- `test/keep-the-signal-encounter-dynamics.test.ts`
- `test/keep-the-signal-encounter-determinism.test.ts`

### 2.4 Modified test files

- `test/keep-the-signal-engine-state.test.ts`
- `test/keep-the-signal-engine-determinism.test.ts`

### 2.5 Created result document

- `docs/game/KTS-I2-DETERMINISTIC-ENCOUNTER-SYSTEM-RESULT.md`

### 2.6 Authorized files not modified

- `app/features/keep-the-signal/engine/simulation.ts`
- `test/keep-the-signal-engine-dynamics.test.ts`

No modification was required in either path.

---

## 3. Commands executed

The final validation matrix included:

```powershell
npx vitest run `
    .\test\keep-the-signal-engine-state.test.ts `
    .\test\keep-the-signal-engine-dynamics.test.ts `
    .\test\keep-the-signal-engine-determinism.test.ts `
    .\test\keep-the-signal-encounter-state.test.ts `
    .\test\keep-the-signal-encounter-dynamics.test.ts `
    .\test\keep-the-signal-encounter-determinism.test.ts
```

```powershell
npm run test
npm run typecheck
npm run build
npm run lint
```

```powershell
npx prettier `
    .\app\features\keep-the-signal\engine\collisions.ts `
    .\app\features\keep-the-signal\engine\constants.ts `
    .\app\features\keep-the-signal\engine\encounters.ts `
    .\app\features\keep-the-signal\engine\enemies.ts `
    .\app\features\keep-the-signal\engine\events.ts `
    .\app\features\keep-the-signal\engine\game-engine.ts `
    .\app\features\keep-the-signal\engine\game-state.ts `
    .\app\features\keep-the-signal\engine\index.ts `
    .\test\keep-the-signal-engine-state.test.ts `
    .\test\keep-the-signal-engine-determinism.test.ts `
    .\test\keep-the-signal-encounter-state.test.ts `
    .\test\keep-the-signal-encounter-dynamics.test.ts `
    .\test\keep-the-signal-encounter-determinism.test.ts `
    --check
```

```powershell
Select-String `
    -Path ".\app\features\keep-the-signal\engine\*.ts" `
    -Pattern "Math\.random|Date\.now|new Date|performance\.now|crypto\.getRandomValues|requestAnimationFrame|setTimeout|setInterval|localStorage|sessionStorage|fetch|XMLHttpRequest|WebSocket"

git diff -- package.json package-lock.json npm-shrinkwrap.json
git diff --check
git status --short --untracked-files=all
```

Additional focused and single-suite runs were used while implementing and calibrating individual slices.

---

## 4. Focused test result

Final focused KTS-I1 and KTS-I2 run:

| Test file                                       |   Tests | Result     |
| ----------------------------------------------- | ------: | ---------- |
| `keep-the-signal-engine-state.test.ts`          |      36 | Passed     |
| `keep-the-signal-engine-dynamics.test.ts`       |      34 | Passed     |
| `keep-the-signal-engine-determinism.test.ts`    |      21 | Passed     |
| `keep-the-signal-encounter-state.test.ts`       |      42 | Passed     |
| `keep-the-signal-encounter-dynamics.test.ts`    |      67 | Passed     |
| `keep-the-signal-encounter-determinism.test.ts` |       5 | Passed     |
| **Total**                                       | **205** | **Passed** |

KTS-I2 created `114` named encounter tests across its three new test files, exceeding the contract minimum of `45`.

All accepted KTS-I1 tests remained passing.

---

## 5. Complete repository test result

Final repository run:

- Test files: `7 passed`
- Tests: `210 passed`
- Failures: `0`

The total includes the five existing runtime-binding tests in addition to the 205 focused KTS tests.

---

## 6. Typecheck result

`npm run typecheck` passed.

The command completed:

- Cloudflare/Wrangler runtime type generation;
- React Router type generation;
- application TypeScript checking;
- test TypeScript checking.

No TypeScript error was reported.

---

## 7. Lint result

`npm run lint` passed with:

```text
eslint . --max-warnings=0
```

No warning or error was reported.

---

## 8. Build result

`npm run build` passed.

Both production targets completed:

- Vite client environment;
- Vite SSR environment.

No build error was reported.

---

## 9. Formatting result

KTS runtime and test paths were checked with Prettier and reported:

```text
All matched files use Prettier code style!
```

The final permanent encounter-determinism fixture was also formatted directly with `prettier --write` before its successful test runs.

One PowerShell command transcript rendered the two adjacent existing test paths as one concatenated argument. Those two files had already been independently checked together with Prettier after their last modification, and neither changed during the later permanent-fixture replacement. This command-entry quirk did not conceal a formatting failure.

---

## 10. Static nondeterminism result

The authorized engine directory was scanned for:

- `Math.random`
- `Date.now`
- `new Date`
- `performance.now`
- `crypto.getRandomValues`
- `requestAnimationFrame`
- `setTimeout`
- `setInterval`
- `localStorage`
- `sessionStorage`
- `fetch`
- `XMLHttpRequest`
- `WebSocket`

The scan produced no matches.

---

## 11. Dependency review

The following dependency files were reviewed:

- `package.json`
- `package-lock.json`
- `npm-shrinkwrap.json`

`git diff` produced no dependency changes.

No dependency was added or modified.

---

## 12. Authorized-file review

The final working tree before creating this result document contained only authorized KTS-I2 runtime and test paths:

```text
 M app/features/keep-the-signal/engine/constants.ts
 M app/features/keep-the-signal/engine/events.ts
 M app/features/keep-the-signal/engine/game-engine.ts
 M app/features/keep-the-signal/engine/game-state.ts
 M app/features/keep-the-signal/engine/index.ts
 M test/keep-the-signal-engine-determinism.test.ts
 M test/keep-the-signal-engine-state.test.ts
?? app/features/keep-the-signal/engine/collisions.ts
?? app/features/keep-the-signal/engine/encounters.ts
?? app/features/keep-the-signal/engine/enemies.ts
?? test/keep-the-signal-encounter-determinism.test.ts
?? test/keep-the-signal-encounter-dynamics.test.ts
?? test/keep-the-signal-encounter-state.test.ts
```

After this document is placed in the repository, the authorized result-document path is expected to appear as one additional untracked path.

No route, component, styling, audio, persistence, deployment, package, hero, or landing-page file was modified.

The implementation remains uncommitted.

---

## 13. Canonical fixture configuration

| Field                     |        Value |
| ------------------------- | -----------: |
| Seed                      | `1987041211` |
| Maximum frames            |       `7200` |
| Processed ticks           |       `7200` |
| Expected digest           |   `58211ef2` |
| Final status              |    `running` |
| Terminal reason           |       `null` |
| Encounter phase           |   `complete` |
| Final wave                |          `5` |
| Final Signal integrity    |       `9610` |
| Final Defence integrity   |      `10000` |
| Final score               |     `107342` |
| Total enemies defeated    |         `59` |
| Total enemies escaped     |          `1` |
| Kinetic hits on player    |          `4` |
| Corruption hits on player |          `8` |
| Applied power shifts      |          `6` |
| Rejected actions          |       `3593` |
| Player projectiles fired  |        `372` |
| Recovery pulses applied   |          `1` |

Wave starts and completions were both:

```text
1, 2, 3, 4, 5
```

Spawned archetype totals were:

| Archetype   |  Count |
| ----------- | -----: |
| Scout       |   `31` |
| Interceptor |   `18` |
| Disruptor   |   `11` |
| **Total**   | **60** |

The fixture demonstrated same-seed byte-identical canonical state, event-sequence equality, digest equality, and different-seed divergence.

---

## 14. Fixture event counts

| Event                         | Count |
| ----------------------------- | ----: |
| `action_rejected`             |  3593 |
| `defence_damaged`             |     5 |
| `defence_recovered`           |  1343 |
| `encounter_completed`         |     1 |
| `enemy_damaged`               |    99 |
| `enemy_destroyed`             |    59 |
| `enemy_escaped`               |     1 |
| `enemy_fired`                 |    67 |
| `enemy_projectile_expired`    |    55 |
| `enemy_projectile_hit_player` |    12 |
| `enemy_score_awarded`         |    59 |
| `enemy_spawned`               |    60 |
| `player_projectile_hit_enemy` |    99 |
| `power_shift_applied`         |     6 |
| `projectile_expired`          |   273 |
| `projectile_fired`            |   372 |
| `recovery_pulse_applied`      |     1 |
| `score_added`                 |  7200 |
| `signal_damaged`              |     8 |
| `signal_recovered`            |  3218 |
| `wave_completed`              |     5 |
| `wave_started`                |     4 |

Wave 1 is active in the initial state, so structured `wave_started` events are emitted only for Waves 2 through 5.

---

## 15. Final canonical state

```json
{
  "engineVersion": "kts-i2.0.0",
  "rulesetVersion": "kts-foundation-0.1",
  "seed": 1987041211,
  "rngState": 2583674287,
  "tick": 7200,
  "status": "running",
  "terminalReason": null,
  "score": 107342,
  "currentCoherenceTicks": 7200,
  "longestCoherenceTicks": 7200,
  "player": {
    "positionX": 96220,
    "positionY": 800000,
    "velocityX": -3800,
    "velocityY": 0,
    "radius": 18000
  },
  "power": { "weapons": 49, "defence": 28, "signal": 23, "shiftCooldownTicks": 0 },
  "weapon": { "fireCooldownTicks": 0, "nextProjectileId": 373 },
  "recoveryPulse": { "cooldownTicks": 0 },
  "defence": { "integrity": 10000, "ticksSinceDamage": 992, "recoveryRemainder": 0 },
  "signal": {
    "integrity": 9610,
    "ticksSinceDamage": 1250,
    "collapseTicks": 0,
    "recoveryRemainder": 42,
    "interferenceDamageRemainder": 0
  },
  "interference": { "load": 0 },
  "projectiles": [],
  "encounter": {
    "phase": "complete",
    "waveNumber": 5,
    "phaseTicks": 0,
    "spawnCooldownTicks": 0,
    "enemiesScheduled": 16,
    "enemiesSpawned": 16,
    "enemiesDefeated": 16,
    "enemiesEscaped": 0,
    "totalEnemiesDefeated": 59,
    "totalEnemiesEscaped": 1,
    "nextEnemyId": 61,
    "nextEnemyProjectileId": 68
  },
  "enemies": [],
  "enemyProjectiles": []
}
```

---

## 16. Final digest

```text
58211ef2
```

The digest is the accepted eight-character FNV-1a state regression digest produced by the completed implementation.

---

## 17. Deviations

### 17.1 Runtime contract deviations

None identified.

### 17.2 Authorized files not changed

Although `simulation.ts` was authorized, the existing simulation runner already supported the required deterministic fixture and did not require modification.

### 17.3 KTS-I1 determinism-test compatibility repair

The existing KTS-I1 canonical fixture originally counted all `defence_damaged` and corruption `signal_damaged` events. KTS-I2 legitimately introduced additional encounter-generated damage events.

The test was narrowed by structured `sourceId` so its original assertion continues to count only its scripted environment impact and direct corruption. Runtime behaviour and event production were not weakened.

### 17.4 Canonical fixture calibration

The first 7,200-frame fixture-controller pass left three Wave 5 Disruptors unresolved because the controller continued selecting enemies after they had moved below the player-projectile firing line.

The fixture controller was calibrated to:

- exclude enemies no longer reachable by player projectiles;
- stop protecting projectile witnesses once unreachable;
- fire aggressively after required witness outcomes were secured;
- allocate additional deterministic power to Weapons.

No runtime implementation was changed during calibration.

The calibrated fixture completed all five waves and generated the permanently locked digest and state recorded above.

---

## 18. Limitations

KTS-I2 remains intentionally headless.

It does not include:

- browser controls;
- rendering;
- visual or audio presentation;
- menus;
- accessibility UI;
- persistence;
- replay storage;
- networking;
- adaptive learning;
- language-model integration;
- player modelling;
- deployment changes.

The canonical fixture is a deterministic regression and contract-conformance scenario. It is not evidence of final game balance, player experience, difficulty tuning, visual quality, or production UI behaviour.

The eight-character FNV-1a digest is a deterministic regression identifier, not a cryptographic integrity primitive.

The high fixture rejection count is produced by its deliberately aggressive scripted firing behaviour and should not be interpreted as a gameplay-balance target.

---

## 19. Unresolved concerns

No blocking correctness concern is known from the completed validation matrix.

Future slices must not infer that KTS-I2 has validated rendering, input latency, browser integration, gameplay balance, accessibility, audio, persistence, or player-facing usability.

---

## 20. Acceptance state

**Implementation review:** Completed by Nolan and Byte
**Nolan implementation acceptance:** `ACCEPT KTS-I2 IMPLEMENTATION`
**Acceptance timestamp:** `2026-07-31T09:52:00+02:00`
**Commit authorized:** Yes, for the exact validated KTS-I2 scope
**Implementation remains uncommitted:** Yes, until the authorized commit is created

Nolan issued the exact implementation-acceptance token after reviewing the completed validation evidence. This acceptance authorizes staging and committing only the validated KTS-I2 paths listed in this document.

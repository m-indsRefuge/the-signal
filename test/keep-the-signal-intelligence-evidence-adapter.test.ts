import adapterSource from "../app/features/keep-the-signal/intelligence-memory/evidence-adapter.ts?raw";
import { describe, expect, it } from "vitest";
import type { KtsObservationPacket } from "../app/features/keep-the-signal/intelligence-adapter";
import { createKtsObservationEvidence } from "../app/features/keep-the-signal/intelligence-memory/evidence-adapter";
function observation(level: 0 | 1 = 0): KtsObservationPacket {
  return {
    metadata: {
      observationId: `obs:${level}`,
      observationSchemaId: "kts.observation",
      observationSchemaVersion: 1,
      adapterId: "keep-the-signal",
      adapterVersion: "KTS-I4-C",
      requestedLevel: level,
      sourceStateDigest: "deadbeef",
      engineVersion: "kts-i2.0.0",
      rulesetVersion: "kts-foundation-0.1",
      seed: 7,
      tick: 42,
    },
    level,
    lifecycle: {
      status: "running",
      terminalReason: null,
      encounterPhase: "active",
      encounterComplete: false,
      tick: 42,
    },
    player: {
      positionX: 1,
      positionY: 2,
      velocityX: 0,
      velocityY: 0,
      radius: 1,
      moving: false,
      horizontalDirection: 0,
      verticalDirection: 0,
    },
    resources: {
      power: { weapons: 34, defence: 33, signal: 33, shiftCooldownTicks: 0 },
      defence: { integrity: 10000, ticksSinceDamage: 0, integrityBasisPoints: 10000 },
      signal: {
        integrity: 10000,
        ticksSinceDamage: 0,
        collapseTicks: 0,
        integrityBasisPoints: 10000,
      },
      interference: { load: 0, loadBasisPoints: 0 },
    },
    cooldowns: { fireCooldownTicks: 0, powerShiftCooldownTicks: 0, recoveryPulseCooldownTicks: 0 },
    encounter: {
      phase: "active",
      waveNumber: 1,
      phaseTicks: 0,
      spawnCooldownTicks: 0,
      enemiesScheduled: 8,
      enemiesSpawned: 0,
      enemiesDefeated: 0,
      enemiesEscaped: 0,
      totalEnemiesDefeated: 0,
      totalEnemiesEscaped: 0,
    },
    entities: { playerProjectiles: [], enemies: [], enemyProjectiles: [] },
    recentEvents: [],
    actionSpace: {
      vocabulary: {
        movement: { moveX: [-1, 0, 1], moveY: [-1, 0, 1] },
        fire: "boolean",
        recoveryPulse: "boolean",
        powerShift: [],
      },
      readiness: {
        fireReady: true,
        recoveryPulseReady: true,
        powerShiftReady: true,
        powerShiftOptions: [],
      },
      constraints: {
        fireCooldownTicks: 0,
        recoveryPulseCooldownTicks: 0,
        powerShiftCooldownTicks: 0,
        currentPlayerProjectileCount: 0,
        maximumPlayerProjectiles: 64,
        totalPower: 100,
        minimumChannelPower: 10,
        maximumChannelPower: 70,
        shiftIncrement: 5,
        channelAllocations: { weapons: 34, defence: 33, signal: 33 },
      },
    },
    projection: {
      requested: {
        maximumPlayerProjectiles: 0,
        maximumEnemies: 0,
        maximumEnemyProjectiles: 0,
        maximumRecentEvents: 0,
        maximumEventAgeTicks: 0,
        maximumSerializedCharacters: 10000,
      },
      entities: {
        playerProjectiles: {
          sourceCount: 0,
          includedCount: 0,
          omittedCount: 0,
          truncated: false,
          selectionPolicy: "id",
        },
        enemies: {
          sourceCount: 0,
          includedCount: 0,
          omittedCount: 0,
          truncated: false,
          selectionPolicy: "nearest",
        },
        enemyProjectiles: {
          sourceCount: 0,
          includedCount: 0,
          omittedCount: 0,
          truncated: false,
          selectionPolicy: "nearest",
        },
      },
      events: {
        sourceCount: 0,
        eligibleCount: 0,
        includedCount: 0,
        omittedByAge: 0,
        omittedByCount: 0,
        omittedCount: 0,
        truncated: false,
        maximumRecentEvents: 0,
        maximumEventAgeTicks: 0,
        effectiveStartTick: 42,
        selectionPolicy: "newest_eligible_stable_chronological",
      },
    },
    ...(level === 1
      ? {
          summary: {
            enemyCountsByArchetype: { scout: 0, striker: 0, corruptor: 0 },
            enemyProjectileCountsByKind: { kinetic: 0, corruption: 0 },
            playerProjectileCount: 0,
            currentWaveResolvedCount: 0,
            currentWaveRemainingCount: 8,
            encounterTotalResolvedCount: 0,
            waveProgressBasisPoints: 0,
            fireReady: true,
            powerShiftReady: true,
            recoveryPulseReady: true,
            nearestEnemy: null,
            nearestEnemyProjectile: null,
            activeEntityCounts: {
              source: { playerProjectiles: 0, enemies: 0, enemyProjectiles: 0 },
              included: { playerProjectiles: 0, enemies: 0, enemyProjectiles: 0 },
            },
            recentEventCountsByType: {},
          },
        }
      : {}),
  } as unknown as KtsObservationPacket;
}
const governance = {
  evidenceId: "evidence:kts:1",
  recordedAt: "2026-08-01T12:00:00.000Z",
  acceptanceState: "accepted" as const,
  classification: "internal" as const,
  retentionClass: "standard" as const,
  tags: ["kts"],
};
describe("KTS-I4-D KTS observation evidence adapter", () => {
  it("accepts Level 0", async () =>
    expect((await createKtsObservationEvidence(observation(0), governance)).sourceIdentity).toBe(
      "obs:0",
    ));
  it("accepts Level 1", async () =>
    expect((await createKtsObservationEvidence(observation(1), governance)).sourceIdentity).toBe(
      "obs:1",
    ));
  it("sets domain identity", async () =>
    expect((await createKtsObservationEvidence(observation(), governance)).domainId).toBe(
      "keep-the-signal",
    ));
  it("sets source schema identity", async () =>
    expect((await createKtsObservationEvidence(observation(), governance)).sourceSchemaId).toBe(
      "kts.observation",
    ));
  it("preserves seed", async () =>
    expect(
      (await createKtsObservationEvidence(observation(), governance)).authoritativePosition.seed,
    ).toBe(7));
  it("preserves tick", async () =>
    expect(
      (await createKtsObservationEvidence(observation(), governance)).authoritativePosition.tick,
    ).toBe(42));
  it("preserves source-state digest", async () =>
    expect(
      (await createKtsObservationEvidence(observation(), governance)).authoritativePosition
        .sourceStateDigest,
    ).toBe("deadbeef"));
  it("preserves engine version", async () =>
    expect(
      (await createKtsObservationEvidence(observation(), governance)).authoritativePosition
        .engineVersion,
    ).toBe("kts-i2.0.0"));
  it("preserves ruleset version", async () =>
    expect(
      (await createKtsObservationEvidence(observation(), governance)).authoritativePosition
        .rulesetVersion,
    ).toBe("kts-foundation-0.1"));
  it("preserves complete observation payload", async () =>
    expect((await createKtsObservationEvidence(observation(), governance)).payload).toEqual(
      observation(),
    ));
  it("preserves caller classification", async () =>
    expect((await createKtsObservationEvidence(observation(), governance)).classification).toBe(
      "internal",
    ));
  it("preserves caller retention", async () =>
    expect((await createKtsObservationEvidence(observation(), governance)).retentionClass).toBe(
      "standard",
    ));
  it("creates SHA-256 evidence digest", async () =>
    expect((await createKtsObservationEvidence(observation(), governance)).contentDigest).toMatch(
      /^[a-f0-9]{64}$/,
    ));
  it("rejects unsupported schema version", async () =>
    await expect(
      createKtsObservationEvidence(
        {
          ...observation(),
          metadata: { ...observation().metadata, observationSchemaVersion: 2 },
        } as never,
        governance,
      ),
    ).rejects.toThrow());
  it("rejects malformed observation identity", async () =>
    await expect(
      createKtsObservationEvidence(
        {
          ...observation(),
          metadata: { ...observation().metadata, observationId: "bad id" },
        } as never,
        governance,
      ),
    ).rejects.toThrow());
  it("does not mutate observation", async () => {
    const source = observation();
    const before = JSON.stringify(source);
    await createKtsObservationEvidence(source, governance);
    expect(JSON.stringify(source)).toBe(before);
  });
  it("does not write to a repository", () => expect(adapterSource).not.toMatch(/putEvidence\s*\(/));
  it("contains no engine import", () =>
    expect(adapterSource).not.toMatch(/from\s+["'][^"']*\/engine/));
  it("contains no runtime, presentation, player, route, or React import", () =>
    expect(adapterSource).not.toMatch(/runtime|presentation|player|routes|react/i));
  it("contains no model invocation", () =>
    expect(adapterSource).not.toMatch(/invokeModel|invocationCoordinator|provider/i));
});

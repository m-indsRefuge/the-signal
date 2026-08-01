import { ENGINE_CONSTANTS, type GameState, type PowerChannel } from "../engine";
import {
  deepFreezeKtsValue,
  type KtsActionSpaceObservation,
  type KtsPowerShiftReadiness,
  type KtsPowerShiftVocabularyEntry,
} from "./observation-contract";

const POWER_CHANNELS: readonly PowerChannel[] = Object.freeze(["weapons", "defence", "signal"]);

export const KTS_POWER_SHIFT_VOCABULARY: readonly KtsPowerShiftVocabularyEntry[] = Object.freeze(
  POWER_CHANNELS.flatMap((from) =>
    POWER_CHANNELS.filter((to) => to !== from).map((to) => Object.freeze({ from, to })),
  ),
);

export function projectKtsActionSpace(
  state: Readonly<GameState>,
): Readonly<KtsActionSpaceObservation> {
  const powerShiftOptions = KTS_POWER_SHIFT_VOCABULARY.map(({ from, to }) =>
    projectPowerShiftReadiness(state, from, to),
  );

  const fireReady =
    state.weapon.fireCooldownTicks === 0 &&
    state.projectiles.length < ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES;

  const recoveryPulseReady = state.recoveryPulse.cooldownTicks === 0;
  const powerShiftReady = powerShiftOptions.some((option) => option.ready);

  return deepFreezeKtsValue({
    vocabulary: {
      movement: {
        moveX: [-1, 0, 1],
        moveY: [-1, 0, 1],
      },
      fire: "boolean",
      recoveryPulse: "boolean",
      powerShift: KTS_POWER_SHIFT_VOCABULARY.map(({ from, to }) => ({
        from,
        to,
      })),
    },
    readiness: {
      fireReady,
      recoveryPulseReady,
      powerShiftReady,
      powerShiftOptions,
    },
    constraints: {
      fireCooldownTicks: state.weapon.fireCooldownTicks,
      recoveryPulseCooldownTicks: state.recoveryPulse.cooldownTicks,
      powerShiftCooldownTicks: state.power.shiftCooldownTicks,
      currentPlayerProjectileCount: state.projectiles.length,
      maximumPlayerProjectiles: ENGINE_CONSTANTS.MAX_ACTIVE_PROJECTILES,
      totalPower: ENGINE_CONSTANTS.TOTAL_POWER,
      minimumChannelPower: ENGINE_CONSTANTS.MIN_CHANNEL_POWER,
      maximumChannelPower: ENGINE_CONSTANTS.MAX_CHANNEL_POWER,
      shiftIncrement: ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT,
      channelAllocations: {
        weapons: state.power.weapons,
        defence: state.power.defence,
        signal: state.power.signal,
      },
    },
  });
}

export function projectPowerShiftReadiness(
  state: Readonly<GameState>,
  from: PowerChannel,
  to: PowerChannel,
): Readonly<KtsPowerShiftReadiness> {
  let blockingReason: KtsPowerShiftReadiness["blockingReason"] = null;

  if (state.power.shiftCooldownTicks > 0) {
    blockingReason = "cooldown_active";
  } else if (
    state.power[from] - ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT <
    ENGINE_CONSTANTS.MIN_CHANNEL_POWER
  ) {
    blockingReason = "power_floor";
  } else if (
    state.power[to] + ENGINE_CONSTANTS.POWER_SHIFT_INCREMENT >
    ENGINE_CONSTANTS.MAX_CHANNEL_POWER
  ) {
    blockingReason = "power_ceiling";
  }

  return deepFreezeKtsValue({
    from,
    to,
    ready: blockingReason === null,
    blockingReason,
  });
}

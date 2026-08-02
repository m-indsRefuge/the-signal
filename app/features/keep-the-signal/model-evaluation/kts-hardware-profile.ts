import {
  createHardwareSnapshot,
  type HardwareSnapshot,
} from "../../intelligence-harness/model-evaluation";

export function createKtsHardwareProfile(
  input: Parameters<typeof createHardwareSnapshot>[0],
): HardwareSnapshot {
  return createHardwareSnapshot(input);
}

import { digestCanonical, immutableCopy } from "../../intelligence-harness/model-evaluation";

export type KtsObservationProjection = Readonly<{
  tick: number;
  signalIntegrity: number;
  transmissionPower: number;
  defencePower: number;
  weaponPower: number;
  position: Readonly<{ x: number; y: number }>;
  threats: readonly Readonly<{ id: string; distance: number; severity: number }>[];
  projectionDigest: string;
}>;

export function projectKtsObservation(
  input: Omit<KtsObservationProjection, "projectionDigest">,
): KtsObservationProjection {
  const core = {
    ...input,
    threats: [...input.threats].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
  return immutableCopy({
    ...core,
    projectionDigest: digestCanonical(core),
  }) as KtsObservationProjection;
}

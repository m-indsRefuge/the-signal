import { digestCanonical } from "./admission-contract";
import type { NormalizedSample } from "./sample-contract";

export function computeSampleDigest(sample: Omit<NormalizedSample, "sampleDigest">): string {
  return digestCanonical(sample);
}

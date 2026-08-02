import { digestCanonical } from "./admission-contract";
import type { DatasetManifest } from "./manifest-contract";

export function computeManifestDigest(manifest: Omit<DatasetManifest, "manifestDigest">): string {
  return digestCanonical(manifest);
}

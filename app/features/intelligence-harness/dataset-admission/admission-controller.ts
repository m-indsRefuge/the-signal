import { immutableCopy, requireSafeInteger } from "./admission-contract";
import type { AdmissionDecision } from "./admission-decision";
import { fail } from "./failures";
import { buildDatasetManifest, type ManifestBuildInput } from "./manifest-builder";
import type { DatasetManifest } from "./manifest-contract";
import type { NormalizedSample } from "./sample-contract";

export const MAX_CONTROLLER_DECISIONS = 10_000;
export const MAX_CONTROLLER_MANIFESTS = 64;

export class AdmissionController {
  private disposed = false;
  private readonly decisions = new Map<string, AdmissionDecision>();
  private readonly samples = new Map<string, NormalizedSample>();
  private readonly manifests = new Map<string, DatasetManifest>();

  private assertActive(): void {
    if (this.disposed) {
      fail("controller_disposed", "admission controller is disposed");
    }
  }

  register(decision: AdmissionDecision, sample?: NormalizedSample): AdmissionDecision {
    this.assertActive();
    requireSafeInteger(this.decisions.size + 1, "decision count", 0);
    if (
      !this.decisions.has(decision.decisionId) &&
      this.decisions.size >= MAX_CONTROLLER_DECISIONS
    ) {
      fail("record_budget_exceeded", "controller decision budget exceeded");
    }
    const existing = this.decisions.get(decision.decisionId);
    if (existing && existing.decisionDigest !== decision.decisionDigest) {
      fail("duplicate_identity_conflict", "decision identity conflict");
    }
    this.decisions.set(decision.decisionId, immutableCopy(decision));
    if (sample) {
      const existingSample = this.samples.get(sample.sampleId);
      if (existingSample && existingSample.sampleDigest !== sample.sampleDigest) {
        fail("duplicate_identity_conflict", "sample identity conflict");
      }
      this.samples.set(sample.sampleId, immutableCopy(sample));
    }
    return immutableCopy(decision) as AdmissionDecision;
  }

  listDecisions(): readonly AdmissionDecision[] {
    this.assertActive();
    return immutableCopy(
      [...this.decisions.values()].sort((a, b) =>
        a.decisionId < b.decisionId ? -1 : a.decisionId > b.decisionId ? 1 : 0,
      ),
    ) as readonly AdmissionDecision[];
  }

  listSamples(): readonly NormalizedSample[] {
    this.assertActive();
    return immutableCopy(
      [...this.samples.values()].sort((a, b) =>
        a.sampleId < b.sampleId ? -1 : a.sampleId > b.sampleId ? 1 : 0,
      ),
    ) as readonly NormalizedSample[];
  }

  buildManifest(input: Omit<ManifestBuildInput, "decisions" | "samples">): DatasetManifest {
    this.assertActive();
    if (!this.manifests.has(input.manifestId) && this.manifests.size >= MAX_CONTROLLER_MANIFESTS) {
      fail("record_budget_exceeded", "controller manifest budget exceeded");
    }
    const manifest = buildDatasetManifest({
      ...input,
      decisions: this.listDecisions(),
      samples: this.listSamples(),
    });
    const existing = this.manifests.get(manifest.manifestId);
    if (existing && existing.manifestDigest !== manifest.manifestDigest) {
      fail("duplicate_identity_conflict", "manifest identity conflict");
    }
    this.manifests.set(manifest.manifestId, immutableCopy(manifest));
    return immutableCopy(manifest) as DatasetManifest;
  }

  snapshot(): Readonly<{
    decisions: readonly AdmissionDecision[];
    samples: readonly NormalizedSample[];
    manifests: readonly DatasetManifest[];
  }> {
    this.assertActive();
    return immutableCopy({
      decisions: this.listDecisions(),
      samples: this.listSamples(),
      manifests: [...this.manifests.values()].sort((a, b) =>
        a.manifestId < b.manifestId ? -1 : a.manifestId > b.manifestId ? 1 : 0,
      ),
    });
  }

  rejectExport(): never {
    fail("prohibited_export", "dataset export is not authorized");
  }

  rejectPersistence(): never {
    fail("prohibited_persistence", "dataset persistence is not authorized");
  }

  rejectTraining(): never {
    fail("prohibited_training", "training is not authorized");
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.decisions.clear();
    this.samples.clear();
    this.manifests.clear();
    this.disposed = true;
  }
}

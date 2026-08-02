import { immutableCopy } from "./evaluation-contract";
import type { BaselineRunEvidence } from "./baseline-run";
import type { CandidateComparison } from "./comparison-contract";
import type { CandidateRecommendation } from "./candidate-ranking";
import { fail } from "./failures";
import type { HardwareSnapshot } from "./hardware-snapshot";
import type { ModelCandidateProfile } from "./model-candidate-contract";
import type { RuntimeProfile } from "./runtime-contract";

export const MAX_RUN_RECORDS = 100_000;
export const MAX_CANDIDATES = 16;

export class EvaluationController {
  private disposed = false;
  private cancelled = false;
  private readonly hardware = new Map<string, HardwareSnapshot>();
  private readonly candidates = new Map<string, ModelCandidateProfile>();
  private readonly runtimes = new Map<string, RuntimeProfile>();
  private readonly runs = new Map<string, BaselineRunEvidence>();
  private readonly comparisons = new Map<string, CandidateComparison>();
  private readonly recommendations = new Map<string, CandidateRecommendation>();

  private assertActive(): void {
    if (this.disposed) fail("controller_disposed", "evaluation controller disposed");
    if (this.cancelled) fail("cancelled", "evaluation controller cancelled");
  }

  registerHardware(snapshot: HardwareSnapshot): void {
    this.assertActive();
    this.hardware.set(snapshot.snapshotId, immutableCopy(snapshot) as HardwareSnapshot);
  }

  registerCandidate(candidate: ModelCandidateProfile): void {
    this.assertActive();
    if (!this.candidates.has(candidate.identity) && this.candidates.size >= MAX_CANDIDATES) {
      fail("record_budget_exceeded", "candidate budget exceeded");
    }
    this.candidates.set(candidate.identity, immutableCopy(candidate) as ModelCandidateProfile);
  }

  registerRuntime(runtime: RuntimeProfile): void {
    this.assertActive();
    this.runtimes.set(runtime.runtimeId, immutableCopy(runtime) as RuntimeProfile);
  }

  registerRun(run: BaselineRunEvidence): void {
    this.assertActive();
    if (!this.runs.has(run.runId) && this.runs.size >= MAX_RUN_RECORDS) {
      fail("record_budget_exceeded", "run record budget exceeded");
    }
    this.runs.set(run.runId, immutableCopy(run) as BaselineRunEvidence);
  }

  registerComparison(comparison: CandidateComparison): void {
    this.assertActive();
    this.comparisons.set(comparison.comparisonId, immutableCopy(comparison) as CandidateComparison);
  }

  registerRecommendation(recommendation: CandidateRecommendation): void {
    this.assertActive();
    this.recommendations.set(
      recommendation.candidateIdentity,
      immutableCopy(recommendation) as CandidateRecommendation,
    );
  }

  snapshot(): Readonly<{
    hardware: readonly HardwareSnapshot[];
    candidates: readonly ModelCandidateProfile[];
    runtimes: readonly RuntimeProfile[];
    runs: readonly BaselineRunEvidence[];
    comparisons: readonly CandidateComparison[];
    recommendations: readonly CandidateRecommendation[];
  }> {
    this.assertActive();
    return immutableCopy({
      hardware: [...this.hardware.values()],
      candidates: [...this.candidates.values()],
      runtimes: [...this.runtimes.values()],
      runs: [...this.runs.values()],
      comparisons: [...this.comparisons.values()],
      recommendations: [...this.recommendations.values()],
    });
  }

  cancel(): void {
    this.cancelled = true;
  }

  rejectHostInspection(): never {
    fail("prohibited_host_inspection", "host inspection is not authorized");
  }

  rejectRuntimeInstallation(): never {
    fail("prohibited_runtime_installation", "runtime installation is not authorized");
  }

  rejectArtifactAcquisition(): never {
    fail("prohibited_artifact_acquisition", "artifact acquisition is not authorized");
  }

  rejectModelInvocation(): never {
    fail("prohibited_model_invocation", "model invocation is not authorized");
  }

  rejectModelSelection(): never {
    fail("prohibited_model_selection", "model selection is not authorized");
  }

  rejectPersistence(): never {
    fail("prohibited_persistence", "persistence is not authorized");
  }

  rejectDatasetExport(): never {
    fail("prohibited_dataset_export", "dataset export is not authorized");
  }

  rejectTraining(): never {
    fail("prohibited_training", "training is not authorized");
  }

  dispose(): void {
    if (this.disposed) return;
    this.hardware.clear();
    this.candidates.clear();
    this.runtimes.clear();
    this.runs.clear();
    this.comparisons.clear();
    this.recommendations.clear();
    this.disposed = true;
  }
}

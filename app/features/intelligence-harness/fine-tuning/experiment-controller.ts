import { failFineTuning } from "./failures";
import { validateTrainingPlan, type TrainingPlan } from "./training-plan";
import { createRunRecord, type RunRecord, type RunState } from "./run-contract";
export interface ExternalLifecycleEvidence {
  readonly planDigest: string;
  readonly state: RunState;
  readonly reason: string;
  readonly sequence: number;
}
export class FineTuningExperimentController {
  #disposed = false;
  #plan: Readonly<TrainingPlan> | undefined;
  #authorizedDigest: string | undefined;
  #latest: Readonly<RunRecord> | undefined;
  async registerValidatedPlan(plan: Readonly<TrainingPlan>): Promise<Readonly<RunRecord>> {
    this.#assertActive();
    await validateTrainingPlan(plan);
    this.#plan = plan;
    this.#latest = await createRunRecord({
      runId: `run:${plan.planId}`,
      runVersion: plan.planVersion,
      trainingPlanDigest: plan.planDigest,
      state: "validated",
      priorState: "draft",
      transitionReason: "Plan passed deterministic control-plane validation.",
      sequence: 1,
    });
    return this.#latest;
  }
  async recordOperatorAuthorization(planDigest: string): Promise<Readonly<RunRecord>> {
    this.#assertActive();
    if (!this.#plan || this.#plan.planDigest !== planDigest)
      failFineTuning(
        "training_plan_digest_mismatch",
        "controller",
        "Authorization digest does not match the registered plan.",
      );
    if (!this.#latest || this.#latest.state !== "validated")
      failFineTuning(
        "training_not_authorized",
        "controller",
        "Plan is not awaiting authorization.",
      );
    this.#authorizedDigest = planDigest;
    this.#latest = await createRunRecord({
      runId: this.#latest.runId,
      runVersion: this.#latest.runVersion,
      trainingPlanDigest: planDigest,
      state: "authorized",
      priorState: "validated",
      transitionReason: "Operator authorization recorded for exact plan digest.",
      sequence: 2,
    });
    return this.#latest;
  }
  async recordExternalLifecycle(
    evidence: Readonly<ExternalLifecycleEvidence>,
  ): Promise<Readonly<RunRecord>> {
    this.#assertActive();
    if (!this.#latest || !this.#authorizedDigest || evidence.planDigest !== this.#authorizedDigest)
      failFineTuning(
        "training_not_authorized",
        "controller",
        "External lifecycle evidence is not bound to an authorized plan.",
      );
    this.#latest = await createRunRecord({
      runId: this.#latest.runId,
      runVersion: this.#latest.runVersion,
      trainingPlanDigest: evidence.planDigest,
      state: evidence.state,
      priorState: this.#latest.state,
      transitionReason: evidence.reason,
      sequence: evidence.sequence,
    });
    return this.#latest;
  }
  getLatestRecord(): Readonly<RunRecord> | undefined {
    return this.#latest;
  }
  dispose(): void {
    this.#disposed = true;
    this.#plan = undefined;
    this.#authorizedDigest = undefined;
  }
  #assertActive(): void {
    if (this.#disposed)
      failFineTuning("controller_disposed", "controller", "Experiment controller is disposed.");
  }
}

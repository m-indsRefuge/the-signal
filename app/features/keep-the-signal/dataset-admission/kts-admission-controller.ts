import {
  AdmissionController,
  assignPartition,
  classifyDuplicate,
  combineLeakageResults,
  createAdmissionDecision,
  detectPairLeakage,
  evaluateEligibility,
  fail,
  immutableCopy,
  projectNormalizedSample,
  type AdmissionDecision,
  type AdmissionRequest,
  type EligibilityPolicy,
  type LeakagePolicy,
  type NormalizedSample,
  type PartitionPolicy,
} from "../../intelligence-harness/dataset-admission";
import { deriveKtsPartitionFamily } from "./kts-partition-family";
import { classifyKtsSampleRole } from "./kts-sample-role-policy";

export type KtsAdmissionPolicies = Readonly<{
  eligibility: EligibilityPolicy;
  partition: PartitionPolicy;
  leakage: LeakagePolicy;
}>;

export type KtsAdmissionExecution = Readonly<{
  decision: AdmissionDecision;
  sample?: NormalizedSample;
}>;

export class KtsAdmissionController {
  private readonly controller = new AdmissionController();
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  evaluate(
    request: AdmissionRequest,
    policies: KtsAdmissionPolicies,
    decisionId: string,
    sampleId: string,
    decidedAt: string,
  ): KtsAdmissionExecution {
    if (this.cancelled) {
      fail("cancelled", "admission evaluation cancelled");
    }

    const eligibility = evaluateEligibility(request, policies.eligibility);
    const role =
      eligibility.state === "eligible"
        ? classifyKtsSampleRole(request.evidence.outcome)
        : undefined;
    const families =
      eligibility.state === "eligible" ? deriveKtsPartitionFamily(request.evidence) : undefined;
    const sample =
      role && families
        ? projectNormalizedSample({
            sampleId,
            evidence: request.evidence,
            review: request.review,
            datasetPurposeId: request.datasetPurposeId,
            role,
            families,
            policyBindings: {
              ...request.policies,
              sampleSchemaId: request.policies.sampleSchemaId,
              sampleSchemaVersion: request.policies.sampleSchemaVersion,
            },
          })
        : undefined;

    const existingSamples = this.controller.listSamples();
    const duplicate = sample
      ? classifyDuplicate(sample, existingSamples)
      : classifyDuplicate(
          immutableCopy({
            sampleId: "not-projected",
            sampleDigest: "not-projected",
            sampleSchemaId: "none",
            sampleSchemaVersion: "none",
            datasetPurposeId: request.datasetPurposeId,
            evidenceId: request.evidence.evidenceId,
            evidenceDigest: request.evidence.evidenceDigest,
            reviewId: request.review.reviewId,
            reviewDigest: request.review.reviewDigest,
            role: "planner_failure",
            domainId: request.evidence.domainId,
            domainVersion: request.evidence.domainVersion,
            families: deriveKtsPartitionFamily(request.evidence),
            seedIdentity: request.evidence.seedIdentity,
            observationId: request.evidence.observationId,
            observationDigest: request.evidence.observationDigest,
            observationProjection: {},
            legalActionSetDigest: request.evidence.legalActionSetDigest,
            legalActionProjection: [],
            plannerRequestId: request.evidence.plannerRequestId,
            plannerRequestDigest: request.evidence.plannerRequestDigest,
            plannerResultId: request.evidence.plannerResultId,
            plannerResultDigest: request.evidence.plannerResultDigest,
            validatorReasons: [],
            qualityLabels: [],
            riskLabels: [],
            limitations: [],
            reconstructionStatus: "unknown",
            policyBindings: {},
            authority: {
              exportAuthorization: "absent",
              trainingAuthorization: "absent",
              frameworkBinding: "none",
              tokenization: "not_performed",
              persistence: "none",
            },
          } as const) as NormalizedSample,
          [],
        );

    const partition =
      sample && duplicate.status !== "conflicting_duplicate"
        ? assignPartition(sample.families, policies.partition)
        : undefined;

    const leakageResults =
      sample && partition
        ? existingSamples.map((existing) =>
            detectPairLeakage(
              sample,
              partition,
              existing,
              assignPartition(existing.families, policies.partition),
              policies.leakage,
            ),
          )
        : [];

    const leakage = combineLeakageResults(leakageResults, policies.leakage);

    const decision = createAdmissionDecision({
      decisionId,
      request,
      eligibility,
      role,
      sample,
      duplicate,
      partition,
      leakage,
      decidedAt,
    });
    this.controller.register(decision, sample);
    return immutableCopy({ decision, sample });
  }

  inner(): AdmissionController {
    return this.controller;
  }

  dispose(): void {
    this.controller.dispose();
    this.cancelled = true;
  }
}

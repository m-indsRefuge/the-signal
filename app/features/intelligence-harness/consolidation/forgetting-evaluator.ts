import { deepFreezeJson, type JsonObject } from "../memory-fabric/canonical-json";
import type { ConsolidationSnapshot } from "./episode-snapshot";
import {
  createVirtualRetainedView,
  validateForgettingRequest,
  type BooleanVerificationProbe,
  type ForgettingDecision,
  type ForgettingEvaluationReport,
  type ForgettingEvaluationRequest,
  type ForgettingClassification,
  type ProbeReport,
  type ReconstructionProbe,
  type RetrievalQualityProbe,
} from "./forgetting-contract";
import { informationIsPreserved } from "./preservation-contract";
import type { RetentionDecisionReport } from "./retention-policy";
import { createTombstoneDraft, type TombstoneDraftInput } from "./tombstone-contract";
import { failConsolidation } from "./failures";

export interface ForgettingEvaluationInput {
  readonly snapshot: Readonly<ConsolidationSnapshot>;
  readonly request: Readonly<ForgettingEvaluationRequest>;
  readonly retentionDecisions: readonly Readonly<RetentionDecisionReport>[];
  readonly tombstoneInputs: Readonly<Record<string, Readonly<TombstoneDraftInput>>>;
}

function reconstructionReport(
  probe: Readonly<ReconstructionProbe>,
  request: Readonly<ForgettingEvaluationRequest>,
): Readonly<ProbeReport> {
  const availableTargets = new Set(request.preservationTargets.map((target) => target.targetId));
  const allowedTargets = probe.allowedPreservationTargetIds.filter((id) =>
    availableTargets.has(id),
  );
  const maps = request.preservationMaps.filter((map) =>
    map.destinationTargetIds.some((targetId) => allowedTargets.includes(targetId)),
  );
  const represented = new Set(maps.flatMap((map) => map.essentialInformationUnitIds));
  const missing = probe.requiredInformationUnitIds.filter((unit) => !represented.has(unit));
  const outcome = missing.length === 0 ? "pass" : "fail";
  return deepFreezeJson({
    probeId: probe.probeId,
    probeVersion: probe.probeVersion,
    outcome,
    passedConditions: outcome === "pass" ? ["required_information_reconstructable"] : [],
    failedConditions: outcome === "fail" ? ["required_information_missing"] : [],
    unknownConditions: [],
  } as unknown as JsonObject) as unknown as Readonly<ProbeReport>;
}

function retrievalReport(
  probe: Readonly<RetrievalQualityProbe>,
  snapshot: Readonly<ConsolidationSnapshot>,
  retainedIds: readonly string[],
): Readonly<ProbeReport> {
  const before = snapshot.memories.map((memory) => memory.memoryId).sort();
  const after = [...retainedIds].sort();
  const requiredMissing = probe.requiredResultIds.filter((id) => !after.includes(id));
  const prohibitedPresent = probe.prohibitedResultIds.filter((id) => after.includes(id));
  const loss = before.length - after.length;
  const orderPass =
    probe.expectedOrdering === undefined ||
    probe.expectedOrdering
      .filter((id) => after.includes(id))
      .every((id, index, arr) => {
        const previous = arr[index - 1];
        return (
          index === 0 || (previous !== undefined && after.indexOf(previous) <= after.indexOf(id))
        );
      });
  const contradictionPresent =
    !probe.contradictionPreservationRequired ||
    snapshot.memoryRelations
      .filter((relation) => relation.relationType === "contradicts")
      .every(
        (relation) =>
          after.includes(relation.sourceMemoryId) || after.includes(relation.targetMemoryId),
      );
  const passed =
    requiredMissing.length === 0 &&
    prohibitedPresent.length === 0 &&
    loss <= probe.maximumResultLoss &&
    orderPass &&
    contradictionPresent;
  return deepFreezeJson({
    probeId: probe.probeId,
    probeVersion: probe.probeVersion,
    outcome: passed ? "pass" : "fail",
    passedConditions: passed ? ["retrieval_quality_preserved"] : [],
    failedConditions: passed
      ? []
      : [
          ...(requiredMissing.length ? ["required_result_missing"] : []),
          ...(prohibitedPresent.length ? ["prohibited_result_present"] : []),
          ...(loss > probe.maximumResultLoss ? ["result_loss_exceeded"] : []),
          ...(!orderPass ? ["ordering_changed"] : []),
          ...(!contradictionPresent ? ["contradiction_not_preserved"] : []),
        ],
    unknownConditions: [],
    beforeResultIds: before,
    afterResultIds: after,
    serializedCharacterDifference: 0,
  } as unknown as JsonObject) as unknown as Readonly<ProbeReport>;
}

function booleanReport(probe: Readonly<BooleanVerificationProbe>): Readonly<ProbeReport> {
  return deepFreezeJson({
    probeId: probe.probeId,
    probeVersion: probe.probeVersion,
    outcome: probe.suppliedOutcome,
    passedConditions: probe.suppliedOutcome === "pass" ? [`${probe.kind}_verified`] : [],
    failedConditions: probe.suppliedOutcome === "fail" ? [`${probe.kind}_failed`] : [],
    unknownConditions: probe.suppliedOutcome === "unknown" ? [`${probe.kind}_unknown`] : [],
  } as unknown as JsonObject) as unknown as Readonly<ProbeReport>;
}

function blocks(
  reports: readonly Readonly<ProbeReport>[],
  probes: readonly { readonly blocking: boolean }[],
): boolean {
  return reports.some(
    (report, index) =>
      probes[index]?.blocking && (report.outcome === "fail" || report.outcome === "unknown"),
  );
}

export async function evaluateForgetting(
  input: Readonly<ForgettingEvaluationInput>,
): Promise<Readonly<ForgettingEvaluationReport>> {
  validateForgettingRequest(input.request, input.snapshot);
  const decisionByMemory = new Map(
    input.retentionDecisions.map((report) => [report.memoryId, report]),
  );
  const view = createVirtualRetainedView(input.snapshot, input.request.candidateMemoryIds);
  const decisions: Readonly<ForgettingDecision>[] = [];

  for (const memoryId of input.request.candidateMemoryIds) {
    const memory = input.snapshot.memories.find((record) => record.memoryId === memoryId);
    const retention = decisionByMemory.get(memoryId);
    if (memory === undefined || retention === undefined) {
      failConsolidation(
        "invalid_forgetting_request",
        "forgetting",
        "Forgetting candidate lacks source or policy decision.",
        {
          memoryId,
          evaluationId: input.request.evaluationId,
        },
      );
    }
    const map = input.request.preservationMaps.find((item) => item.sourceMemoryId === memoryId);
    const preserved =
      map !== undefined && informationIsPreserved(map, input.request.preservationTargets);
    const reconstruction = input.request.reconstructionProbes.map((probe) =>
      reconstructionReport(probe, input.request),
    );
    const retrieval = input.request.retrievalQualityProbes.map((probe) =>
      retrievalReport(probe, input.snapshot, view.retainedMemoryIds),
    );
    const lineage = input.request.lineageProbes.map(booleanReport);
    const reproducibility = input.request.reproducibilityProbes.map(booleanReport);
    const failed: string[] = [];
    const unknown: string[] = [];
    const passed: string[] = [];
    if (preserved) passed.push("information_preserved");
    else failed.push("information_not_preserved");
    if (retention.decision === "protected") failed.push("protected_record");
    else if (retention.decision === "forgetting_candidate") passed.push("retention_policy_permits");
    else failed.push("retention_policy_blocks");
    if (map?.uniqueEvidenceIds.length) failed.push("unique_evidence_remains");
    else passed.push("no_unique_evidence");
    if (blocks(reconstruction, input.request.reconstructionProbes))
      failed.push("reconstruction_probe");
    else passed.push("reconstruction_probes");
    if (blocks(retrieval, input.request.retrievalQualityProbes))
      failed.push("retrieval_quality_probe");
    else passed.push("retrieval_quality_probes");
    if (blocks(lineage, input.request.lineageProbes)) failed.push("lineage_probe");
    else passed.push("lineage_probes");
    if (blocks(reproducibility, input.request.reproducibilityProbes))
      failed.push("reproducibility_probe");
    else passed.push("reproducibility_probes");
    for (const report of [...reconstruction, ...retrieval, ...lineage, ...reproducibility]) {
      if (report.outcome === "unknown") unknown.push(report.probeId);
    }

    let classification: ForgettingClassification;
    if (retention.decision === "protected") classification = "protected";
    else if (failed.length > 0) classification = "forgetting_ineligible";
    else classification = "forgetting_eligible";

    let tombstoneDraft;
    if (classification === "forgetting_eligible") {
      const tombstoneInput = input.tombstoneInputs[memoryId];
      if (tombstoneInput === undefined) {
        classification = "forgetting_ineligible";
        failed.push("tombstone_draft_missing");
      } else {
        tombstoneDraft = await createTombstoneDraft(tombstoneInput);
        passed.push("tombstone_draft_complete");
      }
    }

    decisions.push(
      deepFreezeJson({
        memoryId,
        classification,
        passedConditions: passed.sort(),
        failedConditions: failed.sort(),
        unknownConditions: unknown.sort(),
        retentionDecision: retention,
        reconstructionReports: reconstruction,
        retrievalReports: retrieval,
        lineageReports: lineage,
        reproducibilityReports: reproducibility,
        ...(tombstoneDraft ? { tombstoneDraft } : {}),
      } as unknown as JsonObject) as unknown as Readonly<ForgettingDecision>,
    );
  }

  const counts: Record<ForgettingClassification, number> = {
    forgetting_eligible: 0,
    forgetting_ineligible: 0,
    protected: 0,
    evaluation_failed: 0,
  };
  for (const decision of decisions) counts[decision.classification] += 1;
  return deepFreezeJson({
    evaluationId: input.request.evaluationId,
    sourceSnapshotId: input.snapshot.snapshotId,
    virtualView: view,
    decisions,
    classificationCounts: counts,
  } as unknown as JsonObject) as unknown as Readonly<ForgettingEvaluationReport>;
}

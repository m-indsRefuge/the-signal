import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
} from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failTraining, validateTrainingIdentity } from "./failures";
import {
  DISTILLATION_METHOD_COMPATIBILITY,
  type DistillationPlan,
  type DistillationRecord,
  type DistillationRecordDraft,
  type DistillationMethodCompatibility,
} from "./distillation-contract";
import { normalizeTeacherRecord } from "./target-contract";
export async function createDistillationRecord(
  draft: Readonly<DistillationRecordDraft>,
): Promise<Readonly<DistillationRecord>> {
  validateTrainingIdentity(draft.recordId, "recordId", "invalid_distillation_plan", "distillation");
  validateTrainingIdentity(
    draft.recordVersion,
    "recordVersion",
    "invalid_distillation_plan",
    "distillation",
  );
  validateTrainingIdentity(
    draft.targetSchemaId,
    "targetSchemaId",
    "invalid_distillation_plan",
    "distillation",
  );
  if (
    !Number.isSafeInteger(draft.targetSchemaVersion) ||
    draft.targetSchemaVersion < 1 ||
    draft.methods.some((m) => !DISTILLATION_METHOD_COMPATIBILITY.includes(m))
  )
    failTraining("invalid_distillation_plan", "distillation", "Distillation record is invalid.");
  const teacher = normalizeTeacherRecord(draft.teacher);
  if (
    teacher.schemaId !== draft.targetSchemaId ||
    teacher.schemaVersion !== draft.targetSchemaVersion
  )
    failTraining(
      "teacher_schema_incompatible",
      "distillation",
      "Teacher schema does not match target schema.",
    );
  const normalized = canonicalizeJson({
    ...draft,
    teacher,
    sourceEvidenceReferences: [...new Set(draft.sourceEvidenceReferences)].sort(),
    methods: [...new Set(draft.methods)].sort(),
  }) as unknown as Omit<DistillationRecord, "contentDigest">;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  }) as unknown as Readonly<DistillationRecord>;
}
export async function createDistillationPlan(
  planId: string,
  planVersion: string,
  records: readonly Readonly<DistillationRecord>[],
): Promise<Readonly<DistillationPlan>> {
  validateTrainingIdentity(planId, "planId", "invalid_distillation_plan", "distillation");
  validateTrainingIdentity(planVersion, "planVersion", "invalid_distillation_plan", "distillation");
  if (records.length > 10_000)
    failTraining(
      "invalid_distillation_plan",
      "distillation",
      "Distillation record budget exceeded.",
    );
  const sorted = [...records].sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
  const methods = [
    ...new Set(sorted.flatMap((r) => r.methods)),
  ].sort() as DistillationMethodCompatibility[];
  const planDigest = await sha256Hex(
    canonicalStringify({ planId, planVersion, records: sorted, compatibleMethods: methods }),
  );
  return deepFreezeJson({
    planId,
    planVersion,
    records: sorted,
    compatibleMethods: methods,
    planDigest,
  }) as unknown as Readonly<DistillationPlan>;
}

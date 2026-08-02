import {
  createDistillationPlan,
  createDistillationRecord,
} from "../../intelligence-harness/training-evidence/distillation-planner";
import type { DistillationPlan } from "../../intelligence-harness/training-evidence/distillation-contract";
import type { TrainingExample } from "../../intelligence-harness/training-evidence/training-example-contract";
export async function createKtsRecordedOutputDistillationPlan(
  planId: string,
  examples: readonly Readonly<TrainingExample>[],
): Promise<Readonly<DistillationPlan>> {
  const records = [];
  for (const e of examples) {
    const teacher = e.target?.teacher;
    if (!teacher) continue;
    records.push(
      await createDistillationRecord({
        recordId: `distill:${e.exampleId}`,
        recordVersion: "1",
        studentInput: e.input,
        teacher,
        targetSchemaId: e.targetSchemaId,
        targetSchemaVersion: e.targetSchemaVersion,
        sourceEvidenceReferences: e.evidenceReferences,
        partition: e.partition,
        curriculumStage: "mixed_difficulty",
        methods: ["teacher_student_distillation"],
      }),
    );
  }
  return createDistillationPlan(planId, "1", records);
}

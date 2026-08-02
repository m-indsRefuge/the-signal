import type { JsonValue } from "../memory-fabric/canonical-json";
import type { DatasetPartition } from "./training-example-contract";
import type { TeacherRecord } from "./target-contract";
export const DISTILLATION_METHOD_COMPATIBILITY = Object.freeze([
  "supervised_fine_tuning",
  "lora",
  "qlora",
  "preference_optimization",
  "teacher_student_distillation",
] as const);
export type DistillationMethodCompatibility = (typeof DISTILLATION_METHOD_COMPATIBILITY)[number];
export interface DistillationRecordDraft {
  readonly recordId: string;
  readonly recordVersion: string;
  readonly studentInput: JsonValue;
  readonly teacher: TeacherRecord;
  readonly targetSchemaId: string;
  readonly targetSchemaVersion: number;
  readonly sourceEvidenceReferences: readonly string[];
  readonly partition: DatasetPartition;
  readonly curriculumStage: string;
  readonly methods: readonly DistillationMethodCompatibility[];
}
export interface DistillationRecord extends DistillationRecordDraft {
  readonly contentDigest: string;
}
export interface DistillationPlan {
  readonly planId: string;
  readonly planVersion: string;
  readonly records: readonly DistillationRecord[];
  readonly compatibleMethods: readonly DistillationMethodCompatibility[];
  readonly planDigest: string;
}

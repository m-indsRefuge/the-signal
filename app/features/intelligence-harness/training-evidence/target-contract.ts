import { canonicalizeJson, deepFreezeJson, type JsonValue } from "../memory-fabric/canonical-json";
import { failTraining, validateTrainingIdentity } from "./failures";
export const TARGET_LABELS = Object.freeze([
  "accepted",
  "rejected",
  "corrected",
  "abstained",
  "indeterminate",
  "quarantined",
] as const);
export type TargetLabel = (typeof TARGET_LABELS)[number];
export const REJECTION_CLASSES = Object.freeze([
  "schema_invalid",
  "illegal_proposal",
  "unsupported_claim",
  "ungrounded_reference",
  "wrong_strategy",
  "unsafe_recommendation",
  "ineffective_outcome",
  "contradicted",
  "version_incompatible",
  "policy_prohibited",
  "review_missing",
] as const);
export type RejectionClass = (typeof REJECTION_CLASSES)[number];
export const TEACHER_KINDS = Object.freeze([
  "human",
  "deterministic_policy",
  "recorded_model",
  "accepted_strategy",
  "accepted_result",
] as const);
export type TeacherKind = (typeof TEACHER_KINDS)[number];
export interface TeacherRecord {
  readonly teacherId: string;
  readonly teacherVersion: string;
  readonly teacherKind: TeacherKind;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly reviewed: boolean;
  readonly output: JsonValue;
  readonly evidenceReferences: readonly string[];
  readonly uncertainty: "low" | "medium" | "high" | "unknown";
}
export interface TargetRecord {
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly value: JsonValue;
  readonly label: TargetLabel;
  readonly rejectionClasses: readonly RejectionClass[];
  readonly legal: boolean;
  readonly grounded: boolean;
  readonly reviewerStatus: "accepted" | "rejected" | "unknown";
  readonly teacher?: TeacherRecord;
}
export function normalizeTeacherRecord(value: Readonly<TeacherRecord>): Readonly<TeacherRecord> {
  validateTrainingIdentity(value.teacherId, "teacherId", "invalid_teacher_record", "example");
  validateTrainingIdentity(
    value.teacherVersion,
    "teacherVersion",
    "invalid_teacher_record",
    "example",
  );
  validateTrainingIdentity(value.schemaId, "schemaId", "invalid_teacher_record", "example");
  if (
    !TEACHER_KINDS.includes(value.teacherKind) ||
    !Number.isSafeInteger(value.schemaVersion) ||
    value.schemaVersion < 1
  ) {
    failTraining("invalid_teacher_record", "example", "Teacher record classification is invalid.");
  }
  if (value.teacherKind === "recorded_model" && !value.reviewed) {
    failTraining(
      "teacher_review_missing",
      "example",
      "Recorded model teacher output requires review.",
    );
  }
  const serialized = JSON.stringify(value.output);
  if (/chain[-_ ]?of[-_ ]?thought|hidden_reasoning|private_reasoning/i.test(serialized)) {
    failTraining(
      "hidden_reasoning_prohibited",
      "example",
      "Hidden reasoning fields are prohibited.",
    );
  }
  return deepFreezeJson(
    canonicalizeJson({
      ...value,
      evidenceReferences: [...new Set(value.evidenceReferences)].sort(),
    }),
  ) as unknown as Readonly<TeacherRecord>;
}
export function normalizeTarget(value: Readonly<TargetRecord>): Readonly<TargetRecord> {
  validateTrainingIdentity(value.schemaId, "schemaId", "invalid_target", "example");
  if (
    !Number.isSafeInteger(value.schemaVersion) ||
    value.schemaVersion < 1 ||
    !TARGET_LABELS.includes(value.label) ||
    value.rejectionClasses.some((item) => !REJECTION_CLASSES.includes(item))
  ) {
    failTraining("invalid_target", "example", "Target record classification is invalid.");
  }
  if (
    value.label === "accepted" &&
    (!value.legal || !value.grounded || value.rejectionClasses.length > 0)
  ) {
    failTraining(
      "target_not_supported",
      "example",
      "Accepted targets must be legal, grounded, and unrejected.",
    );
  }
  const normalized: Record<string, unknown> = {
    ...value,
    rejectionClasses: [...new Set(value.rejectionClasses)].sort(),
  };
  if (value.teacher) normalized.teacher = normalizeTeacherRecord(value.teacher);
  return deepFreezeJson(canonicalizeJson(normalized)) as unknown as Readonly<TargetRecord>;
}

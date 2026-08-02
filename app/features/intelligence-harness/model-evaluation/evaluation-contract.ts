import { fail } from "./failures";

export const MODEL_EVALUATION_SCHEMA_ID = "kts-i4-l.model-evaluation";
export const MODEL_EVALUATION_SCHEMA_VERSION = "1.0.0";

export type EvidenceState = "supported" | "unsupported" | "unknown";
export type FeasibilityState = "feasible" | "conditionally_feasible" | "infeasible" | "unknown";

export type BaselineOutcome =
  | "passed"
  | "failed"
  | "abstained_correctly"
  | "abstained_incorrectly"
  | "schema_rejected"
  | "validator_rejected"
  | "runtime_failed"
  | "timed_out"
  | "cancelled"
  | "unknown";

export type EvaluationAuthority = Readonly<{
  hostInspectionAuthorization: "absent";
  runtimeInstallationAuthorization: "absent";
  artifactAcquisitionAuthorization: "absent";
  modelInvocationAuthorization: "absent";
  modelSelectionAuthorization: "absent";
  datasetExportAuthorization: "absent";
  trainingAuthorization: "absent";
  actionExecution: false;
  persistence: "none";
}>;

export const ABSENT_EVALUATION_AUTHORITY: EvaluationAuthority = Object.freeze({
  hostInspectionAuthorization: "absent",
  runtimeInstallationAuthorization: "absent",
  artifactAcquisitionAuthorization: "absent",
  modelInvocationAuthorization: "absent",
  modelSelectionAuthorization: "absent",
  datasetExportAuthorization: "absent",
  trainingAuthorization: "absent",
  actionExecution: false,
  persistence: "none",
});

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("invalid_generation_parameters", "canonical numbers must be finite");
    }
    return value;
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort(compareText)) {
      const nested = record[key];
      if (typeof nested !== "undefined") {
        result[key] = canonicalize(nested);
      }
    }
    return result;
  }
  fail("invalid_candidate_profile", "unsupported canonical value");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function updateHash(hash: number, code: number): number {
  let next = hash ^ code;
  next = Math.imul(next, 16777619);
  return next >>> 0;
}

export function digestCanonical(value: unknown): string {
  const text = canonicalJson(value);
  const hashes = [2166136261, 2246822519, 3266489917, 668265263];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    for (let slot = 0; slot < hashes.length; slot += 1) {
      hashes[slot] = updateHash(hashes[slot] ^ Math.imul(slot + 1, 374761393), code);
    }
  }
  return hashes.map((hash) => hash.toString(16).padStart(8, "0")).join("");
}

export function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    result[key] = cloneValue((value as Record<string, unknown>)[key]);
  }
  return result as T;
}

export function freezeValue<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const nested = (value as Record<string, unknown>)[key];
    if (nested !== null && typeof nested === "object") freezeValue(nested);
  }
  return Object.freeze(value);
}

export function immutableCopy<T>(value: T): Readonly<T> {
  return freezeValue(cloneValue(value));
}

export function requireIdentity(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("invalid_candidate_profile", `${label} must be non-empty`);
  }
  if (value !== value.trim()) {
    fail("invalid_candidate_profile", `${label} must be canonical`);
  }
  return value;
}

export function requireSafeInteger(
  value: number,
  label: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail("invalid_generation_parameters", `${label} must be a bounded safe integer`);
  }
  return value;
}

export function requireFiniteNumber(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    fail("invalid_generation_parameters", `${label} must be finite and bounded`);
  }
  return value;
}

export function requireIsoTime(value: string, label: string): string {
  requireIdentity(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    fail("invalid_hardware_snapshot", `${label} must be an ISO-8601 UTC time`);
  }
  return value;
}

export function sortText(values: readonly string[]): readonly string[] {
  return Object.freeze([...values].sort(compareText));
}

export function serializedLength(value: unknown): number {
  return canonicalJson(value).length;
}

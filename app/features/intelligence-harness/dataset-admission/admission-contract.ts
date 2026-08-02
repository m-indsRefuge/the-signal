import { fail } from "./failures";

export const DATASET_ADMISSION_SCHEMA_ID = "kts-i4-k.dataset-admission";
export const DATASET_ADMISSION_SCHEMA_VERSION = "1.0.0";

export type AdmissionOutcome = "admitted" | "rejected" | "deferred" | "quarantined" | "conflict";

export type DatasetPartition = "train" | "validation" | "test" | "holdout";

export type AuthorityBoundary = Readonly<{
  exportAuthorization: "absent";
  trainingAuthorization: "absent";
  frameworkBinding: "none";
  tokenization: "not_performed";
  persistence: "none";
}>;

export const ABSENT_AUTHORITY: AuthorityBoundary = Object.freeze({
  exportAuthorization: "absent",
  trainingAuthorization: "absent",
  frameworkBinding: "none",
  tokenization: "not_performed",
  persistence: "none",
});

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortText(values: readonly string[]): readonly string[] {
  return Object.freeze([...values].sort(compareText));
}

export function requireIdentity(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("missing_identity", `${label} must be a non-empty string`);
  }
  if (value !== value.trim()) {
    fail("invalid_request", `${label} must be canonical`);
  }
  return value;
}

export function requireSafeInteger(value: number, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    fail("invalid_request", `${label} must be a safe integer`);
  }
  return value;
}

export function requireIsoTime(value: string, label: string): string {
  requireIdentity(value, label);
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (!pattern.test(value)) {
    fail("invalid_timestamp", `${label} must be an ISO-8601 UTC time`);
  }
  return value;
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("invalid_request", "canonical numbers must be finite");
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
  fail("invalid_request", "unsupported canonical value");
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
  if (value === null || typeof value !== "object") {
    return value;
  }
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
    if (nested !== null && typeof nested === "object") {
      freezeValue(nested);
    }
  }
  return Object.freeze(value);
}

export function immutableCopy<T>(value: T): Readonly<T> {
  return freezeValue(cloneValue(value));
}

export function serializedLength(value: unknown): number {
  return canonicalJson(value).length;
}

import { failMemory } from "./failures";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export function isPlainJsonRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function isJsonValue(value: unknown): value is JsonValue {
  try {
    normalizeJson(value, new Set<object>());
    return true;
  } catch {
    return false;
  }
}

export function canonicalizeJson(value: unknown): JsonValue {
  try {
    return deepFreezeJson(normalizeJson(value, new Set<object>()));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("JSON:")) {
      failMemory("invalid_json", "canonicalization", error.message.slice(5));
    }
    failMemory("canonicalization_failed", "canonicalization", "JSON canonicalization failed.");
  }
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

export function cloneJson<T extends JsonValue>(value: T): T {
  return canonicalizeJson(value) as T;
}

export function deepFreezeJson<T>(value: T): Readonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as Readonly<T>;
  }
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeJson(item);
    return Object.freeze(value) as Readonly<T>;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    deepFreezeJson(item);
  }
  return Object.freeze(value) as Readonly<T>;
}

export function serializedJsonCharacters(value: unknown): number {
  return canonicalStringify(value).length;
}

function normalizeJson(value: unknown, seen: Set<object>): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JSON:Numbers must be finite.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new Error("JSON:Only JSON-compatible values are accepted.");
  }
  if (seen.has(value)) throw new Error("JSON:Cyclic values are not accepted.");
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => normalizeJson(item, seen));
    seen.delete(value);
    return result;
  }
  if (!isPlainJsonRecord(value)) {
    seen.delete(value);
    throw new Error("JSON:Only plain JSON records are accepted.");
  }
  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort()) {
    result[key] = normalizeJson(value[key], seen);
  }
  seen.delete(value);
  return result;
}

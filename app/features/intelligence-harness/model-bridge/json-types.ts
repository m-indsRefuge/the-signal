export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

function isPlainJsonObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isJsonValue(value: unknown): value is JsonValue {
  const ancestors = new Set<object>();

  const visit = (candidate: unknown): candidate is JsonValue => {
    if (candidate === null || typeof candidate === "string" || typeof candidate === "boolean") {
      return true;
    }

    if (typeof candidate === "number") {
      return Number.isFinite(candidate);
    }

    if (typeof candidate !== "object") {
      return false;
    }

    if (ancestors.has(candidate)) {
      return false;
    }

    ancestors.add(candidate);

    try {
      if (Array.isArray(candidate)) {
        return candidate.every((entry) => visit(entry));
      }

      if (!isPlainJsonObject(candidate)) {
        return false;
      }

      return Object.values(candidate).every((entry) => visit(entry));
    } finally {
      ancestors.delete(candidate);
    }
  };

  return visit(value);
}

export function cloneJson<T extends JsonValue>(value: T): T {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry: JsonValue) => cloneJson(entry)) as unknown as T;
  }

  const clone: Record<string, JsonValue> = {};

  for (const [key, entry] of Object.entries(value)) {
    clone[key] = cloneJson(entry);
  }

  return clone as T;
}

export function deepFreezeJson<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value as JsonArray) {
      deepFreezeJson(entry);
    }
  } else {
    for (const entry of Object.values(value)) {
      deepFreezeJson(entry);
    }
  }

  return Object.freeze(value);
}

export function cloneAndFreezeJson<T extends JsonValue>(value: T): T {
  return deepFreezeJson(cloneJson(value));
}

export function jsonCharacterLength(value: JsonValue): number {
  return JSON.stringify(value).length;
}

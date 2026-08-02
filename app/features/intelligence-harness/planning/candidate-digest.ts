import { fail } from "./failures";

function canonicalPrimitive(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return fail("non_finite_score", "Canonical values must be finite.");
    }
    return Object.is(value, -0) ? "0" : String(value);
  }
  return fail("invalid_candidate", "Unsupported canonical primitive.");
}

export function canonicalize(value: unknown): string {
  if (value === null || ["string", "boolean", "number"].includes(typeof value)) {
    return canonicalPrimitive(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
      .join(",")}}`;
  }
  return fail("invalid_candidate", "Unsupported canonical value.");
}

function fnv1a(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function stableDigest(value: unknown): string {
  const canonical = canonicalize(value);
  const a = fnv1a(canonical, 0x811c9dc5);
  const b = fnv1a(canonical, 0x9e3779b9);
  const c = fnv1a(canonical, 0x85ebca6b);
  const d = fnv1a(canonical, 0xc2b2ae35);
  return [a, b, c, d].map((part) => part.toString(16).padStart(8, "0")).join("");
}

export function isDigest(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value);
}

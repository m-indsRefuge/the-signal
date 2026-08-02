import { stableDigest } from "../planning";
import { failDemonstration } from "./failures";

export function freezeDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => freezeDeep(entry))) as T;
  }
  if (value !== null && typeof value === "object") {
    const clone: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      clone[key] = freezeDeep(entry);
    }
    return Object.freeze(clone) as T;
  }
  return value;
}

export function evidenceDigest(value: unknown): string {
  return stableDigest(value);
}

export function assertDigest(expected: string, value: unknown, label: string): void {
  const actual = evidenceDigest(value);
  if (actual !== expected) {
    return failDemonstration("evidence_digest_mismatch", `${label} digest does not match.`, {
      expected,
      actual,
    });
  }
}

export function serializedCharacters(value: unknown): number {
  return JSON.stringify(value).length;
}

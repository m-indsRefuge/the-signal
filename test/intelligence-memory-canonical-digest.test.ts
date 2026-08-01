import { describe, expect, it } from "vitest";
import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  isJsonValue,
  serializedJsonCharacters,
} from "../app/features/intelligence-harness/memory-fabric/canonical-json";
import {
  isSha256Hex,
  sha256Hex,
  verifySha256Hex,
} from "../app/features/intelligence-harness/memory-fabric/digest";

const primitiveCases = [null, true, false, "signal", 0, -1, 1.5] as const;
describe("KTS-I4-D canonical JSON and SHA-256", () => {
  for (const value of primitiveCases)
    it(`canonicalizes primitive ${String(value)}`, () =>
      expect(JSON.parse(canonicalStringify(value))).toEqual(value));
  it("sorts top-level keys", () =>
    expect(canonicalStringify({ z: 1, a: 2 })).toBe('{"a":2,"z":1}'));
  it("sorts nested keys", () =>
    expect(canonicalStringify({ z: { b: 1, a: 2 } })).toBe('{"z":{"a":2,"b":1}}'));
  it("preserves array order", () => expect(canonicalStringify([3, 1, 2])).toBe("[3,1,2]"));
  it("normalizes negative zero", () => expect(canonicalStringify(-0)).toBe("0"));
  it("preserves unicode text", () => expect(canonicalStringify("Signal Ω")).toBe('"Signal Ω"'));
  it("is stable across insertion order", () =>
    expect(canonicalStringify({ a: 1, b: 2 })).toBe(canonicalStringify({ b: 2, a: 1 })));
  it("reports canonical character count", () =>
    expect(serializedJsonCharacters({ b: 2, a: 1 })).toBe(13));
  it("deep freezes records", () =>
    expect(Object.isFrozen(canonicalizeJson({ a: { b: 1 } }))).toBe(true));
  it("deep freezes nested records", () =>
    expect(Object.isFrozen((canonicalizeJson({ a: { b: 1 } }) as { a: object }).a)).toBe(true));
  it("deep freezes arrays", () => expect(Object.isFrozen(deepFreezeJson([1, 2]))).toBe(true));
  it("accepts plain JSON", () => expect(isJsonValue({ a: [1, true, null] })).toBe(true));
  it("rejects undefined", () => expect(isJsonValue(undefined)).toBe(false));
  it("rejects functions", () => expect(isJsonValue(() => 1)).toBe(false));
  it("rejects bigint", () => expect(isJsonValue(1n)).toBe(false));
  it("rejects non-finite numbers", () => expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false));
  it("rejects dates", () => expect(isJsonValue(new Date("2026-08-01T00:00:00.000Z"))).toBe(false));
  it("rejects cyclic records", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(isJsonValue(value)).toBe(false);
  });
  it("matches the empty SHA-256 vector", async () =>
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ));
  it("matches the abc SHA-256 vector", async () =>
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ));
  it("returns lowercase hexadecimal", async () =>
    expect(isSha256Hex(await sha256Hex("Signal"))).toBe(true));
  it("verifies a correct digest", async () => {
    const digest = await sha256Hex("Signal");
    expect(await verifySha256Hex("Signal", digest)).toBe(true);
  });
  it("rejects a different digest", async () => {
    const digest = await sha256Hex("Other");
    expect(await verifySha256Hex("Signal", digest)).toBe(false);
  });
  it("rejects uppercase digest syntax", () => expect(isSha256Hex("A".repeat(64))).toBe(false));
  it("rejects short digest syntax", () => expect(isSha256Hex("a".repeat(63))).toBe(false));
});

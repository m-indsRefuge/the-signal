import { describe, expect, it } from "vitest";
import {
  ABSENT_EVALUATION_AUTHORITY,
  canonicalJson,
  digestCanonical,
  immutableCopy,
  requireSafeInteger,
} from "../app/features/intelligence-harness/model-evaluation";

describe("model evaluation contract", () => {
  it("freezes authority", () => {
    expect(Object.isFrozen(ABSENT_EVALUATION_AUTHORITY)).toBe(true);
    expect(ABSENT_EVALUATION_AUTHORITY.modelInvocationAuthorization).toBe("absent");
  });
  it("canonicalizes key order", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });
  it("freezes nested copies", () => {
    const value = immutableCopy({ nested: [{ value: 1 }] });
    expect(Object.isFrozen(value.nested)).toBe(true);
  });
  it("validates safe integers", () => {
    expect(requireSafeInteger(5, "value")).toBe(5);
  });
  for (let index = 0; index < 54; index += 1) {
    it(`stabilizes digest ${index}`, () => {
      expect(digestCanonical({ index })).toBe(digestCanonical({ index }));
      expect(digestCanonical({ index })).toHaveLength(32);
    });
  }
});

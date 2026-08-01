import { describe, expect, it } from "vitest";
import {
  assembleWorkingMemory,
  createWorkingMemoryItem,
  WORKING_MEMORY_ITEM_KINDS,
} from "../app/features/intelligence-harness/memory-fabric/working-memory";
const budget = {
  maximumItemCount: 5,
  maximumSerializedCharacters: 5000,
  maximumRetrievedMemoryItems: 2,
  maximumEvidenceReferences: 4,
};
function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    itemId: id,
    kind: "observation" as const,
    sequence: 1,
    priority: 1,
    required: false,
    sourceIdentity: "source:1",
    content: { id },
    evidenceReferences: [],
    ...overrides,
  };
}
describe("KTS-I4-D bounded working memory", () => {
  for (const kind of WORKING_MEMORY_ITEM_KINDS)
    it(`accepts item kind ${kind}`, () =>
      expect(createWorkingMemoryItem(item(`item:${kind}`, { kind }))).toMatchObject({ kind }));
  it("computes serialized characters", () =>
    expect(createWorkingMemoryItem(item("item:1")).serializedCharacters).toBeGreaterThan(0));
  it("freezes an item", () =>
    expect(Object.isFrozen(createWorkingMemoryItem(item("item:1")))).toBe(true));
  it("preserves required items first", () =>
    expect(
      assembleWorkingMemory([item("optional"), item("required", { required: true, sequence: 2 })], {
        ...budget,
        maximumItemCount: 1,
      }).items[0]?.itemId,
    ).toBe("required"));
  it("orders higher priority first for packing", () =>
    expect(
      assembleWorkingMemory(
        [item("low", { priority: 1 }), item("high", { priority: 9, sequence: 2 })],
        { ...budget, maximumItemCount: 1 },
      ).items[0]?.itemId,
    ).toBe("high"));
  it("uses lower sequence as tie breaker", () =>
    expect(
      assembleWorkingMemory([item("later", { sequence: 2 }), item("earlier", { sequence: 1 })], {
        ...budget,
        maximumItemCount: 1,
      }).items[0]?.itemId,
    ).toBe("earlier"));
  it("uses identity as final tie breaker", () =>
    expect(
      assembleWorkingMemory([item("item:b"), item("item:a")], { ...budget, maximumItemCount: 1 })
        .items[0]?.itemId,
    ).toBe("item:a"));
  it("returns selected items in source sequence order", () =>
    expect(
      assembleWorkingMemory(
        [item("two", { sequence: 2, priority: 9 }), item("one", { sequence: 1, priority: 1 })],
        budget,
      ).items.map((x) => x.itemId),
    ).toEqual(["one", "two"]));
  it("reports item-count omission", () =>
    expect(
      assembleWorkingMemory([item("one"), item("two", { sequence: 2 })], {
        ...budget,
        maximumItemCount: 1,
      }).omissions[0]?.reason,
    ).toBe("item_count"));
  it("reports character omission", () =>
    expect(
      assembleWorkingMemory([item("one", { content: { large: "x".repeat(100) } })], {
        ...budget,
        maximumSerializedCharacters: 10,
      }).omissions[0]?.reason,
    ).toBe("serialized_characters"));
  it("reports retrieved-memory omission", () =>
    expect(
      assembleWorkingMemory(
        [
          item("one", { kind: "retrieved_memory" }),
          item("two", { kind: "retrieved_memory", sequence: 2 }),
        ],
        { ...budget, maximumRetrievedMemoryItems: 1 },
      ).omissions[0]?.reason,
    ).toBe("retrieved_memory_count"));
  it("reports evidence-reference omission", () =>
    expect(
      assembleWorkingMemory([item("one", { evidenceReferences: ["e:1", "e:2"] })], {
        ...budget,
        maximumEvidenceReferences: 1,
      }).omissions[0]?.reason,
    ).toBe("evidence_reference_count"));
  it("fails when required item exceeds item budget", () =>
    expect(() =>
      assembleWorkingMemory([item("required", { required: true })], {
        ...budget,
        maximumItemCount: 0,
      }),
    ).toThrow());
  it("fails when required item exceeds character budget", () =>
    expect(() =>
      assembleWorkingMemory(
        [item("required", { required: true, content: { large: "x".repeat(100) } })],
        { ...budget, maximumSerializedCharacters: 10 },
      ),
    ).toThrow());
  it("counts retrieved memories", () =>
    expect(
      assembleWorkingMemory([item("one", { kind: "retrieved_memory" })], budget)
        .usedRetrievedMemoryItems,
    ).toBe(1));
  it("counts evidence references", () =>
    expect(
      assembleWorkingMemory([item("one", { evidenceReferences: ["e:1", "e:2"] })], budget)
        .usedEvidenceReferences,
    ).toBe(2));
  it("rejects duplicate item IDs", () =>
    expect(() =>
      assembleWorkingMemory([item("same"), item("same", { sequence: 2 })], budget),
    ).toThrow());
  it("rejects duplicate evidence references", () =>
    expect(() =>
      createWorkingMemoryItem(item("item:1", { evidenceReferences: ["e:1", "e:1"] })),
    ).toThrow());
  it("does not mutate drafts", () => {
    const drafts = [item("one")];
    const before = JSON.stringify(drafts);
    assembleWorkingMemory(drafts, budget);
    expect(JSON.stringify(drafts)).toBe(before);
  });
  it("freezes the assembly", () =>
    expect(Object.isFrozen(assembleWorkingMemory([item("one")], budget))).toBe(true));
  it("supports zero optional items", () =>
    expect(assembleWorkingMemory([], budget).items).toEqual([]));
});

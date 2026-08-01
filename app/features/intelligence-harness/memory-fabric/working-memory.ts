import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "./canonical-json";
import { validatePublicIdentity } from "./evidence-contract";
import { failMemory } from "./failures";

export const WORKING_MEMORY_ITEM_KINDS = Object.freeze([
  "observation",
  "instruction",
  "inference",
  "retrieved_memory",
  "evidence_reference",
] as const);
export type WorkingMemoryItemKind = (typeof WORKING_MEMORY_ITEM_KINDS)[number];

export interface WorkingMemoryItemDraft {
  readonly itemId: string;
  readonly kind: WorkingMemoryItemKind;
  readonly sequence: number;
  readonly priority: number;
  readonly required: boolean;
  readonly sourceIdentity: string;
  readonly content: JsonValue;
  readonly evidenceReferences?: readonly string[];
}
export interface WorkingMemoryItem extends WorkingMemoryItemDraft {
  readonly serializedCharacters: number;
}
export interface WorkingMemoryBudget {
  readonly maximumItemCount: number;
  readonly maximumSerializedCharacters: number;
  readonly maximumRetrievedMemoryItems: number;
  readonly maximumEvidenceReferences: number;
}
export interface WorkingMemoryOmission {
  readonly itemId: string;
  readonly reason:
    "item_count" | "serialized_characters" | "retrieved_memory_count" | "evidence_reference_count";
}
export interface WorkingMemoryAssembly {
  readonly items: readonly Readonly<WorkingMemoryItem>[];
  readonly omissions: readonly Readonly<WorkingMemoryOmission>[];
  readonly usedSerializedCharacters: number;
  readonly usedEvidenceReferences: number;
  readonly usedRetrievedMemoryItems: number;
}

export function assembleWorkingMemory(
  drafts: readonly Readonly<WorkingMemoryItemDraft>[],
  budget: Readonly<WorkingMemoryBudget>,
): Readonly<WorkingMemoryAssembly> {
  validateBudget(budget);
  const items = drafts.map(createWorkingMemoryItem);
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.itemId))
      failMemory(
        "invalid_memory_request",
        "working_memory",
        "Working-memory item IDs must be unique.",
      );
    ids.add(item.itemId);
  }
  const ordered = [...items].sort(
    (left, right) =>
      Number(right.required) - Number(left.required) ||
      right.priority - left.priority ||
      left.sequence - right.sequence ||
      left.itemId.localeCompare(right.itemId),
  );
  const selected: WorkingMemoryItem[] = [];
  const omissions: WorkingMemoryOmission[] = [];
  let chars = 0;
  let refs = 0;
  let retrieved = 0;
  for (const item of ordered) {
    const itemRefs = item.evidenceReferences?.length ?? 0;
    const reason =
      selected.length >= budget.maximumItemCount
        ? "item_count"
        : chars + item.serializedCharacters > budget.maximumSerializedCharacters
          ? "serialized_characters"
          : item.kind === "retrieved_memory" && retrieved >= budget.maximumRetrievedMemoryItems
            ? "retrieved_memory_count"
            : refs + itemRefs > budget.maximumEvidenceReferences
              ? "evidence_reference_count"
              : null;
    if (reason !== null) {
      if (item.required) {
        failMemory(
          "required_working_memory_omitted",
          "working_memory",
          "A required working-memory item cannot fit the budget.",
          { diagnostics: { itemId: item.itemId, reason } },
        );
      }
      omissions.push({ itemId: item.itemId, reason });
      continue;
    }
    selected.push(item);
    chars += item.serializedCharacters;
    refs += itemRefs;
    if (item.kind === "retrieved_memory") retrieved += 1;
  }
  return deepFreezeJson({
    items: selected.sort((a, b) => a.sequence - b.sequence || a.itemId.localeCompare(b.itemId)),
    omissions,
    usedSerializedCharacters: chars,
    usedEvidenceReferences: refs,
    usedRetrievedMemoryItems: retrieved,
  }) as Readonly<WorkingMemoryAssembly>;
}

export function createWorkingMemoryItem(
  draft: Readonly<WorkingMemoryItemDraft>,
): Readonly<WorkingMemoryItem> {
  validatePublicIdentity(draft.itemId, "itemId");
  validatePublicIdentity(draft.sourceIdentity, "sourceIdentity");
  if (!WORKING_MEMORY_ITEM_KINDS.includes(draft.kind))
    failMemory(
      "invalid_memory_request",
      "working_memory",
      "Working-memory item kind is unsupported.",
    );
  if (
    !Number.isSafeInteger(draft.sequence) ||
    draft.sequence < 0 ||
    !Number.isSafeInteger(draft.priority)
  ) {
    failMemory(
      "invalid_memory_request",
      "working_memory",
      "Working-memory sequence or priority is invalid.",
    );
  }
  const evidenceReferences = [...(draft.evidenceReferences ?? [])];
  evidenceReferences.forEach((id) => validatePublicIdentity(id, "evidenceReference"));
  if (new Set(evidenceReferences).size !== evidenceReferences.length)
    failMemory("invalid_memory_request", "working_memory", "Evidence references must be unique.");
  const normalized = canonicalizeJson({
    ...draft,
    evidenceReferences,
  }) as unknown as WorkingMemoryItemDraft;
  return deepFreezeJson({
    ...normalized,
    serializedCharacters: canonicalStringify(normalized).length,
  }) as Readonly<WorkingMemoryItem>;
}

function validateBudget(budget: Readonly<WorkingMemoryBudget>): void {
  for (const value of Object.values(budget)) {
    if (!Number.isSafeInteger(value) || value < 0)
      failMemory("invalid_budget", "working_memory", "Working-memory budget is invalid.");
  }
  if (budget.maximumSerializedCharacters < 1)
    failMemory(
      "invalid_budget",
      "working_memory",
      "Working-memory character budget must be positive.",
    );
}

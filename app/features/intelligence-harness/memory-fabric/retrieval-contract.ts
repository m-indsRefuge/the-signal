import type {
  AcceptanceState,
  DataClassification,
  EvidenceSourceType,
  RetentionClass,
} from "./evidence-contract";
import type { MemoryKind } from "./memory-contract";
import { failMemory } from "./failures";

export interface RetrievalBudget {
  readonly resultLimit: number;
  readonly maximumSerializedCharacters: number;
  readonly relationTraversalLimit: number;
}

export interface RecordAccessPolicy {
  readonly requestId: string;
  readonly allowedDomains: readonly string[];
  readonly allowedClassifications: readonly DataClassification[];
  readonly acceptedRetentionClasses: readonly RetentionClass[];
}

export interface EvidenceQuery extends RecordAccessPolicy {
  readonly budget: RetrievalBudget;
  readonly evidenceIds?: readonly string[];
  readonly sourceTypes?: readonly EvidenceSourceType[];
  readonly acceptanceStates?: readonly AcceptanceState[];
  readonly tags?: readonly string[];
  readonly recordedAtFrom?: string;
  readonly recordedAtTo?: string;
  readonly authoritativeTickFrom?: number;
  readonly authoritativeTickTo?: number;
  readonly relationType?: "lineage" | "contradiction";
  readonly relationEvidenceId?: string;
}

export interface MemoryQuery extends RecordAccessPolicy {
  readonly budget: RetrievalBudget;
  readonly memoryIds?: readonly string[];
  readonly memoryKinds?: readonly MemoryKind[];
  readonly acceptanceStates?: readonly AcceptanceState[];
  readonly tags?: readonly string[];
  readonly recordedAtFrom?: string;
  readonly recordedAtTo?: string;
  readonly relationType?: "direct" | "contradiction";
  readonly relationMemoryId?: string;
  readonly attachedEvidenceId?: string;
}

export interface RetrievalMetadata {
  readonly sourceMatchCount?: number;
  readonly returnedCount: number;
  readonly omittedCount?: number;
  readonly truncated: boolean;
  readonly serializedCharacters: number;
  readonly orderingPolicy: string;
  readonly appliedFilters: readonly string[];
}

export interface RetrievalResult<T> {
  readonly records: readonly Readonly<T>[];
  readonly metadata: Readonly<RetrievalMetadata>;
}

export function validateRetrievalBudget(budget: Readonly<RetrievalBudget>): void {
  if (
    !Number.isSafeInteger(budget.resultLimit) ||
    budget.resultLimit < 1 ||
    !Number.isSafeInteger(budget.maximumSerializedCharacters) ||
    budget.maximumSerializedCharacters < 1 ||
    !Number.isSafeInteger(budget.relationTraversalLimit) ||
    budget.relationTraversalLimit < 0
  ) {
    failMemory("invalid_budget", "retrieval", "Retrieval budget is invalid.");
  }
}

export function validateAccessPolicy(policy: Readonly<RecordAccessPolicy>): void {
  if (
    !policy.requestId ||
    policy.allowedDomains.length === 0 ||
    policy.allowedClassifications.length === 0 ||
    policy.acceptedRetentionClasses.length === 0
  ) {
    failMemory(
      "retrieval_not_authorized",
      "retrieval",
      "Retrieval requires explicit domain, classification, and retention allowlists.",
      { requestId: policy.requestId },
    );
  }
}

export function authoritativeTickOf(position: unknown): number | null {
  if (typeof position !== "object" || position === null) return null;
  const tick = (position as Record<string, unknown>).tick;
  return Number.isSafeInteger(tick) && (tick as number) >= 0 ? (tick as number) : null;
}

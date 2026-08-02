import { DEMONSTRATION_MAXIMA } from "./demonstration-contract";
import { detectDuplicate } from "./duplicate-detector";
import type { DemonstrationEvidenceRecord } from "./evidence-record";
import { evidenceDigest, freezeDeep, serializedCharacters } from "./evidence-digest";
import { failDemonstration } from "./failures";
import type {
  QuarantineListResult,
  QuarantineRegistrationResult,
  QuarantineSnapshot,
} from "./quarantine-contract";
import type { ReviewRecord } from "./review-record";

export class QuarantineLedger {
  readonly #records = new Map<string, DemonstrationEvidenceRecord>();
  readonly #reviews = new Map<string, ReviewRecord>();
  #disposed = false;

  get disposed(): boolean {
    return this.#disposed;
  }

  register(record: DemonstrationEvidenceRecord): QuarantineRegistrationResult {
    this.#assertActive();
    const existing = [...this.#records.values()];
    const duplicate = detectDuplicate(record, existing);
    if (duplicate.classification === "exact_duplicate") {
      return freezeDeep({
        classification: "exact_duplicate" as const,
        record: this.#records.get(record.recordId) ?? record,
        matchedRecordIds: duplicate.matchedRecordIds,
      });
    }
    if (duplicate.classification === "conflicting_duplicate") {
      return freezeDeep({
        classification: "conflicting_duplicate" as const,
        record,
        matchedRecordIds: duplicate.matchedRecordIds,
      });
    }
    if (this.#records.size >= DEMONSTRATION_MAXIMA.quarantineRecords) {
      return failDemonstration("record_budget_exceeded", "Quarantine record budget exceeded.");
    }
    this.#records.set(record.recordId, freezeDeep(record));
    return freezeDeep({
      classification:
        duplicate.classification === "structural_duplicate"
          ? ("structural_duplicate" as const)
          : ("registered" as const),
      record,
      matchedRecordIds: duplicate.matchedRecordIds,
    });
  }

  registerReview(review: ReviewRecord): ReviewRecord {
    this.#assertActive();
    const evidence = this.#records.get(review.evidenceRecordId);
    if (evidence === undefined || evidence.recordDigest !== review.evidenceRecordDigest) {
      return failDemonstration(
        "unsupported_review_transition",
        "Review does not bind an exact quarantined record.",
      );
    }
    const existing = this.#reviews.get(review.reviewId);
    if (existing !== undefined) {
      if (existing.reviewDigest !== review.reviewDigest) {
        return failDemonstration("duplicate_identity_conflict", "Review identity was reused.");
      }
      return existing;
    }
    if (this.#reviews.size >= DEMONSTRATION_MAXIMA.reviewRecords) {
      return failDemonstration("record_budget_exceeded", "Review record budget exceeded.");
    }
    this.#reviews.set(review.reviewId, freezeDeep(review));
    return freezeDeep(review);
  }

  get(recordId: string): DemonstrationEvidenceRecord | null {
    this.#assertActive();
    const record = this.#records.get(recordId);
    return record === undefined ? null : freezeDeep(record);
  }

  list(limit = DEMONSTRATION_MAXIMA.returnedRecords): QuarantineListResult {
    this.#assertActive();
    if (
      !Number.isSafeInteger(limit) ||
      limit <= 0 ||
      limit > DEMONSTRATION_MAXIMA.returnedRecords
    ) {
      return failDemonstration("record_budget_exceeded", "List limit is invalid.");
    }
    const all = [...this.#records.values()].sort((left, right) =>
      left.recordId < right.recordId ? -1 : left.recordId > right.recordId ? 1 : 0,
    );
    return freezeDeep({
      records: Object.freeze(all.slice(0, limit)),
      totalRecords: all.length,
      truncated: all.length > limit,
    });
  }

  snapshot(): QuarantineSnapshot {
    this.#assertActive();
    const records = this.list().records;
    const reviews = [...this.#reviews.values()].sort((left, right) =>
      left.reviewId < right.reviewId ? -1 : left.reviewId > right.reviewId ? 1 : 0,
    );
    const body = freezeDeep({
      records,
      reviews: Object.freeze(reviews),
      recordCount: records.length,
      reviewCount: reviews.length,
      truncated: false,
    });
    const snapshot = freezeDeep({ ...body, snapshotDigest: evidenceDigest(body) });
    if (serializedCharacters(snapshot) > DEMONSTRATION_MAXIMA.quarantineSnapshotCharacters) {
      return failDemonstration(
        "serialized_size_exceeded",
        "Quarantine snapshot exceeds size budget.",
      );
    }
    return snapshot;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#records.clear();
    this.#reviews.clear();
    this.#disposed = true;
  }

  #assertActive(): void {
    if (this.#disposed) {
      return failDemonstration("controller_disposed", "Quarantine ledger is disposed.");
    }
  }
}

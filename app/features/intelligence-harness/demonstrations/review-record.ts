import { DEMONSTRATION_MAXIMA } from "./demonstration-contract";
import { evidenceDigest, freezeDeep, serializedCharacters } from "./evidence-digest";
import type { ReviewRecordInput } from "./review-contract";
import { validateReviewInput } from "./review-contract";
import { failDemonstration } from "./failures";

export interface ReviewRecord extends ReviewRecordInput {
  readonly datasetAdmission: "not_performed";
  readonly reviewDigest: string;
}

export function createReviewRecord(input: ReviewRecordInput): ReviewRecord {
  const validated = validateReviewInput(input);
  const body = freezeDeep({ ...validated, datasetAdmission: "not_performed" as const });
  const record = freezeDeep({ ...body, reviewDigest: evidenceDigest(body) });
  if (serializedCharacters(record) > DEMONSTRATION_MAXIMA.reviewRecordCharacters) {
    return failDemonstration("serialized_size_exceeded", "Review record exceeds size budget.");
  }
  return record;
}

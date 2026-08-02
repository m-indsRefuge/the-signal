import { digestCanonical } from "./admission-contract";
import type { AdmissionDecision } from "./admission-decision";

export function computeDecisionDigest(decision: Omit<AdmissionDecision, "decisionDigest">): string {
  return digestCanonical(decision);
}

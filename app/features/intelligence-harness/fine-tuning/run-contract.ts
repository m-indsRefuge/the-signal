import {
  canonicalStringify,
  canonicalizeJson,
  deepFreezeJson,
  type JsonValue,
} from "../memory-fabric/canonical-json";
import { isSha256Hex, sha256Hex } from "../memory-fabric/digest";
import { failFineTuning, validateFineTuningIdentity } from "./failures";
export const RUN_STATES = Object.freeze([
  "draft",
  "validated",
  "authorized",
  "preflight_failed",
  "running",
  "stopped",
  "completed",
  "failed",
  "cancelled",
  "quarantined",
  "evaluated",
  "rejected",
  "experiment_accepted",
] as const);
export type RunState = (typeof RUN_STATES)[number];
const transitions: Readonly<Record<RunState, readonly RunState[]>> = Object.freeze({
  draft: Object.freeze(["validated", "rejected"]),
  validated: Object.freeze(["authorized", "preflight_failed", "rejected"]),
  authorized: Object.freeze(["running", "preflight_failed", "cancelled"]),
  preflight_failed: Object.freeze(["rejected", "quarantined"]),
  running: Object.freeze(["stopped", "completed", "failed", "cancelled"]),
  stopped: Object.freeze(["evaluated", "rejected", "quarantined"]),
  completed: Object.freeze(["evaluated", "quarantined"]),
  failed: Object.freeze(["evaluated", "rejected", "quarantined"]),
  cancelled: Object.freeze(["evaluated", "rejected"]),
  quarantined: Object.freeze(["rejected"]),
  evaluated: Object.freeze(["rejected", "experiment_accepted", "quarantined"]),
  rejected: Object.freeze([]),
  experiment_accepted: Object.freeze([]),
} as Record<RunState, readonly RunState[]>);
export interface RunRecordDraft {
  readonly runId: string;
  readonly runVersion: string;
  readonly trainingPlanDigest: string;
  readonly state: RunState;
  readonly priorState?: RunState;
  readonly transitionReason: string;
  readonly sequence: number;
}
export interface RunRecord extends RunRecordDraft {
  readonly contentDigest: string;
}
export function canTransitionRun(from: RunState, to: RunState): boolean {
  return (transitions[from] ?? []).includes(to);
}
export async function createRunRecord(
  draft: Readonly<RunRecordDraft>,
): Promise<Readonly<RunRecord>> {
  validateFineTuningIdentity(draft.runId, "runId", "invalid_experiment_identity");
  validateFineTuningIdentity(draft.runVersion, "runVersion", "invalid_experiment_identity");
  if (
    !isSha256Hex(draft.trainingPlanDigest) ||
    !RUN_STATES.includes(draft.state) ||
    !Number.isSafeInteger(draft.sequence) ||
    draft.sequence < 0 ||
    draft.transitionReason.trim() === ""
  )
    failFineTuning("invalid_experiment", "run", "Run record is invalid.");
  if (draft.priorState !== undefined && !canTransitionRun(draft.priorState, draft.state))
    failFineTuning("invalid_experiment", "run", "Run state transition is not permitted.");
  const normalized = canonicalizeJson(draft) as unknown as RunRecordDraft;
  const contentDigest = await sha256Hex(canonicalStringify(normalized));
  return deepFreezeJson({
    ...normalized,
    contentDigest,
  } as unknown as JsonValue) as unknown as Readonly<RunRecord>;
}

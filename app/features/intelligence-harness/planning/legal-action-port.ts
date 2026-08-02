import { stableDigest } from "./candidate-digest";
import { fail } from "./failures";
import type { SimulatedState } from "./simulation-port";

export interface LegalAction {
  readonly actionId: string;
  readonly actionType: string;
  readonly resourceCost: number;
  readonly payloadDigest: string;
}

export interface LegalActionSet {
  readonly stateDigest: string;
  readonly schemaVersion: string;
  readonly actions: readonly LegalAction[];
  readonly digest: string;
}

export interface LegalActionPort {
  readonly schemaVersion: string;
  enumerate(state: SimulatedState): LegalActionSet;
}

export function createLegalAction(
  actionId: string,
  actionType: string,
  resourceCost: number,
  payload: unknown,
): LegalAction {
  if (
    !actionId.trim() ||
    !actionType.trim() ||
    !Number.isFinite(resourceCost) ||
    resourceCost < 0
  ) {
    return fail("invalid_legal_action_set", "Legal action is malformed.");
  }
  return Object.freeze({
    actionId: actionId.trim(),
    actionType: actionType.trim(),
    resourceCost,
    payloadDigest: stableDigest(payload),
  });
}

export function createLegalActionSet(
  stateDigest: string,
  schemaVersion: string,
  actions: readonly LegalAction[],
): LegalActionSet {
  if (!stateDigest || !schemaVersion) {
    return fail("invalid_legal_action_set", "Legal-action set identity is incomplete.");
  }
  const sorted = [...actions].sort((left, right) =>
    left.actionId < right.actionId ? -1 : left.actionId > right.actionId ? 1 : 0,
  );
  const ids = new Set(sorted.map((action) => action.actionId));
  if (ids.size !== sorted.length) {
    return fail("invalid_legal_action_set", "Legal-action identities must be unique.");
  }
  const frozenActions = Object.freeze(sorted.map((action) => Object.freeze({ ...action })));
  return Object.freeze({
    stateDigest,
    schemaVersion,
    actions: frozenActions,
    digest: stableDigest({ stateDigest, schemaVersion, actions: frozenActions }),
  });
}

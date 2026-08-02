import {
  createLegalAction,
  createLegalActionSet,
  type LegalActionSet,
} from "../../intelligence-harness/planning";

export interface KtsLegalActionInput {
  readonly actionId: string;
  readonly actionType: string;
  readonly resourceCost: number;
  readonly payload: unknown;
}

export function projectKtsLegalActions(
  stateDigest: string,
  schemaVersion: string,
  inputs: readonly KtsLegalActionInput[],
): LegalActionSet {
  return createLegalActionSet(
    stateDigest,
    schemaVersion,
    inputs.map((input) =>
      createLegalAction(input.actionId, input.actionType, input.resourceCost, input.payload),
    ),
  );
}

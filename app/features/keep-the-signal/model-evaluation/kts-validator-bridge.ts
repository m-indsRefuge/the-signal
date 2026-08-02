import {
  evaluateParsedResponse,
  type ParsedResponse,
  type ValidatorEvidence,
} from "../../intelligence-harness/model-evaluation";

export function validateKtsParsedResponse(
  parsed: ParsedResponse,
  legalActions: readonly string[],
): ValidatorEvidence {
  return evaluateParsedResponse(parsed, (proposal) => {
    if (proposal.kind === "abstain") {
      return {
        schemaAccepted: typeof proposal.reason === "string",
        legalActionAccepted: true,
        accepted: typeof proposal.reason === "string",
        reasonCodes: typeof proposal.reason === "string" ? [] : ["abstention_reason_required"],
      };
    }
    if (proposal.kind !== "proposal" || !Array.isArray(proposal.actions)) {
      return {
        schemaAccepted: false,
        legalActionAccepted: false,
        accepted: false,
        reasonCodes: ["proposal_schema_invalid"],
      };
    }
    const actionKinds = proposal.actions.map((action) =>
      typeof action === "object" && action !== null
        ? String((action as Record<string, unknown>).kind ?? "")
        : "",
    );
    const legal = actionKinds.every((kind) => legalActions.includes(kind));
    return {
      schemaAccepted: true,
      legalActionAccepted: legal,
      accepted: legal,
      reasonCodes: legal ? [] : ["illegal_action"],
    };
  });
}

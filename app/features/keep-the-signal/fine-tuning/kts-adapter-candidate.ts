import {
  createAdapterRecord,
  type AdapterDraft,
} from "../../intelligence-harness/fine-tuning/adapter-contract";
import { failFineTuning } from "../../intelligence-harness/fine-tuning/failures";
export interface KtsAdapterCandidateDraft extends AdapterDraft {
  readonly role: "signal_officer_tactical_adviser";
  readonly proposalSchemaId: string;
  readonly observationSchemaId: string;
}
export async function createKtsAdapterCandidate(draft: Readonly<KtsAdapterCandidateDraft>) {
  const { role, proposalSchemaId, observationSchemaId, ...adapter } = draft;
  if (
    role !== "signal_officer_tactical_adviser" ||
    proposalSchemaId.trim() === "" ||
    observationSchemaId.trim() === ""
  )
    failFineTuning("adapter_invalid", "kts-adapter", "KTS adapter role or schemas are invalid.");
  return createAdapterRecord(adapter);
}

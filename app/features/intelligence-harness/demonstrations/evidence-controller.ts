import { createEvidenceInput, type DemonstrationEvidenceInput } from "./evidence-input";
import {
  createDemonstrationEvidenceRecord,
  type DemonstrationEvidenceRecord,
} from "./evidence-record";
import { failDemonstration } from "./failures";
import { deriveQualityLabels, type QualityFacts } from "./quality-policy";
import { deriveEvidenceRiskLabels, type EvidenceRiskFacts } from "./risk-classification";

export interface EvidenceGenerationRequest {
  readonly input: DemonstrationEvidenceInput;
  readonly qualityFacts: QualityFacts;
  readonly riskFacts: EvidenceRiskFacts;
  readonly cancelGeneration?: boolean;
}

export class DemonstrationEvidenceController {
  #disposed = false;

  get disposed(): boolean {
    return this.#disposed;
  }

  generate(request: EvidenceGenerationRequest): DemonstrationEvidenceRecord {
    if (this.#disposed) {
      return failDemonstration("controller_disposed", "Evidence controller is disposed.");
    }
    if (request.cancelGeneration === true) {
      return failDemonstration("generation_cancelled", "Evidence generation was cancelled.");
    }
    const input = createEvidenceInput(request.input);
    const quality = deriveQualityLabels(request.qualityFacts);
    const risk = deriveEvidenceRiskLabels(request.riskFacts);
    return createDemonstrationEvidenceRecord(input, quality, risk);
  }

  dispose(): void {
    this.#disposed = true;
  }
}

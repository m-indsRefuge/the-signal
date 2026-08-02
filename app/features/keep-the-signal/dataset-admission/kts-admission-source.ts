import {
  createAdmissionRequest,
  type AdmissionRequest,
} from "../../intelligence-harness/dataset-admission";

export type KtsAdmissionSource = AdmissionRequest;

export function createKtsAdmissionSource(source: KtsAdmissionSource): KtsAdmissionSource {
  return createAdmissionRequest(source);
}

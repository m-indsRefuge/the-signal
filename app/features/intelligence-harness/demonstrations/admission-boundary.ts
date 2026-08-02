import { failDemonstration } from "./failures";

export interface AdmissionBoundaryState {
  readonly trainingAdmission: "not_evaluated";
  readonly datasetAdmission: "not_performed";
  readonly exportAuthorization: "absent";
}

export function createAdmissionBoundaryState(): AdmissionBoundaryState {
  return Object.freeze({
    trainingAdmission: "not_evaluated" as const,
    datasetAdmission: "not_performed" as const,
    exportAuthorization: "absent" as const,
  });
}

export function rejectAdmissionOrExportRequest(
  request: "dataset_admission" | "dataset_export",
): never {
  return failDemonstration(
    request === "dataset_admission" ? "admission_not_authorized" : "export_not_authorized",
    `${request} is outside KTS-I4-J authority.`,
  );
}

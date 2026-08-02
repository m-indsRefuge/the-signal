import { describe, expect, it } from "vitest";
import {
  DATASET_ADMISSION_STATES,
  DEMONSTRATION_FAILURE_CODES,
  DEMONSTRATION_MAXIMA,
  DEMONSTRATION_OUTCOMES,
  EVIDENCE_RISK_LABELS,
  EXPORT_AUTHORIZATION_STATES,
  QUALITY_LABELS,
  QUARANTINE_STATES,
  TRAINING_ADMISSION_STATES,
  createAdmissionBoundaryState,
  rejectAdmissionOrExportRequest,
  requireDigest,
  requireIdentity,
  requirePositiveSafeInteger,
  requireTimestamp,
} from "../app/features/intelligence-harness/demonstrations";

describe("KTS-I4-J demonstration contract", () => {
  for (const value of DEMONSTRATION_OUTCOMES) {
    it(`exports outcome ${value}`, () => expect(value).toMatch(/^[a-z_]+$/));
  }
  for (const value of QUALITY_LABELS) {
    it(`exports quality label ${value}`, () => expect(value.length).toBeGreaterThan(3));
  }
  for (const value of EVIDENCE_RISK_LABELS) {
    it(`exports risk label ${value}`, () => expect(value.length).toBeGreaterThan(3));
  }
  for (const value of DEMONSTRATION_FAILURE_CODES) {
    it(`exports failure code ${value}`, () => expect(value).toMatch(/^[a-z_]+$/));
  }
  it("exports quarantine state", () => expect(QUARANTINE_STATES).toEqual(["quarantined"]));
  it("exports training admission state", () =>
    expect(TRAINING_ADMISSION_STATES).toEqual(["not_evaluated"]));
  it("exports dataset admission state", () =>
    expect(DATASET_ADMISSION_STATES).toEqual(["not_performed"]));
  it("exports absent authorization", () => expect(EXPORT_AUTHORIZATION_STATES).toEqual(["absent"]));
  it("creates boundary state", () =>
    expect(createAdmissionBoundaryState().datasetAdmission).toBe("not_performed"));
  it("rejects dataset admission", () =>
    expect(() => rejectAdmissionOrExportRequest("dataset_admission")).toThrow());
  it("rejects dataset export", () =>
    expect(() => rejectAdmissionOrExportRequest("dataset_export")).toThrow());
  it("accepts canonical identity", () =>
    expect(requireIdentity("record-1", "record")).toBe("record-1"));
  it("rejects invalid identity", () =>
    expect(() => requireIdentity("bad identity", "record")).toThrow());
  it("accepts digest", () => expect(requireDigest("a".repeat(32), "digest")).toBe("a".repeat(32)));
  it("rejects digest", () => expect(() => requireDigest("no", "digest")).toThrow());
  it("accepts timestamp", () => expect(requireTimestamp("2026-08-02T18:00:00Z")).toContain("2026"));
  it("rejects timestamp", () => expect(() => requireTimestamp("today")).toThrow());
  for (let index = 1; index <= 12; index += 1) {
    it(`validates positive bounded integer ${index}`, () =>
      expect(requirePositiveSafeInteger(index, 64, "value")).toBe(index));
  }
  it("publishes 10000 record maximum", () =>
    expect(DEMONSTRATION_MAXIMA.evidenceRecordsPerBatch).toBe(10000));
});

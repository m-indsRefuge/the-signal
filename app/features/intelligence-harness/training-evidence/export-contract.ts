import { canonicalStringify, deepFreezeJson } from "../memory-fabric/canonical-json";
import { sha256Hex } from "../memory-fabric/digest";
import { failTraining, validateTrainingIdentity } from "./failures";
export const EXPORT_FORMATS = Object.freeze(["json", "jsonl", "manifest_only"] as const);
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
export interface ExportDraft {
  readonly manifestId: string;
  readonly manifestVersion: string;
  readonly format: ExportFormat;
  readonly orderedExampleIds: readonly string[];
  readonly serializedCharacterCount: number;
  readonly segmentDigests: readonly string[];
  readonly totalDigest: string;
  readonly omittedCount: number;
  readonly quarantinedCount: number;
  readonly formatVersion: string;
}
export async function createExportDraft(
  manifestId: string,
  manifestVersion: string,
  format: ExportFormat,
  exampleIds: readonly string[],
  maximumCharacters: number,
  omittedCount: number,
  quarantinedCount: number,
): Promise<Readonly<ExportDraft>> {
  validateTrainingIdentity(manifestId, "manifestId", "invalid_export_draft", "export");
  validateTrainingIdentity(manifestVersion, "manifestVersion", "invalid_export_draft", "export");
  if (
    !EXPORT_FORMATS.includes(format) ||
    !Number.isSafeInteger(maximumCharacters) ||
    maximumCharacters < 1
  )
    failTraining("invalid_export_draft", "export", "Export request is invalid.");
  const ordered = [...new Set(exampleIds)].sort();
  const serialized = canonicalStringify({ manifestId, manifestVersion, format, ordered });
  if (serialized.length > maximumCharacters)
    failTraining("export_budget_exceeded", "export", "Export draft exceeds character budget.");
  const segmentDigests = [];
  for (let i = 0; i < ordered.length; i += 1000)
    segmentDigests.push(await sha256Hex(canonicalStringify(ordered.slice(i, i + 1000))));
  const totalDigest = await sha256Hex(serialized);
  return deepFreezeJson({
    manifestId,
    manifestVersion,
    format,
    orderedExampleIds: ordered,
    serializedCharacterCount: serialized.length,
    segmentDigests,
    totalDigest,
    omittedCount,
    quarantinedCount,
    formatVersion: "1",
  }) as unknown as Readonly<ExportDraft>;
}

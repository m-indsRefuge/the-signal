export type NormalizationPolicy = Readonly<{
  unicodeForm: "NFC" | "NFKC";
  removeSingleCodeFence: boolean;
  trimSurroundingWhitespace: boolean;
}>;

export function normalizeOutput(rawText: string, policy: NormalizationPolicy): string {
  let value = rawText.normalize(policy.unicodeForm).replace(/\r\n?/g, "\n");
  if (policy.trimSurroundingWhitespace) value = value.trim();
  if (policy.removeSingleCodeFence) {
    const match = value.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
    if (match) value = match[1];
  }
  return value;
}

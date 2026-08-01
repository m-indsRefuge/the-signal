import { failMemory } from "./failures";

export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export async function sha256Hex(text: string): Promise<string> {
  if (typeof text !== "string") {
    failMemory("invalid_memory_request", "digest", "Digest input must be text.");
  }
  try {
    const bytes = new TextEncoder().encode(text);
    const output = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(output)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    failMemory("memory_internal_failure", "digest", "SHA-256 digest creation failed.");
  }
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX_PATTERN.test(value);
}

export async function verifySha256Hex(text: string, digest: string): Promise<boolean> {
  if (!isSha256Hex(digest)) {
    failMemory("invalid_digest", "digest", "Digest must be lowercase SHA-256 hexadecimal.");
  }
  const actual = await sha256Hex(text);
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ digest.charCodeAt(index);
  }
  return difference === 0;
}

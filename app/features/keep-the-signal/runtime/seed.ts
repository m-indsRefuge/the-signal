import { normalizeSeed } from "../engine";

export const MAX_UINT32 = 0xffff_ffff;

export type SeedValidationErrorCode =
  "empty" | "invalid_format" | "out_of_range" | "duplicate_query_value";

export interface ValidSeedResult {
  readonly valid: true;
  readonly seed: number;
  readonly rawValue: number;
  readonly normalizedFromZero: boolean;
}

export interface InvalidSeedResult {
  readonly valid: false;
  readonly code: SeedValidationErrorCode;
  readonly message: string;
  readonly rawInput: string;
}

export type SeedValidationResult = ValidSeedResult | InvalidSeedResult;

export type SeedQueryResult =
  | Readonly<{ status: "absent" }>
  | Readonly<{ status: "valid"; seed: number; rawValue: number; normalizedFromZero: boolean }>
  | Readonly<{
      status: "invalid";
      code: SeedValidationErrorCode;
      message: string;
      rawInput: string;
    }>;

export type RandomValuesProvider = (target: Uint32Array) => Uint32Array;

export function validateSeedText(input: string): SeedValidationResult {
  if (typeof input !== "string") {
    throw new TypeError("Seed input must be a string.");
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return invalidSeed("empty", "Enter an unsigned 32-bit integer seed.", input);
  }

  if (!/^\d+$/.test(trimmed)) {
    return invalidSeed(
      "invalid_format",
      "Seed must contain decimal digits only, without a sign or decimal point.",
      input,
    );
  }

  const rawValue = Number(trimmed);

  if (!Number.isSafeInteger(rawValue) || rawValue < 0 || rawValue > MAX_UINT32) {
    return invalidSeed("out_of_range", `Seed must be between 0 and ${MAX_UINT32}.`, input);
  }

  const seed = normalizeSeed(rawValue);

  return Object.freeze({
    valid: true,
    seed,
    rawValue,
    normalizedFromZero: rawValue === 0,
  });
}

export function readSeedFromSearch(search: string): SeedQueryResult {
  if (typeof search !== "string") {
    throw new TypeError("Search input must be a string.");
  }

  const parameters = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const seedValues = parameters.getAll("seed");

  if (seedValues.length === 0) {
    return Object.freeze({ status: "absent" });
  }

  if (seedValues.length > 1) {
    return Object.freeze({
      status: "invalid",
      code: "duplicate_query_value",
      message: "Provide only one seed query value.",
      rawInput: seedValues.join(","),
    });
  }

  const validation = validateSeedText(seedValues[0] ?? "");

  if (!validation.valid) {
    return Object.freeze({
      status: "invalid",
      code: validation.code,
      message: validation.message,
      rawInput: validation.rawInput,
    });
  }

  return Object.freeze({
    status: "valid",
    seed: validation.seed,
    rawValue: validation.rawValue,
    normalizedFromZero: validation.normalizedFromZero,
  });
}

export function generateRuntimeSeed(provider: RandomValuesProvider = defaultRandomValues): number {
  if (typeof provider !== "function") {
    throw new TypeError("Random-values provider must be a function.");
  }

  const values = new Uint32Array(1);
  const result = provider(values);

  if (result !== values) {
    throw new TypeError("Random-values provider must return the supplied Uint32Array.");
  }

  return normalizeSeed(values[0] ?? 0);
}

export function formatSeed(seed: number): string {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_UINT32) {
    throw new RangeError(`Seed must be between 0 and ${MAX_UINT32}.`);
  }

  return String(normalizeSeed(seed));
}

function defaultRandomValues(target: Uint32Array): Uint32Array {
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== "function") {
    throw new Error("Secure random seed generation is unavailable in this runtime.");
  }

  return globalThis.crypto.getRandomValues(target);
}

function invalidSeed(
  code: SeedValidationErrorCode,
  message: string,
  rawInput: string,
): InvalidSeedResult {
  return Object.freeze({
    valid: false,
    code,
    message,
    rawInput,
  });
}

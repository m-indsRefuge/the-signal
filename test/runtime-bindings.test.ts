import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { readRequiredBinding } from "../app/platform/runtime.server";

describe("Cloudflare runtime binding contract", () => {
  it("reads the configured binding inside workerd", () => {
    expect(readRequiredBinding("VALUE_FROM_CLOUDFLARE", env.VALUE_FROM_CLOUDFLARE)).toBe(
      "Hello from Cloudflare",
    );
  });

  it("normalizes surrounding whitespace", () => {
    expect(readRequiredBinding("TEST_BINDING", "  signal active  ")).toBe("signal active");
  });

  it.each([undefined, "", "   "])("rejects a missing or empty required binding: %s", (value) => {
    expect(() => readRequiredBinding("TEST_BINDING", value)).toThrow(
      "Missing required Cloudflare binding: TEST_BINDING",
    );
  });
});

import { describe, expect, it } from "vitest";
import { HttpError } from "./sandboxes";
import { assertLoginRateLimit } from "./rate-limit";

describe("assertLoginRateLimit", () => {
  it("blocks a burst from the same ip", () => {
    const ip = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i += 1) {
      assertLoginRateLimit(ip);
    }
    expect(() => assertLoginRateLimit(ip)).toThrow(HttpError);
    try {
      assertLoginRateLimit(ip);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(429);
    }
  });
});

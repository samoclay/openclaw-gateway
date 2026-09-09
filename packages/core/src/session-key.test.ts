import { describe, expect, it } from "vitest";
import {
  assertSessionKeyForSandbox,
  mintSessionKey,
} from "./session-key";

describe("mintSessionKey", () => {
  it("mints a portal key bound to sandbox and thread", () => {
    const key = mintSessionKey({
      sandboxId: "11111111-1111-1111-1111-111111111111",
      threadId: "22222222-2222-2222-2222-222222222222",
    });

    expect(key).toBe(
      "portal-11111111-1111-1111-1111-111111111111-22222222-2222-2222-2222-222222222222",
    );
    expect(key.startsWith("subagent:")).toBe(false);
    expect(key.startsWith("cron:")).toBe(false);
    expect(key.startsWith("acp:")).toBe(false);
  });
});

describe("assertSessionKeyForSandbox", () => {
  const sandboxId = "11111111-1111-1111-1111-111111111111";
  const threadId = "22222222-2222-2222-2222-222222222222";

  it("accepts a key minted for that sandbox", () => {
    const key = mintSessionKey({ sandboxId, threadId });
    expect(() => assertSessionKeyForSandbox(key, sandboxId)).not.toThrow();
  });

  it("rejects a key minted for a different sandbox", () => {
    const key = mintSessionKey({
      sandboxId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      threadId,
    });
    expect(() => assertSessionKeyForSandbox(key, sandboxId)).toThrow(
      /session key does not belong to sandbox/i,
    );
  });
});

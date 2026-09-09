import { describe, expect, it } from "vitest";
import { buildGatewayChatRequest } from "./chat-request";

describe("buildGatewayChatRequest", () => {
  it("routes to the provisioned agent and ignores client agent, session, and model", () => {
    const request = buildGatewayChatRequest({
      agentId: "sbx-client-b",
      sessionKey: "portal-sandbox-b-thread-1",
      modelRef: "ollama/qwen3:30b",
      client: {
        message: "hello",
        agentId: "sbx-client-a",
        sessionKey: "portal-sandbox-a-stolen",
        model: "ollama/tiny",
      },
    });

    expect(request.model).toBe("openclaw/sbx-client-b");
    expect(request.sessionKey).toBe("portal-sandbox-b-thread-1");
    expect(request.message).toBe("hello");
    expect(request.model).not.toContain("tiny");
    expect(request.sessionKey).not.toContain("stolen");
    expect(request.agentId).toBe("sbx-client-b");
  });

  it("rejects empty messages", () => {
    expect(() =>
      buildGatewayChatRequest({
        agentId: "sbx-a",
        sessionKey: "portal-a-t",
        modelRef: "ollama/qwen3.6:latest",
        client: { message: "   " },
      }),
    ).toThrow(/message is required/i);
  });
});

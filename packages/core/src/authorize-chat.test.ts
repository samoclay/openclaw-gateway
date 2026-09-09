import { describe, expect, it } from "vitest";
import { AccessDeniedError } from "./acl";
import { authorizeChatTurn } from "./authorize-chat";

const sandboxA = {
  id: "sandbox-a",
  openclawAgentId: "sbxa",
  modelRef: "ollama/qwen3.6:latest",
};
const sandboxB = {
  id: "sandbox-b",
  openclawAgentId: "sbxb",
  modelRef: "ollama/qwen3:30b",
};

const memberships = [
  { userId: "client-a", sandboxId: "sandbox-a" },
  { userId: "client-b", sandboxId: "sandbox-b" },
];

describe("authorizeChatTurn", () => {
  it("denies client A chatting in client B sandbox", () => {
    expect(() =>
      authorizeChatTurn({
        userId: "client-a",
        sandbox: sandboxB,
        memberships,
        threadId: "thread-1",
        client: { message: "leak please", agentId: "sbxa" },
      }),
    ).toThrow(AccessDeniedError);
  });

  it("sends client A to agent A even if they spoof B's agent, session, and model", () => {
    const turn = authorizeChatTurn({
      userId: "client-a",
      sandbox: sandboxA,
      memberships,
      threadId: "thread-1",
      client: {
        message: "hi",
        agentId: "sbxb",
        sessionKey: "portal-sandbox-b-stolen",
        model: "openclaw/sbxb",
      },
    });

    expect(turn.agentId).toBe("sbxa");
    expect(turn.sessionKey).toContain("sandbox-a");
    expect(turn.sessionKey).not.toContain("stolen");
    expect(turn.request.model).toBe("openclaw/sbxa");
  });

  it("after admin grant, client A chats only to sandbox B's agent", () => {
    const turn = authorizeChatTurn({
      userId: "client-a",
      sandbox: sandboxB,
      memberships: [
        ...memberships,
        { userId: "client-a", sandboxId: "sandbox-b" },
      ],
      threadId: "thread-9",
      client: { message: "now I can" },
    });

    expect(turn.agentId).toBe("sbxb");
    expect(turn.request.model).toBe("openclaw/sbxb");
    expect(turn.sessionKey).toContain("sandbox-b");
  });
});

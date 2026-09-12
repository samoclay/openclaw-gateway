import { describe, expect, it, vi } from "vitest";
import { postChatCompletion } from "./client";

describe("postChatCompletion", () => {
  it("sends operator token, openclaw agent model, and server session key", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

    await postChatCompletion({
      baseUrl: "http://127.0.0.1:18789",
      token: "gateway-secret",
      agentId: "sbx-b",
      sessionKey: "portal-sandbox-b-thread-1",
      message: "hello",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:18789/v1/chat/completions");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer gateway-secret");
    expect(headers.get("x-openclaw-session-key")).toBe(
      "portal-sandbox-b-thread-1",
    );
    expect(headers.get("x-openclaw-model")).toBeNull();
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("openclaw/sbx-b");
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(body.stream).toBe(true);
  });

  it("forwards the applied host model so Apply to this agent is not a no-op", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

    await postChatCompletion({
      baseUrl: "http://127.0.0.1:18789",
      token: "gateway-secret",
      agentId: "sbx-b",
      sessionKey: "portal-sandbox-b-thread-1",
      message: "hello",
      model: "llama3.1:latest",
      maxTokens: 512,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-openclaw-model")).toBe("ollama/llama3.1:latest");
    const body = JSON.parse(String(init.body));
    expect(body.max_tokens).toBe(512);
  });
});

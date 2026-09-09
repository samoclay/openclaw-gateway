import { describe, expect, it } from "vitest";
import {
  TelemetryValidationError,
  isClientForwardableSidecarType,
  stampAndValidate,
} from "./stamp";

const identity = {
  tenantId: "tenant-a",
  userId: "user-a",
  sessionId: "session-a",
  agentId: "sbxa",
  requestId: "req-a",
  sandboxId: "sandbox-a",
};

describe("stampAndValidate", () => {
  it("overwrites client-supplied tenant_id with server identity", () => {
    const event = stampAndValidate({
      type: "com.halcyon.inference.complete",
      source: "openclaw.sidecar",
      identity,
      data: {
        tenant_id: "tenant-b",
        model: "ollama/qwen3.6:latest",
        latency_ms: 120,
        prompt_tokens: 10,
        completion_tokens: 20,
        status: "ok",
      },
    });

    expect(event.tenant_id).toBe("tenant-a");
    expect(event.data).not.toHaveProperty("tenant_id");
    expect(event.specversion).toBe("1.0");
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects prompt and response fields anywhere in data", () => {
    expect(() =>
      stampAndValidate({
        type: "com.halcyon.inference.complete",
        source: "openclaw.sidecar",
        identity,
        data: { prompt: "secret question", latency_ms: 1 },
      }),
    ).toThrow(TelemetryValidationError);

    expect(() =>
      stampAndValidate({
        type: "com.halcyon.tool.result",
        source: "openclaw.sidecar",
        identity,
        data: { nested: { messages: [{ role: "user", content: "leak" }] } },
      }),
    ).toThrow(/prompt|response|messages|content/i);
  });

  it("rejects unknown event types", () => {
    expect(() =>
      stampAndValidate({
        type: "com.evil.exfiltrate",
        source: "openclaw.sidecar",
        identity,
        data: { status: "ok" },
      }),
    ).toThrow(TelemetryValidationError);
  });

  it("rejects missing server identity", () => {
    expect(() =>
      stampAndValidate({
        type: "com.halcyon.agent.task.complete",
        source: "openclaw.portal",
        identity: { ...identity, tenantId: "" },
        data: { status: "ok" },
      }),
    ).toThrow(TelemetryValidationError);
  });
});

describe("isClientForwardableSidecarType", () => {
  it("allows only chat stream types and never telemetry", () => {
    expect(isClientForwardableSidecarType("delta")).toBe(true);
    expect(isClientForwardableSidecarType("done")).toBe(true);
    expect(isClientForwardableSidecarType("error")).toBe(true);
    expect(isClientForwardableSidecarType("telemetry")).toBe(false);
    expect(isClientForwardableSidecarType("bi_analyze")).toBe(false);
  });
});

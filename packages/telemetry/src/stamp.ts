export const EVENT_TYPES = [
  "com.halcyon.agent.task.start",
  "com.halcyon.agent.task.complete",
  "com.halcyon.agent.task.fail",
  "com.halcyon.inference.request",
  "com.halcyon.inference.complete",
  "com.halcyon.inference.fail",
  "com.halcyon.tool.call",
  "com.halcyon.tool.result",
  "com.halcyon.human.intervention",
  "com.halcyon.feedback.submitted",
  "com.halcyon.business.event",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const CLIENT_FORWARDABLE_SIDECAR_TYPES = [
  "delta",
  "done",
  "error",
  "sealed",
] as const;

const STRIP_IDENTITY_KEYS = new Set([
  "tenant_id",
  "user_id",
  "session_id",
  "agent_id",
  "request_id",
  "sandbox_id",
]);

const FORBIDDEN_CONTENT_KEYS = new Set([
  "prompt",
  "prompts",
  "response",
  "responses",
  "messages",
  "message",
  "content",
  "completion",
  "completions",
  "transcript",
  "chat_history",
  "system_prompt",
  "user_message",
  "assistant_message",
  "input_text",
  "output_text",
]);

export type ServerIdentity = {
  tenantId: string;
  userId: string;
  sessionId: string;
  agentId: string;
  requestId: string;
  sandboxId: string;
};

export type HalcyonCloudEvent = {
  specversion: "1.0";
  id: string;
  source: string;
  type: EventType;
  time: string;
  tenant_id: string;
  user_id: string;
  session_id: string;
  agent_id: string;
  request_id: string;
  sandbox_id: string;
  data: Record<string, unknown>;
};

export class TelemetryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelemetryValidationError";
  }
}

export function isClientForwardableSidecarType(type: string): boolean {
  return (CLIENT_FORWARDABLE_SIDECAR_TYPES as readonly string[]).includes(type);
}

export function stampAndValidate(args: {
  type: string;
  source: string;
  identity: ServerIdentity;
  data?: Record<string, unknown>;
  now?: Date;
  id?: string;
}): HalcyonCloudEvent {
  if (!isEventType(args.type)) {
    throw new TelemetryValidationError(`unknown event type: ${args.type}`);
  }
  assertIdentity(args.identity);
  const data = sanitizeData(args.data ?? {});
  return {
    specversion: "1.0",
    id: args.id ?? crypto.randomUUID(),
    source: args.source,
    type: args.type,
    time: (args.now ?? new Date()).toISOString(),
    tenant_id: args.identity.tenantId,
    user_id: args.identity.userId,
    session_id: args.identity.sessionId,
    agent_id: args.identity.agentId,
    request_id: args.identity.requestId,
    sandbox_id: args.identity.sandboxId,
    data,
  };
}

function isEventType(type: string): type is EventType {
  return (EVENT_TYPES as readonly string[]).includes(type);
}

function assertIdentity(identity: ServerIdentity): void {
  for (const [key, value] of Object.entries(identity)) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new TelemetryValidationError(`missing server identity: ${key}`);
    }
  }
}

function sanitizeData(value: unknown, path = "data"): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TelemetryValidationError(`${path} must be an object`);
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();
    if (STRIP_IDENTITY_KEYS.has(normalized)) {
      continue;
    }
    if (FORBIDDEN_CONTENT_KEYS.has(normalized)) {
      throw new TelemetryValidationError(
        `forbidden field ${key} (prompts/responses must not be stored)`,
      );
    }
    out[key] = sanitizeValue(child, `${path}.${key}`);
  }
  return out;
}

function sanitizeValue(value: unknown, path: string): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`));
  }
  if (typeof value === "object") {
    return sanitizeData(value, path);
  }
  throw new TelemetryValidationError(`unsupported value at ${path}`);
}

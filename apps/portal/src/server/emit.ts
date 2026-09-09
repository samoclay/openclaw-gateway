import { resolveTenantId } from "@halcyon/core";
// emitUsageEvent stamps identity from the sandbox row; callers never pass tenantId.
import { stampAndValidate, type HalcyonCloudEvent } from "@halcyon/telemetry";
import type { PortalStore } from "../db/types";

export async function emitUsageEvent(
  store: PortalStore,
  args: {
    sandboxId: string;
    userId: string;
    sessionId: string;
    agentId: string;
    requestId: string;
    type: "com.halcyon.inference.complete" | "com.halcyon.inference.fail";
    latencyMs: number;
    model: string;
    status: string;
  },
): Promise<HalcyonCloudEvent | null> {
  const sandbox = await store.getSandbox(args.sandboxId);
  if (!sandbox) {
    return null;
  }
  const tenantId = resolveTenantId({ sandbox });
  const event = stampAndValidate({
    type: args.type,
    source: "openclaw.portal",
    identity: {
      tenantId,
      userId: args.userId,
      sessionId: args.sessionId,
      agentId: args.agentId,
      requestId: args.requestId,
      sandboxId: args.sandboxId,
    },
    data: {
      model: args.model,
      latency_ms: args.latencyMs,
      status: args.status,
    },
  });
  const previous = await store.getWatermark(tenantId);
  await store.putWatermark({
    tenantId,
    lastEventAt: event.time,
    lastTransformAt: previous?.lastTransformAt,
    lastInsightAt: previous?.lastInsightAt,
  });
  return event;
}

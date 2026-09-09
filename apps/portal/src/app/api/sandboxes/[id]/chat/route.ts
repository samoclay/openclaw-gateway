import { postChatCompletion } from "@halcyon/openclaw-gateway";
import { env } from "@/server/env";
import { emitUsageEvent } from "@/server/emit";
import { getPortal, getStore, jsonError, requireSession } from "@/server/session";

type Body = {
  message?: string;
  threadId?: string;
  agentId?: string;
  sessionKey?: string;
  model?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id: sandboxId } = await context.params;
    const body = (await request.json()) as Body;
    const { threadId, turn } = await getPortal().prepareChat({
      userId: session.userId,
      sandboxId,
      threadId: body.threadId,
      client: {
        message: body.message ?? "",
        agentId: body.agentId,
        sessionKey: body.sessionKey,
        model: body.model,
      },
    });

    const started = Date.now();
    const requestId = crypto.randomUUID();
    const upstream = await postChatCompletion({
      baseUrl: env.OPENCLAW_GATEWAY_URL,
      token: env.OPENCLAW_GATEWAY_TOKEN,
      agentId: turn.agentId,
      sessionKey: turn.sessionKey,
      message: turn.request.message,
    });
    void emitUsageEvent(getStore(), {
      sandboxId,
      userId: session.userId,
      sessionId: turn.sessionKey,
      agentId: turn.agentId,
      requestId,
      type: upstream.ok
        ? "com.halcyon.inference.complete"
        : "com.halcyon.inference.fail",
      latencyMs: Date.now() - started,
      model: turn.request.model,
      status: upstream.ok ? "ok" : `http_${upstream.status}`,
    }).catch(() => undefined);

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }
    headers.set("x-thread-id", threadId);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return jsonError(error);
  }
}

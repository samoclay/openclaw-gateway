import { createInsightsService } from "@/server/insights";
import { getStore, jsonError, requireSession } from "@/server/session";
import type { InsightStatus } from "@halcyon/core";

type Body = { status?: InsightStatus; tenantId?: string };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await request.json()) as Body;
    if (!body.status) {
      return Response.json({ error: "status is required" }, { status: 400 });
    }
    const insight = await createInsightsService(getStore()).updateStatus({
      userId: session.userId,
      insightId: id,
      status: body.status,
      claimedTenantId: body.tenantId,
    });
    return Response.json({ insight });
  } catch (error) {
    return jsonError(error);
  }
}

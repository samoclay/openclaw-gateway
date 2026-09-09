import { createInsightsService } from "@/server/insights";
import { getStore, jsonError, requireSession } from "@/server/session";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const claimedTenantId =
      new URL(request.url).searchParams.get("tenantId") ?? undefined;
    const insight = await createInsightsService(getStore()).getForUser({
      userId: session.userId,
      insightId: id,
      claimedTenantId,
    });
    return Response.json({ insight });
  } catch (error) {
    return jsonError(error);
  }
}

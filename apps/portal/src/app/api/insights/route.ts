import { createInsightsService } from "@/server/insights";
import { getStore, jsonError, requireSession } from "@/server/session";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const claimedTenantId =
      new URL(request.url).searchParams.get("tenantId") ?? undefined;
    const insights = await createInsightsService(getStore()).listForUser({
      userId: session.userId,
      claimedTenantId,
    });
    return Response.json({ insights });
  } catch (error) {
    return jsonError(error);
  }
}

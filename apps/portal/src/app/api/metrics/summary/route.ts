import { tenantIdsForMemberships } from "@halcyon/core";
import { getStore, jsonError, requireSession } from "@/server/session";

export async function GET() {
  try {
    const session = await requireSession();
    const store = getStore();
    const memberships = (await store.listMembersByUser(session.userId)).map(
      (row) => ({ userId: row.userId, sandboxId: row.sandboxId }),
    );
    const tenantIds = tenantIdsForMemberships({
      userId: session.userId,
      memberships,
    });
    const today = new Date().toISOString().slice(0, 10);
    const metrics = (
      await Promise.all(
        tenantIds.map((tenantId) => store.getTenantMetric(tenantId, today)),
      )
    ).filter((row) => row !== null);
    return Response.json({ metrics });
  } catch (error) {
    return jsonError(error);
  }
}

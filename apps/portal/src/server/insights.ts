import {
  AccessDeniedError,
  authorizeInsightRead,
  authorizeInsightStatusChange,
  tenantIdsForMemberships,
  type InsightStatus,
} from "@halcyon/core";
import type { InsightRow, PortalStore } from "../db/types";

export function createInsightsService(store: PortalStore) {
  async function allowedTenants(userId: string) {
    const memberships = (await store.listMembersByUser(userId)).map((row) => ({
      userId: row.userId,
      sandboxId: row.sandboxId,
    }));
    return {
      memberships,
      tenantIds: tenantIdsForMemberships({ userId, memberships }),
    };
  }

  return {
    async listForUser(args: { userId: string; claimedTenantId?: string }) {
      const { tenantIds } = await allowedTenants(args.userId);
      if (args.claimedTenantId && !tenantIds.includes(args.claimedTenantId)) {
        return [];
      }
      const tenants = args.claimedTenantId ? [args.claimedTenantId] : tenantIds;
      const rows = await Promise.all(
        tenants.map((tenantId) => store.listInsightsByTenant(tenantId)),
      );
      return rows.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async getForUser(args: {
      userId: string;
      insightId: string;
      claimedTenantId?: string;
    }) {
      const { memberships, tenantIds } = await allowedTenants(args.userId);
      if (args.claimedTenantId && !tenantIds.includes(args.claimedTenantId)) {
        throw new AccessDeniedError("insight is not in your tenant");
      }
      const search = args.claimedTenantId ? [args.claimedTenantId] : tenantIds;
      for (const tenantId of search) {
        const insight = await store.getInsight(tenantId, args.insightId);
        if (insight) {
          return authorizeInsightRead({
            userId: args.userId,
            insight,
            memberships,
          });
        }
      }
      throw new AccessDeniedError("insight is not in your tenant");
    },

    async updateStatus(args: {
      userId: string;
      insightId: string;
      status: InsightStatus;
      claimedTenantId?: string;
    }) {
      const current = await this.getForUser(args);
      const status = authorizeInsightStatusChange({
        from: current.status,
        to: args.status,
      });
      const next: InsightRow = { ...current, status };
      await store.putInsight(next);
      return next;
    },
  };
}

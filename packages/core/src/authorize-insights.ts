import { AccessDeniedError, type SandboxMembership } from "./acl";

export type InsightStatus =
  | "new"
  | "acknowledged"
  | "approved"
  | "dismissed"
  | "actioned"
  | "measured";

export type InsightRecord = {
  tenantId: string;
  insightId: string;
  status: InsightStatus;
};

export type SandboxTenantRow = {
  sandboxId: string;
  tenantId?: string;
};

const ALLOWED_TRANSITIONS: Record<InsightStatus, InsightStatus[]> = {
  new: ["acknowledged", "dismissed", "approved"],
  acknowledged: ["approved", "dismissed"],
  approved: ["actioned", "dismissed"],
  dismissed: [],
  actioned: ["measured"],
  measured: [],
};

export function resolveTenantId(args: {
  sandbox: SandboxTenantRow | null;
  claimedTenantId?: string;
}): string {
  if (!args.sandbox) {
    throw new AccessDeniedError("sandbox not found");
  }
  return args.sandbox.tenantId || args.sandbox.sandboxId;
}

export function tenantIdsForMemberships(args: {
  userId: string;
  memberships: SandboxMembership[];
}): string[] {
  return args.memberships
    .filter((membership) => membership.userId === args.userId)
    .map((membership) => membership.sandboxId);
}

export function authorizeInsightRead<T extends InsightRecord>(args: {
  userId: string;
  insight: T;
  memberships: SandboxMembership[];
}): T {
  const allowed = new Set(tenantIdsForMemberships(args));
  if (!allowed.has(args.insight.tenantId)) {
    throw new AccessDeniedError("insight is not in your tenant");
  }
  return args.insight;
}

export function authorizeInsightStatusChange(args: {
  from: InsightStatus;
  to: InsightStatus;
}): InsightStatus {
  if (!ALLOWED_TRANSITIONS[args.from].includes(args.to)) {
    throw new AccessDeniedError("illegal insight status transition");
  }
  return args.to;
}

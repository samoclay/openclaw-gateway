import type { InsightStatus, Role } from "@halcyon/core";

export type UserRecord = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
};

export type SandboxRow = {
  sandboxId: string;
  tenantId: string;
  name: string;
  openclawAgentId: string;
  modelRef: string;
  createdByAdminId: string;
};

export type InsightRow = {
  tenantId: string;
  insightId: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  category: string;
  title: string;
  summary: string;
  evidence: string[];
  metrics: Record<string, number>;
  confidence: "low" | "medium" | "high";
  severity: "low" | "medium" | "high";
  recommendedAction: string;
  status: InsightStatus;
};

export type TenantMetricRow = {
  tenantId: string;
  metricDate: string;
  chats: number;
  inferenceFailures: number;
  toolCalls: number;
};

export type IngestWatermarkRow = {
  tenantId: string;
  lastEventAt: string;
  lastTransformAt?: string;
  lastInsightAt?: string;
};

export type MemberRow = {
  sandboxId: string;
  userId: string;
  grantedByAdminId: string;
};

export type ThreadRow = {
  threadId: string;
  sandboxId: string;
  userId: string;
  sessionKey: string;
};

export type SessionRow = {
  tokenHash: string;
  userId: string;
  expiresAt: number;
};

export type PortalStore = {
  getUser(userId: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  putUser(user: UserRecord): Promise<void>;
  listUsers(): Promise<UserRecord[]>;
  putSession(session: SessionRow): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRow | null>;
  deleteSession(tokenHash: string): Promise<void>;
  getSandbox(sandboxId: string): Promise<SandboxRow | null>;
  putSandbox(sandbox: SandboxRow): Promise<void>;
  listSandboxes(): Promise<SandboxRow[]>;
  getMember(sandboxId: string, userId: string): Promise<MemberRow | null>;
  putMember(member: MemberRow): Promise<void>;
  deleteMember(sandboxId: string, userId: string): Promise<void>;
  listMembersByUser(userId: string): Promise<MemberRow[]>;
  listMembersBySandbox(sandboxId: string): Promise<MemberRow[]>;
  getThread(threadId: string): Promise<ThreadRow | null>;
  putThread(thread: ThreadRow): Promise<void>;
  getInsight(tenantId: string, insightId: string): Promise<InsightRow | null>;
  putInsight(insight: InsightRow): Promise<void>;
  listInsightsByTenant(tenantId: string): Promise<InsightRow[]>;
  getWatermark(tenantId: string): Promise<IngestWatermarkRow | null>;
  putWatermark(row: IngestWatermarkRow): Promise<void>;
  getTenantMetric(tenantId: string, metricDate: string): Promise<TenantMetricRow | null>;
  putTenantMetric(row: TenantMetricRow): Promise<void>;
};

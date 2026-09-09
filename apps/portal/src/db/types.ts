import type { Role } from "@halcyon/core";

export type UserRecord = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
};

export type SandboxRow = {
  sandboxId: string;
  name: string;
  openclawAgentId: string;
  modelRef: string;
  createdByAdminId: string;
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
};

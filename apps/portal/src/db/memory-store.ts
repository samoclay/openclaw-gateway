import type {
  MemberRow,
  PortalStore,
  SandboxRow,
  SessionRow,
  ThreadRow,
  UserRecord,
} from "./types";

export class MemoryStore implements PortalStore {
  users = new Map<string, UserRecord>();
  usersByEmail = new Map<string, string>();
  sessions = new Map<string, SessionRow>();
  sandboxes = new Map<string, SandboxRow>();
  members = new Map<string, MemberRow>();
  threads = new Map<string, ThreadRow>();

  private memberKey(sandboxId: string, userId: string) {
    return `${sandboxId}#${userId}`;
  }

  async getUser(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async getUserByEmail(email: string) {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? (this.users.get(id) ?? null) : null;
  }

  async putUser(user: UserRecord) {
    this.users.set(user.userId, user);
    this.usersByEmail.set(user.email.toLowerCase(), user.userId);
  }

  async listUsers() {
    return [...this.users.values()];
  }

  async putSession(session: SessionRow) {
    this.sessions.set(session.tokenHash, session);
  }

  async getSession(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async getSandbox(sandboxId: string) {
    return this.sandboxes.get(sandboxId) ?? null;
  }

  async putSandbox(sandbox: SandboxRow) {
    this.sandboxes.set(sandbox.sandboxId, sandbox);
  }

  async listSandboxes() {
    return [...this.sandboxes.values()];
  }

  async getMember(sandboxId: string, userId: string) {
    return this.members.get(this.memberKey(sandboxId, userId)) ?? null;
  }

  async putMember(member: MemberRow) {
    this.members.set(this.memberKey(member.sandboxId, member.userId), member);
  }

  async deleteMember(sandboxId: string, userId: string) {
    this.members.delete(this.memberKey(sandboxId, userId));
  }

  async listMembersByUser(userId: string) {
    return [...this.members.values()].filter((row) => row.userId === userId);
  }

  async listMembersBySandbox(sandboxId: string) {
    return [...this.members.values()].filter((row) => row.sandboxId === sandboxId);
  }

  async getThread(threadId: string) {
    return this.threads.get(threadId) ?? null;
  }

  async putThread(thread: ThreadRow) {
    this.threads.set(thread.threadId, thread);
  }
}

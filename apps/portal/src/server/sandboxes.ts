import {
  authorizeAdmin,
  authorizeChatTurn,
  mintSessionKey,
  slugAgentId,
  type ClientChatInput,
  type Role,
} from "@halcyon/core";
import type { PortalStore } from "../db/types";
import { provisionSandbox, type ProvisionResult } from "./provision";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function id(): string {
  return crypto.randomUUID();
}

export function createPortalService(
  store: PortalStore,
  provision: typeof provisionSandbox = provisionSandbox,
) {
  async function createSandbox(args: {
    role: Role;
    adminId: string;
    name: string;
    modelRef: string;
    memberUserId?: string;
  }): Promise<{
    sandboxId: string;
    agentId: string;
    provision: ProvisionResult;
  }> {
    authorizeAdmin(args.role);
    const sandboxId = id();
    const agentId = slugAgentId(sandboxId);
    await store.putSandbox({
      sandboxId,
      name: args.name,
      openclawAgentId: agentId,
      modelRef: args.modelRef,
      createdByAdminId: args.adminId,
    });
    if (args.memberUserId) {
      await store.putMember({
        sandboxId,
        userId: args.memberUserId,
        grantedByAdminId: args.adminId,
      });
    }
    const provisionResult = await provision({
      agentId,
      modelRef: args.modelRef,
    });
    return { sandboxId, agentId, provision: provisionResult };
  }

  return {
    createSandbox,
    async listSandboxesForUser(userId: string) {
      const memberships = await store.listMembersByUser(userId);
      const sandboxes = await Promise.all(
        memberships.map((membership) => store.getSandbox(membership.sandboxId)),
      );
      return sandboxes.flatMap((row) =>
        row
          ? [
              {
                id: row.sandboxId,
                name: row.name,
                modelRef: row.modelRef,
                openclawAgentId: row.openclawAgentId,
              },
            ]
          : [],
      );
    },

    async listAllSandboxes(role: Role) {
      authorizeAdmin(role);
      return store.listSandboxes();
    },

    async listClients(role: Role) {
      authorizeAdmin(role);
      const users = await store.listUsers();
      return users.map(({ passwordHash: _passwordHash, ...rest }) => rest);
    },

    async listMembers(role: Role, sandboxId: string) {
      authorizeAdmin(role);
      const members = await store.listMembersBySandbox(sandboxId);
      return Promise.all(
        members.map(async (member) => {
          const user = await store.getUser(member.userId);
          return {
            userId: member.userId,
            email: user?.email ?? "",
            name: user?.name ?? "",
          };
        }),
      );
    },

    async grantMembership(args: {
      role: Role;
      adminId: string;
      sandboxId: string;
      userId: string;
    }) {
      authorizeAdmin(args.role);
      await store.putMember({
        sandboxId: args.sandboxId,
        userId: args.userId,
        grantedByAdminId: args.adminId,
      });
    },

    async revokeMembership(args: {
      role: Role;
      sandboxId: string;
      userId: string;
    }) {
      authorizeAdmin(args.role);
      await store.deleteMember(args.sandboxId, args.userId);
    },

    async createClient(args: {
      role: Role;
      adminId: string;
      email: string;
      name: string;
      passwordHash: string;
      modelRef: string;
    }) {
      authorizeAdmin(args.role);
      const userId = id();
      await store.putUser({
        userId,
        email: args.email.toLowerCase(),
        name: args.name,
        role: "client",
        passwordHash: args.passwordHash,
      });
      const sandbox = await createSandbox({
        role: args.role,
        adminId: args.adminId,
        name: `${args.name}'s sandbox`,
        modelRef: args.modelRef,
        memberUserId: userId,
      });
      return { userId, sandbox };
    },

    async prepareChat(args: {
      userId: string;
      sandboxId: string;
      threadId?: string;
      client: ClientChatInput;
    }) {
      const sandbox = await store.getSandbox(args.sandboxId);
      const memberships = (await store.listMembersByUser(args.userId)).map(
        (row) => ({ userId: row.userId, sandboxId: row.sandboxId }),
      );

      let threadId = args.threadId;
      if (threadId) {
        const thread = await store.getThread(threadId);
        if (
          !thread ||
          thread.sandboxId !== args.sandboxId ||
          thread.userId !== args.userId
        ) {
          throw new HttpError(403, "thread does not belong to this sandbox");
        }
      } else {
        threadId = id();
        await store.putThread({
          threadId,
          sandboxId: args.sandboxId,
          userId: args.userId,
          sessionKey: mintSessionKey({
            sandboxId: args.sandboxId,
            threadId,
          }),
        });
      }

      const turn = authorizeChatTurn({
        userId: args.userId,
        sandbox: sandbox
          ? {
              id: sandbox.sandboxId,
              openclawAgentId: sandbox.openclawAgentId,
              modelRef: sandbox.modelRef,
            }
          : null,
        memberships,
        threadId,
        client: args.client,
      });

      return { threadId, turn };
    },
  };
}

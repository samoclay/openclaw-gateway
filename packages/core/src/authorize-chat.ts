import {
  AccessDeniedError,
  requireSandboxAccess,
  type SandboxMembership,
} from "./acl";
import {
  buildGatewayChatRequest,
  type ClientChatInput,
  type GatewayChatRequest,
} from "./chat-request";
import { mintSessionKey } from "./session-key";

export type SandboxRecord = {
  id: string;
  openclawAgentId: string;
  modelRef: string;
};

export type AuthorizedChatTurn = {
  agentId: string;
  sessionKey: string;
  request: GatewayChatRequest;
};

export function authorizeChatTurn(args: {
  userId: string;
  sandbox: SandboxRecord | null;
  memberships: SandboxMembership[];
  threadId: string;
  client: ClientChatInput;
}): AuthorizedChatTurn {
  if (!args.sandbox) {
    throw new AccessDeniedError("sandbox not found");
  }

  requireSandboxAccess({
    userId: args.userId,
    sandboxId: args.sandbox.id,
    memberships: args.memberships,
  });

  const sessionKey = mintSessionKey({
    sandboxId: args.sandbox.id,
    threadId: args.threadId,
  });

  const request = buildGatewayChatRequest({
    agentId: args.sandbox.openclawAgentId,
    sessionKey,
    modelRef: args.sandbox.modelRef,
    client: args.client,
  });

  return {
    agentId: args.sandbox.openclawAgentId,
    sessionKey,
    request,
  };
}

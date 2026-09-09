export type ClientChatInput = {
  message: string;
  threadId?: string;
  agentId?: string;
  sessionKey?: string;
  model?: string;
};

export type GatewayChatRequest = {
  agentId: string;
  model: string;
  sessionKey: string;
  message: string;
};

export function buildGatewayChatRequest(args: {
  agentId: string;
  sessionKey: string;
  modelRef: string;
  client: ClientChatInput;
}): GatewayChatRequest {
  const message = args.client.message.trim();
  if (!message) {
    throw new Error("message is required");
  }

  return {
    agentId: args.agentId,
    model: `openclaw/${args.agentId}`,
    sessionKey: args.sessionKey,
    message,
  };
}

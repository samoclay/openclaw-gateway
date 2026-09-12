export type PostChatCompletionArgs = {
  baseUrl: string;
  token: string;
  agentId: string;
  sessionKey: string;
  message: string;
  model?: string;
  maxTokens?: number;
  stream?: boolean;
  fetchImpl?: typeof fetch;
};

function normalizeModelRef(model: string): string {
  const raw = model.trim();
  if (!raw) return "";
  return raw.startsWith("ollama/") || raw.startsWith("openclaw/")
    ? raw
    : `ollama/${raw}`;
}

export function postChatCompletion(
  args: PostChatCompletionArgs,
): Promise<Response> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const baseUrl = args.baseUrl.replace(/\/$/, "");
  const stream = args.stream ?? true;
  const modelRef = normalizeModelRef(args.model || "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.token}`,
    "Content-Type": "application/json",
    "x-openclaw-session-key": args.sessionKey,
  };
  if (modelRef) headers["x-openclaw-model"] = modelRef;

  return fetchImpl(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: `openclaw/${args.agentId}`,
      stream,
      ...(args.maxTokens ? { max_tokens: args.maxTokens } : {}),
      messages: [{ role: "user", content: args.message }],
    }),
  });
}

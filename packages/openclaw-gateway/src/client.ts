export type PostChatCompletionArgs = {
  baseUrl: string;
  token: string;
  agentId: string;
  sessionKey: string;
  message: string;
  stream?: boolean;
  fetchImpl?: typeof fetch;
};

export function postChatCompletion(
  args: PostChatCompletionArgs,
): Promise<Response> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const baseUrl = args.baseUrl.replace(/\/$/, "");
  const stream = args.stream ?? true;

  return fetchImpl(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
      "x-openclaw-session-key": args.sessionKey,
    },
    body: JSON.stringify({
      model: `openclaw/${args.agentId}`,
      stream,
      messages: [{ role: "user", content: args.message }],
    }),
  });
}

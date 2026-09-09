const PORTAL_PREFIX = "portal-";

export function mintSessionKey(args: {
  sandboxId: string;
  threadId: string;
}): string {
  return `${PORTAL_PREFIX}${args.sandboxId}-${args.threadId}`;
}

export function assertSessionKeyForSandbox(
  sessionKey: string,
  sandboxId: string,
): void {
  const expectedPrefix = `${PORTAL_PREFIX}${sandboxId}-`;
  if (!sessionKey.startsWith(expectedPrefix)) {
    throw new Error("session key does not belong to sandbox");
  }
}

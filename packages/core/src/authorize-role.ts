import { AccessDeniedError } from "./acl";

export const DEFAULT_ROLE_ID = "default";

export type CrewRole = {
  roleId: string;
  displayName: string;
  agentId: string;
  modelRef: string;
};

export type CrewSandbox = {
  sandboxId: string;
  openclawAgentId: string;
  modelRef: string;
  name?: string;
  roles?: CrewRole[];
};

export function slugRoleAgentId(sandboxId: string, roleId: string): string {
  const compact = `${sandboxId}${roleId}`.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const body = (compact.slice(-16) || "agent");
  return `sbx${body}`;
}

export function allowlistedAgentIds(sandbox: CrewSandbox): string[] {
  const ids = new Set<string>([sandbox.openclawAgentId]);
  for (const role of sandbox.roles || []) {
    if (role.agentId) {
      ids.add(role.agentId);
    }
  }
  return [...ids];
}

export function resolveMentionAgent(args: {
  sandbox: CrewSandbox;
  mentionRoleId?: string | null;
}): { agentId: string; fromRoleId: string; mentionAgentId?: string } {
  const defaultHit = {
    agentId: args.sandbox.openclawAgentId,
    fromRoleId: DEFAULT_ROLE_ID,
  };
  const mention = (args.mentionRoleId || "").trim();
  if (!mention || mention === DEFAULT_ROLE_ID) {
    return defaultHit;
  }
  const role = (args.sandbox.roles || []).find((row) => row.roleId === mention);
  if (!role) {
    throw new AccessDeniedError("That agent is not in this environment");
  }
  return {
    ...defaultHit,
    mentionAgentId: role.agentId,
    fromRoleId: DEFAULT_ROLE_ID,
  };
}

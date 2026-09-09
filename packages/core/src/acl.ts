export type Role = "admin" | "client";

export type SandboxMembership = {
  userId: string;
  sandboxId: string;
};

export function canManageSandboxes(role: Role): boolean {
  return role === "admin";
}

export function canAccessSandbox(args: {
  userId: string;
  sandboxId: string;
  memberships: SandboxMembership[];
}): boolean {
  return args.memberships.some(
    (membership) =>
      membership.userId === args.userId &&
      membership.sandboxId === args.sandboxId,
  );
}

export function requireSandboxAccess(args: {
  userId: string;
  sandboxId: string;
  memberships: SandboxMembership[];
}): void {
  if (!canAccessSandbox(args)) {
    throw new AccessDeniedError("not a member of this sandbox");
  }
}

export function requireAdmin(role: Role): void {
  if (!canManageSandboxes(role)) {
    throw new AccessDeniedError("admin only");
  }
}

export class AccessDeniedError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

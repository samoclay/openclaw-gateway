import { requireAdmin, type Role } from "./acl";

export function authorizeAdmin(role: Role): void {
  requireAdmin(role);
}

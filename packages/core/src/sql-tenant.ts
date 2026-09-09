import { AccessDeniedError } from "./acl";

const SAFE_TENANT_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function assertSafeTenantId(tenantId: string): string {
  if (!SAFE_TENANT_ID.test(tenantId)) {
    throw new AccessDeniedError("invalid tenant id");
  }
  return tenantId;
}

export function bindTenantPredicate(args: {
  sql: string;
  tenantId: string;
}): string {
  const tenantId = assertSafeTenantId(args.tenantId);
  if (!args.sql.includes(":tenant_id")) {
    throw new AccessDeniedError("analytics SQL must bind :tenant_id");
  }
  return args.sql.replaceAll(":tenant_id", `'${tenantId}'`);
}

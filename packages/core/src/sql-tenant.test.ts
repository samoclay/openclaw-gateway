import { describe, expect, it } from "vitest";
import { AccessDeniedError } from "./acl";
import { assertSafeTenantId, bindTenantPredicate } from "./sql-tenant";

describe("assertSafeTenantId", () => {
  it("rejects SQL injection payloads", () => {
    expect(() => assertSafeTenantId("a' OR 1=1 --")).toThrow(AccessDeniedError);
    expect(() => assertSafeTenantId("sandbox-b; DROP TABLE")).toThrow(
      AccessDeniedError,
    );
    expect(() => assertSafeTenantId("")).toThrow(AccessDeniedError);
  });

  it("accepts sandbox-style ids", () => {
    expect(assertSafeTenantId("11111111-2222-4333-8444-555555555555")).toBe(
      "11111111-2222-4333-8444-555555555555",
    );
  });
});

describe("bindTenantPredicate", () => {
  it("injects only the validated tenant and refuses raw concatenation of caller SQL without placeholder", () => {
    const sql = bindTenantPredicate({
      sql: "SELECT * FROM analytics.usage_daily WHERE tenant_id = :tenant_id AND dt >= :start",
      tenantId: "sandbox-a",
    });
    expect(sql).toContain("'sandbox-a'");
    expect(sql).not.toContain(":tenant_id");
  });

  it("refuses SQL that does not bind tenant_id", () => {
    expect(() =>
      bindTenantPredicate({
        sql: "SELECT * FROM analytics.usage_daily",
        tenantId: "sandbox-a",
      }),
    ).toThrow(AccessDeniedError);
  });
});

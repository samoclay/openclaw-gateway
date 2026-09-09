import { describe, expect, it } from "vitest";
import { AccessDeniedError } from "./acl";
import {
  authorizeInsightRead,
  authorizeInsightStatusChange,
  resolveTenantId,
  tenantIdsForMemberships,
} from "./authorize-insights";

const insightA = {
  tenantId: "sandbox-a",
  insightId: "ins-a",
  status: "new" as const,
};

describe("resolveTenantId", () => {
  it("uses sandbox tenantId and never a client-supplied value", () => {
    expect(
      resolveTenantId({
        sandbox: { sandboxId: "sandbox-a", tenantId: "sandbox-a" },
        claimedTenantId: "sandbox-b",
      }),
    ).toBe("sandbox-a");
  });

  it("defaults tenantId to sandboxId when the row predates the field", () => {
    expect(
      resolveTenantId({
        sandbox: { sandboxId: "sandbox-legacy" },
      }),
    ).toBe("sandbox-legacy");
  });
});

describe("authorizeInsightRead", () => {
  it("denies client A reading client B insights even with a spoofed tenant query", () => {
    expect(() =>
      authorizeInsightRead({
        userId: "client-a",
        insight: { ...insightA, tenantId: "sandbox-b" },
        memberships: [{ userId: "client-a", sandboxId: "sandbox-a" }],
      }),
    ).toThrow(AccessDeniedError);
  });

  it("allows a member of the insight tenant", () => {
    expect(
      authorizeInsightRead({
        userId: "client-a",
        insight: insightA,
        memberships: [{ userId: "client-a", sandboxId: "sandbox-a" }],
      }),
    ).toEqual(insightA);
  });
});

describe("tenantIdsForMemberships", () => {
  it("only returns tenants the user belongs to", () => {
    expect(
      tenantIdsForMemberships({
        userId: "client-a",
        memberships: [
          { userId: "client-a", sandboxId: "sandbox-a" },
          { userId: "client-b", sandboxId: "sandbox-b" },
        ],
      }),
    ).toEqual(["sandbox-a"]);
  });
});

describe("authorizeInsightStatusChange", () => {
  it("rejects illegal transitions", () => {
    expect(() =>
      authorizeInsightStatusChange({
        from: "dismissed",
        to: "approved",
      }),
    ).toThrow(AccessDeniedError);
  });

  it("allows new to approved", () => {
    expect(authorizeInsightStatusChange({ from: "new", to: "approved" })).toBe(
      "approved",
    );
  });
});

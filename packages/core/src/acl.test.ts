import { describe, expect, it } from "vitest";
import { canAccessSandbox, canManageSandboxes } from "./acl";

describe("canManageSandboxes", () => {
  it("allows admins only", () => {
    expect(canManageSandboxes("admin")).toBe(true);
    expect(canManageSandboxes("client")).toBe(false);
  });
});

describe("canAccessSandbox", () => {
  const sandboxA = "sandbox-a";
  const sandboxB = "sandbox-b";
  const clientA = "user-a";
  const clientB = "user-b";
  const memberships = [
    { userId: clientA, sandboxId: sandboxA },
    { userId: clientB, sandboxId: sandboxB },
  ];

  it("allows a client who is a member", () => {
    expect(
      canAccessSandbox({
        userId: clientA,
        sandboxId: sandboxA,
        memberships,
      }),
    ).toBe(true);
  });

  it("denies client A access to client B sandbox", () => {
    expect(
      canAccessSandbox({
        userId: clientA,
        sandboxId: sandboxB,
        memberships,
      }),
    ).toBe(false);
  });

  it("allows access after an admin grant", () => {
    expect(
      canAccessSandbox({
        userId: clientA,
        sandboxId: sandboxB,
        memberships: [
          ...memberships,
          { userId: clientA, sandboxId: sandboxB },
        ],
      }),
    ).toBe(true);
  });
});

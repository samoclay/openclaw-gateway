import { describe, expect, it } from "vitest";
import { AccessDeniedError } from "./acl";
import { authorizeAdmin } from "./authorize-admin";

describe("authorizeAdmin", () => {
  it("rejects clients changing memberships or model assignment", () => {
    expect(() => authorizeAdmin("client")).toThrow(AccessDeniedError);
    expect(() => authorizeAdmin("client")).toThrow(/admin only/i);
  });

  it("allows admins", () => {
    expect(() => authorizeAdmin("admin")).not.toThrow();
  });
});

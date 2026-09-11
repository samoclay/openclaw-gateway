import { describe, expect, it } from "vitest";
import { AccessDeniedError } from "./acl";
import { slugAgentId } from "./agent-id";
import {
  DEFAULT_ROLE_ID,
  allowlistedAgentIds,
  resolveMentionAgent,
  slugRoleAgentId,
} from "./authorize-role";
import { WORKSPACE_ERRORS } from "./workspace-errors";

const sandboxA = {
  sandboxId: "sandbox-a",
  openclawAgentId: "sbxa",
  modelRef: "ollama/qwen3.6:latest",
  name: "Alpha",
  roles: [
    {
      roleId: "role-writer",
      displayName: "Writer",
      agentId: "sbxwriter",
      modelRef: "ollama/qwen3.6:latest",
    },
  ],
};

const sandboxB = {
  sandboxId: "sandbox-b",
  openclawAgentId: "sbxb",
  modelRef: "ollama/qwen3:30b",
  roles: [
    {
      roleId: "role-spy",
      displayName: "Spy",
      agentId: "sbxspy",
      modelRef: "ollama/qwen3:30b",
    },
  ],
};

describe("workspace errors", () => {
  it("names stage, title, and detail for every catalog code", () => {
    expect(Object.keys(WORKSPACE_ERRORS).sort()).toEqual(
      [
        "crypto_setup_failed",
        "decrypt_failed",
        "gateway_unreachable",
        "model_error",
        "no_sandbox",
        "not_a_member",
        "not_signed_in",
        "passkey_cancelled",
        "passkey_unavailable",
        "role_create_failed",
        "role_unknown",
        "sealed_rejected",
        "sidecar_offline",
        "thread_denied",
      ].sort(),
    );
    for (const row of Object.values(WORKSPACE_ERRORS)) {
      expect(row.title.length).toBeGreaterThan(3);
      expect(row.detail.length).toBeGreaterThan(10);
      expect(row.stage).toMatch(/^(browser|portal|sidecar|gateway|model)$/);
    }
  });
});

describe("resolveMentionAgent", () => {
  it("uses the sandbox default agent when mention is omitted", () => {
    const hit = resolveMentionAgent({ sandbox: sandboxA });
    expect(hit.agentId).toBe("sbxa");
    expect(hit.fromRoleId).toBe(DEFAULT_ROLE_ID);
    expect(hit.mentionAgentId).toBeUndefined();
  });

  it("allowlists a sibling role as mentionAgentId without trusting a spoofed agentId", () => {
    const hit = resolveMentionAgent({
      sandbox: sandboxA,
      mentionRoleId: "role-writer",
    });
    expect(hit.agentId).toBe("sbxa");
    expect(hit.mentionAgentId).toBe("sbxwriter");
    expect(allowlistedAgentIds(sandboxA)).toEqual(["sbxa", "sbxwriter"]);
  });

  it("rejects a role id that belongs to another sandbox", () => {
    expect(() =>
      resolveMentionAgent({
        sandbox: sandboxA,
        mentionRoleId: "role-spy",
      }),
    ).toThrow(AccessDeniedError);
  });
});

describe("slugRoleAgentId", () => {
  it("stays on the sbx + 16 alphanumeric contract", () => {
    const sandboxId = "11111111-2222-4333-8444-555555555555";
    const roleId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(slugRoleAgentId(sandboxId, roleId)).toMatch(/^sbx[a-z0-9]{1,16}$/);
    expect(slugRoleAgentId(sandboxId, roleId)).toBe(
      slugRoleAgentId(sandboxId, roleId),
    );
    expect(slugRoleAgentId(sandboxId, roleId)).not.toBe(slugAgentId(sandboxId));
  });
});

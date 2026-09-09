import { AccessDeniedError } from "@halcyon/core";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../db/memory-store";
import { createPortalService } from "./sandboxes";

const skipProvision = async () => ({ ok: true, message: "skip" });

describe("createPortalService isolation", () => {
  it("denies client A chatting in client B sandbox", async () => {
    const store = new MemoryStore();
    const portal = createPortalService(store, skipProvision);
    await store.putUser({
      userId: "admin",
      email: "admin@localhost",
      name: "Admin",
      role: "admin",
      passwordHash: "x",
    });
    const clientA = await portal.createClient({
      role: "admin",
      adminId: "admin",
      email: "a@x.com",
      name: "A",
      passwordHash: "h",
      modelRef: "ollama/qwen3.6:latest",
    });
    const clientB = await portal.createClient({
      role: "admin",
      adminId: "admin",
      email: "b@x.com",
      name: "B",
      passwordHash: "h",
      modelRef: "ollama/qwen3:30b",
    });

    await expect(
      portal.prepareChat({
        userId: clientA.userId,
        sandboxId: clientB.sandbox.sandboxId,
        client: { message: "leak", agentId: "spoof" },
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("rejects a client granting memberships", async () => {
    const store = new MemoryStore();
    const portal = createPortalService(store, skipProvision);
    await expect(
      portal.grantMembership({
        role: "client",
        adminId: "client-a",
        sandboxId: "sandbox-b",
        userId: "client-a",
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("after admin grant, client A is routed only to sandbox B's agent", async () => {
    const store = new MemoryStore();
    const portal = createPortalService(store, skipProvision);
    await store.putUser({
      userId: "admin",
      email: "admin@localhost",
      name: "Admin",
      role: "admin",
      passwordHash: "x",
    });
    const clientA = await portal.createClient({
      role: "admin",
      adminId: "admin",
      email: "a@x.com",
      name: "A",
      passwordHash: "h",
      modelRef: "ollama/tiny",
    });
    const extra = await portal.createSandbox({
      role: "admin",
      adminId: "admin",
      name: "shared-powerful",
      modelRef: "ollama/qwen3:30b",
    });
    await portal.grantMembership({
      role: "admin",
      adminId: "admin",
      sandboxId: extra.sandboxId,
      userId: clientA.userId,
    });
    const turn = await portal.prepareChat({
      userId: clientA.userId,
      sandboxId: extra.sandboxId,
      client: {
        message: "hi",
        agentId: clientA.sandbox.agentId,
        model: "ollama/tiny",
      },
    });
    expect(turn.turn.agentId).toBe(extra.agentId);
    expect(turn.turn.request.model).toBe(`openclaw/${extra.agentId}`);
  });
});

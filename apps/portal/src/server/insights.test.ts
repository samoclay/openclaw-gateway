import { AccessDeniedError } from "@halcyon/core";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../db/memory-store";
import { createInsightsService } from "./insights";
import { createPortalService } from "./sandboxes";

const skipProvision = async () => ({ ok: true, message: "skip" });

async function twoClients() {
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
  const clientB = await portal.createClient({
    role: "admin",
    adminId: "admin",
    email: "b@x.com",
    name: "B",
    passwordHash: "h",
    modelRef: "ollama/tiny",
  });
  const insights = createInsightsService(store);
  return { store, insights, clientA, clientB };
}

describe("createInsightsService isolation", () => {
  it("never lists or returns another tenant's insights", async () => {
    const { insights, clientA, clientB, store } = await twoClients();
    const tenantB = clientB.sandbox.sandboxId;
    await store.putInsight({
      tenantId: tenantB,
      insightId: "ins-b",
      createdAt: "2026-09-01T00:00:00.000Z",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      category: "Customer Support",
      title: "Secret to B",
      summary: "B only",
      evidence: ["internal"],
      metrics: { count: 1 },
      confidence: "high",
      severity: "medium",
      recommendedAction: "Do not show A",
      status: "new",
    });

    const listed = await insights.listForUser({
      userId: clientA.userId,
      claimedTenantId: tenantB,
    });
    expect(listed).toEqual([]);

    await expect(
      insights.getForUser({
        userId: clientA.userId,
        insightId: "ins-b",
        claimedTenantId: tenantB,
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("lets a member read and approve only their insight", async () => {
    const { insights, clientA, store } = await twoClients();
    const tenantA = clientA.sandbox.sandboxId;
    await store.putInsight({
      tenantId: tenantA,
      insightId: "ins-a",
      createdAt: "2026-09-01T00:00:00.000Z",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      category: "AI usage",
      title: "Usage up",
      summary: "Chats increased",
      evidence: ["12 tasks"],
      metrics: { chats: 12 },
      confidence: "medium",
      severity: "low",
      recommendedAction: "Review automations",
      status: "new",
    });

    const row = await insights.getForUser({
      userId: clientA.userId,
      insightId: "ins-a",
    });
    expect(row.title).toBe("Usage up");

    const updated = await insights.updateStatus({
      userId: clientA.userId,
      insightId: "ins-a",
      status: "approved",
    });
    expect(updated.status).toBe("approved");
  });
});

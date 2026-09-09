import { getDynamoStore } from "../db/dynamo";
import { env } from "./env";
import { hashPassword } from "./passwords";

export async function bootstrapAdmin(): Promise<void> {
  const store = getDynamoStore();
  const existing = await store.getUserByEmail(env.ADMIN_EMAIL);
  if (existing) {
    return;
  }
  await store.putUser({
    userId: crypto.randomUUID(),
    email: env.ADMIN_EMAIL.toLowerCase(),
    name: "Admin",
    role: "admin",
    passwordHash: await hashPassword(env.ADMIN_PASSWORD),
  });
}

import { z } from "zod";
import { getStore } from "@/server/session";
import { jsonError } from "@/server/session";
import {
  persistSession,
  sessionCookie,
  signSession,
} from "@/server/auth";
import { verifyPassword } from "@/server/passwords";
import { assertLoginRateLimit, clientIp } from "@/server/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    assertLoginRateLimit(clientIp(request));
    const body = loginSchema.parse(await request.json());
    const store = getStore();
    const user = await store.getUserByEmail(body.email);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return Response.json({ error: "invalid credentials" }, { status: 401 });
    }
    const token = await signSession({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await persistSession(store, token, user.userId);
    return new Response(JSON.stringify({ ok: true, role: user.role }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": sessionCookie(token),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

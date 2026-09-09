import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  dropSession,
} from "@/server/auth";
import { getStore } from "@/server/session";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await dropSession(getStore(), token);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": clearSessionCookie(),
    },
  });
}

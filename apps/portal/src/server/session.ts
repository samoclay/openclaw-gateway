import { cookies } from "next/headers";
import { getDynamoStore } from "../db/dynamo";
import { createPortalService, HttpError } from "./sandboxes";
import { SESSION_COOKIE, verifySession } from "./auth";

export { HttpError };

export function getStore() {
  return getDynamoStore();
}

export function getPortal() {
  return createPortalService(getStore());
}

export async function requireSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    throw new HttpError(401, "sign in required");
  }
  try {
    return await verifySession(token);
  } catch {
    throw new HttpError(401, "sign in required");
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error && typeof error === "object" && "issues" in error) {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;
    const message = error instanceof Error ? error.message : "request failed";
    return Response.json({ error: message }, { status });
  }
  const message = "unexpected error";
  return Response.json({ error: message }, { status: 500 });
}

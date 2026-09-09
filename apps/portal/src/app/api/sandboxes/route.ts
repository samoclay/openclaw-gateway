import { jsonError, requireSession, getPortal } from "@/server/session";

export async function GET() {
  try {
    const session = await requireSession();
    const sandboxes = await getPortal().listSandboxesForUser(session.userId);
    return Response.json({ sandboxes, me: session });
  } catch (error) {
    return jsonError(error);
  }
}

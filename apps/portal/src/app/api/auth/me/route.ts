import { jsonError, requireSession } from "@/server/session";

export async function GET() {
  try {
    const me = await requireSession();
    return Response.json({ me });
  } catch (error) {
    return jsonError(error);
  }
}

import { z } from "zod";
import { getPortal, jsonError, requireSession } from "@/server/session";

const createSchema = z.object({
  name: z.string().min(1),
  modelRef: z.string().min(1),
});

export async function GET() {
  try {
    const session = await requireSession();
    const sandboxes = await getPortal().listAllSandboxes(session.role);
    return Response.json({ sandboxes });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = createSchema.parse(await request.json());
    const sandbox = await getPortal().createSandbox({
      role: session.role,
      adminId: session.userId,
      name: body.name,
      modelRef: body.modelRef,
    });
    return Response.json({ sandbox });
  } catch (error) {
    return jsonError(error);
  }
}

import { z } from "zod";
import { getPortal, jsonError, requireSession } from "@/server/session";

const grantSchema = z.object({
  userId: z.string().min(1),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const members = await getPortal().listMembers(session.role, id);
    return Response.json({ members });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = grantSchema.parse(await request.json());
    await getPortal().grantMembership({
      role: session.role,
      adminId: session.userId,
      sandboxId: id,
      userId: body.userId,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = grantSchema.parse(await request.json());
    await getPortal().revokeMembership({
      role: session.role,
      sandboxId: id,
      userId: body.userId,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

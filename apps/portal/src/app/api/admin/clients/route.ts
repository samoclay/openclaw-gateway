import { z } from "zod";
import { hashPassword } from "@/server/passwords";
import { getPortal, jsonError, requireSession } from "@/server/session";

const createClientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  modelRef: z.string().min(1).default("ollama/qwen3.6:latest"),
});

export async function GET() {
  try {
    const session = await requireSession();
    const clients = await getPortal().listClients(session.role);
    return Response.json({ clients });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = createClientSchema.parse(await request.json());
    const created = await getPortal().createClient({
      role: session.role,
      adminId: session.userId,
      email: body.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
      modelRef: body.modelRef,
    });
    return Response.json(created);
  } catch (error) {
    return jsonError(error);
  }
}

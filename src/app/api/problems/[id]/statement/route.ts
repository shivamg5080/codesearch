import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({ statement: z.string().min(1).max(50_000) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    await prisma.problem.update({
      where: { id },
      data: { statement: parsed.data.statement },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }
}

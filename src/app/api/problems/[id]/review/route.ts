import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { recordReview } from "@/lib/progress";

export const runtime = "nodejs";

const Body = z.object({ remembered: z.boolean() });

// Record a spaced-repetition review outcome and reschedule the next review.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  await recordReview(session.user.id, id, parsed.data.remembered);
  return Response.json({ ok: true });
}

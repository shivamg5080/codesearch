import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { recordAttempt, logUserMessage } from "@/lib/progress";

export const runtime = "nodejs";

const Body = z.object({ message: z.string().min(1).max(8000) });

// Called when the learner sends a tutor message: mark the problem Attempting
// and log the message. Best-effort — never blocks the chat.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  try {
    await recordAttempt(session.user.id, id);
    await logUserMessage(session.user.id, id, parsed.data.message);
  } catch {
    // ignore
  }
  return Response.json({ ok: true });
}

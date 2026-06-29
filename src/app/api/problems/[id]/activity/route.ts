import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { recordAttempt, logUserMessage, logAssistantMessage } from "@/lib/progress";

export const runtime = "nodejs";

const Body = z.object({
  message: z.string().min(1).max(8000),
  role: z.enum(["user", "assistant"]).default("user"),
  mode: z.enum(["UNDERSTAND", "HINT", "REVIEW", "TEACH", "QUIZ"]).optional(),
});

// Logs a tutor-chat message. For user messages it also marks the problem
// Attempting; assistant replies are just appended to the conversation. The chat
// history is rebuilt from these on reload. Best-effort — never blocks the chat.
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
    if (parsed.data.role === "assistant") {
      await logAssistantMessage(session.user.id, id, parsed.data.message, parsed.data.mode);
    } else {
      await recordAttempt(session.user.id, id);
      await logUserMessage(session.user.id, id, parsed.data.message);
    }
  } catch {
    // ignore
  }
  return Response.json({ ok: true });
}

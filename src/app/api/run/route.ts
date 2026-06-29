import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { runCpp } from "@/lib/judge0";

export const runtime = "nodejs";
// Compile + run can take a few seconds on the public Judge0 instance.
export const maxDuration = 30;

const Body = z.object({
  code: z.string().min(1).max(50000),
  stdin: z.string().max(20000).default(""),
});

// Run the learner's C++ code against the provided stdin (a sample input).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to run code." }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Provide some C++ code." }, { status: 400 });
  }

  try {
    const result = await runCpp(parsed.data.code, parsed.data.stdin);
    return Response.json(result);
  } catch (err) {
    console.error("run error:", err);
    return Response.json(
      { error: "Run service unavailable — try again in a moment." },
      { status: 502 },
    );
  }
}

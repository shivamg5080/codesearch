import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import OpenAI from "openai";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { recordMessageAndCheck } from "@/lib/usage";

export const runtime = "nodejs";
// Allow long streaming tutor replies (Vercel default is 10s).
export const maxDuration = 60;

// In-process tutor: CopilotKit runtime + OpenAI. Pedagogy comes from the
// chat `instructions`; problem context from CopilotKit readables on the client.
export async function POST(req: NextRequest) {
  // Auth-gate + rate-limit the expensive OpenAI call.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in to use the tutor." }, { status: 401 });
  }
  const usage = await recordMessageAndCheck(userId);
  if (!usage.allowed) {
    return Response.json(
      { error: `Daily limit reached (${usage.cap} messages). Try again tomorrow.` },
      { status: 429 },
    );
  }

  const serviceAdapter = new OpenAIAdapter({
    openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
  });
  const copilotRuntime = new CopilotRuntime();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
}

import {
  CopilotRuntime,
  OpenAIAdapter,
  type CopilotServiceAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import OpenAI from "openai";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { recordMessageAndCheck } from "@/lib/usage";

export const runtime = "nodejs";
// Sarvam's reasoning models can take ~10s; allow long streaming replies.
export const maxDuration = 60;

// Sarvam exposes an OpenAI-compatible /chat/completions endpoint but NOT the
// newer /responses API that @ai-sdk/openai (and thus CopilotKit's OpenAIAdapter)
// defaults to. Override getLanguageModel() to use the chat-completions model.
class ChatCompletionsAdapter extends OpenAIAdapter {
  getLanguageModel(): LanguageModel {
    const o = this.openai;
    return createOpenAI({ baseURL: o.baseURL, apiKey: o.apiKey ?? undefined }).chat(
      this.model,
    );
  }
}

// Tutor brain. Defaults to Sarvam AI (sarvam-native, great at Indian
// languages); pass "openai" to use OpenAI instead. The learner picks the
// provider in the UI (sent via the x-tutor-model header); TUTOR_PROVIDER is the
// server-side fallback when the request doesn't specify one.
function buildAdapter(requested?: string | null): CopilotServiceAdapter {
  const provider = requested ?? process.env.TUTOR_PROVIDER ?? "sarvam";
  const useSarvam = provider === "sarvam" && !!process.env.SARVAM_API_KEY;
  if (useSarvam) {
    return new ChatCompletionsAdapter({
      openai: new OpenAI({
        apiKey: process.env.SARVAM_API_KEY,
        baseURL: "https://api.sarvam.ai/v1",
      }),
      model: process.env.SARVAM_MODEL ?? "sarvam-30b",
    });
  }
  return new OpenAIAdapter({
    openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
  });
}

// In-process tutor: CopilotKit runtime + chat LLM. Pedagogy comes from the
// chat `instructions`; problem context from CopilotKit readables on the client.
export async function POST(req: NextRequest) {
  // Auth-gate + rate-limit the expensive LLM call.
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

  const serviceAdapter = buildAdapter(req.headers.get("x-tutor-model"));
  const copilotRuntime = new CopilotRuntime();

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
}

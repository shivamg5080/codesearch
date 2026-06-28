import {
  CopilotRuntime,
  InMemoryAgentRunner,
  // Both endpoint helpers are tagged @deprecated in 1.60.1 (packaging quirk);
  // createCopilotEndpoint is what CopilotKit's own CLI template generates.
  createCopilotEndpoint,
} from "@copilotkit/runtime/v2";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { handle } from "hono/vercel";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { recordMessageAndCheck } from "@/lib/usage";
import { recordAttempt, logUserMessage } from "@/lib/progress";

export const runtime = "nodejs";

// The LangGraph dev server (`npm run agent:dev` -> langgraphjs dev) hosts the
// `tutor` graph defined in agent/tutor.ts.
const LANGGRAPH_URL = process.env.LANGGRAPH_URL ?? "http://localhost:2024";

const copilotRuntime = new CopilotRuntime({
  // Registered as "default" — the agent name the CopilotKit v2 provider
  // resolves when no explicit agentId is given. graphId "tutor" is the
  // LangGraph graph from langgraph.json.
  agents: {
    default: new LangGraphAgent({
      deploymentUrl: LANGGRAPH_URL,
      graphId: "tutor",
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
  },
  runner: new InMemoryAgentRunner(),
});

const app = createCopilotEndpoint({
  runtime: copilotRuntime,
  basePath: "/api/copilotkit",
});

const honoHandler = handle(app);

export const GET = honoHandler;
export const PATCH = honoHandler;
export const DELETE = honoHandler;

// Auth-gate + rate-limit the expensive agent run. /info and /threads stay open
// so the page can load; only the OpenAI-spending run is protected.
export async function POST(req: NextRequest) {
  const isRun = new URL(req.url).pathname.endsWith("/run");
  if (isRun) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return Response.json({ error: "Sign in to use the tutor." }, { status: 401 });
    }
    const usage = await recordMessageAndCheck(userId);
    if (!usage.allowed) {
      return Response.json(
        {
          error: `Daily limit reached (${usage.cap} messages). Try again tomorrow.`,
        },
        { status: 429 },
      );
    }

    // Best-effort progress tracking — never block the chat on it.
    try {
      const body = await req.clone().json();
      const problemId: string | undefined = body?.state?.problem?.id;
      if (problemId) {
        await recordAttempt(userId, problemId);
        const msgs: { role?: string; content?: unknown }[] = body?.messages ?? [];
        const lastUser = [...msgs].reverse().find((m) => m.role === "user");
        const content =
          typeof lastUser?.content === "string"
            ? lastUser.content
            : lastUser?.content
              ? JSON.stringify(lastUser.content)
              : "";
        if (content) await logUserMessage(userId, problemId, content);
      }
    } catch {
      // ignore tracking failures
    }
  }
  return honoHandler(req);
}

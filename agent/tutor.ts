/**
 * CodeSearch Tutor — a LangGraph (TypeScript) agent with AG-UI shared state.
 *
 * Shared state (read/written by both the UI and this agent):
 *   - problem:   the current problem's metadata (UI -> agent)
 *   - mode:      tutor mode UNDERSTAND | HINT | REVIEW | TEACH | QUIZ (UI -> agent)
 *   - userCode:  the learner's current code (UI -> agent, read in REVIEW)
 *   - hintLevel: 0..5 progressive-hint level reached (agent -> UI, live)
 *   - keyPoints: understanding notes the tutor surfaces (agent -> UI, live)
 *
 * Pedagogy: STRICT HINT-GATING — never reveal a full solution (level 5) unless
 * the user has explicitly asked for it at least twice.
 */
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import {
  Command,
  Annotation,
  MessagesAnnotation,
  StateGraph,
  END,
  START,
} from "@langchain/langgraph";
import { PEDAGOGY, MODE_INSTRUCTIONS, type TutorMode } from "../src/prompts";

interface ProblemMeta {
  id: string;
  title: string;
  source: string;
  tags: string[];
  rating?: number | null;
  url: string;
}

// Tool the model calls to push progress (hint level + understanding notes) into
// the shared state. predict_state streams these args into the UI live.
const UPDATE_PROGRESS_TOOL = {
  type: "function" as const,
  function: {
    name: "update_progress",
    description:
      "Record learning progress. Call this when you give the learner a hint " +
      "(set hintLevel to the new highest level reached, 1-5) and/or when you " +
      "surface a key understanding point. ALWAYS pass the full keyPoints list, " +
      "not just new items.",
    parameters: {
      type: "object",
      properties: {
        hintLevel: {
          type: "integer",
          minimum: 0,
          maximum: 5,
          description:
            "Highest progressive-hint level reached. 1=observation, " +
            "2=which technique, 3=high-level approach, 4=pseudo-code, " +
            "5=full solution (only after the user asks twice).",
        },
        keyPoints: {
          type: "array",
          items: { type: "string" },
          description: "Full list of key understanding points so far.",
        },
      },
      required: ["hintLevel", "keyPoints"],
    },
  },
};

export const TutorStateAnnotation = Annotation.Root({
  problem: Annotation<ProblemMeta | undefined>(),
  statement: Annotation<string | undefined>(),
  mode: Annotation<TutorMode | undefined>(),
  userCode: Annotation<string | undefined>(),
  hintLevel: Annotation<number | undefined>(),
  keyPoints: Annotation<string[] | undefined>(),
  // CopilotKit forwards frontend tool definitions with a dynamic schema.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Annotation<any[]>(),
  ...MessagesAnnotation.spec,
});
export type TutorState = typeof TutorStateAnnotation.State;

function buildSystemPrompt(state: TutorState): string {
  const p = state.problem;
  const mode = (state.mode ?? "UNDERSTAND") as TutorMode;
  const meta = p
    ? [
        `Title: ${p.title}`,
        `Source: ${p.source}`,
        `URL: ${p.url}`,
        p.tags?.length ? `Tags: ${p.tags.join(", ")}` : null,
        p.rating != null ? `Rating: ${p.rating}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "No problem selected yet.";

  const code = state.userCode?.trim()
    ? `\n\nLearner's current code:\n\`\`\`\n${state.userCode}\n\`\`\``
    : "";

  const statement = state.statement?.trim()
    ? `\n\nProblem statement:\n${state.statement.trim()}`
    : `\n\nNo problem statement was provided. If you do NOT recognize this exact ` +
      `problem from its title, do not guess its contents — ask the learner to ` +
      `paste the statement (they have it open on the judge via the link). You may ` +
      `still discuss the likely techniques from the tags while you wait.`;

  return `${PEDAGOGY}\n\n${MODE_INSTRUCTIONS[mode]}\n\n--- CURRENT PROBLEM ---\n${meta}${statement}\n\nProgress so far — hintLevel: ${state.hintLevel ?? 0}.${code}`;
}

async function startFlow(
  state: TutorState,
  config?: RunnableConfig,
): Promise<Command> {
  if (state.hintLevel === undefined) {
    state.hintLevel = 0;
    state.keyPoints = state.keyPoints ?? [];
    await dispatchCustomEvent("manually_emit_intermediate_state", state, config);
  }
  return new Command({
    goto: "chat_node",
    update: { messages: state.messages, hintLevel: state.hintLevel, keyPoints: state.keyPoints },
  });
}

async function chatNode(
  state: TutorState,
  config?: RunnableConfig,
): Promise<Command> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
  });

  config = config ?? { recursionLimit: 25 };
  config.metadata = config.metadata ?? {};
  // Stream the tool args straight into shared state so the UI updates live.
  config.metadata.predict_state = [
    { state_key: "hintLevel", tool: "update_progress", tool_argument: "hintLevel" },
    { state_key: "keyPoints", tool: "update_progress", tool_argument: "keyPoints" },
  ];

  const modelWithTools = model.bindTools(
    [...(state.tools ?? []), UPDATE_PROGRESS_TOOL],
    { parallel_tool_calls: false },
  );

  const response = await modelWithTools.invoke(
    [new SystemMessage({ content: buildSystemPrompt(state) }), ...state.messages],
    config,
  );

  const messages = [...state.messages, response];

  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolCall = response.tool_calls[0];
    if (toolCall.name === "update_progress") {
      const nextHint = Math.max(
        state.hintLevel ?? 0,
        Number(toolCall.args.hintLevel ?? state.hintLevel ?? 0),
      );
      const nextPoints: string[] = Array.isArray(toolCall.args.keyPoints)
        ? toolCall.args.keyPoints
        : (state.keyPoints ?? []);

      const toolResponse = {
        role: "tool" as const,
        content: "Progress recorded.",
        tool_call_id: toolCall.id,
      };

      state.hintLevel = nextHint;
      state.keyPoints = nextPoints;
      await dispatchCustomEvent("manually_emit_intermediate_state", state, config);

      return new Command({
        goto: "start_flow",
        update: {
          messages: [...messages, toolResponse],
          hintLevel: nextHint,
          keyPoints: nextPoints,
        },
      });
    }
  }

  return new Command({
    goto: END,
    update: { messages, hintLevel: state.hintLevel, keyPoints: state.keyPoints },
  });
}

const workflow = new StateGraph(TutorStateAnnotation)
  .addNode("start_flow", startFlow, { ends: ["chat_node"] })
  .addNode("chat_node", chatNode, { ends: ["start_flow", END] })
  .addEdge(START, "start_flow");

export const tutorGraph = workflow.compile();

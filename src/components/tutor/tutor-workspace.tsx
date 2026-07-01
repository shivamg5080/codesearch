"use client";

import {
  CopilotKit,
  useCopilotReadable,
  useCopilotAction,
  useCopilotAdditionalInstructions,
} from "@copilotkit/react-core";
import { useState } from "react";
import type { TutorMode } from "@/prompts";
import { buildLanguageInstruction } from "@/prompts";
import { DEFAULT_LANGUAGE, languageLabel } from "@/lib/languages";
import { ProblemPanel } from "./problem-panel";
import { ChatPanel } from "./chat-panel";

export interface ProblemMeta {
  id: string;
  title: string;
  source: string;
  tags: string[];
  rating?: number | null;
  url: string;
}

export interface ChatHistoryMessage {
  role: "USER" | "ASSISTANT";
  content: string;
}

export type TutorProvider = "sarvam" | "openai";

export function TutorWorkspace({
  problem,
  authed,
  history = [],
}: {
  problem: ProblemMeta & { statement?: string | null };
  authed: boolean;
  history?: ChatHistoryMessage[];
}) {
  // Which LLM answers. Lifted here so it can be sent as a request header to the
  // CopilotKit runtime (headers are re-evaluated on each render).
  const [provider, setProvider] = useState<TutorProvider>("sarvam");
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" headers={{ "x-tutor-model": provider }}>
      <Workspace
        problem={problem}
        initialStatement={problem.statement ?? ""}
        authed={authed}
        history={history}
        provider={provider}
        setProvider={setProvider}
      />
    </CopilotKit>
  );
}

function Workspace({
  problem,
  initialStatement,
  authed,
  history,
  provider,
  setProvider,
}: {
  problem: ProblemMeta;
  initialStatement: string;
  authed: boolean;
  history: ChatHistoryMessage[];
  provider: TutorProvider;
  setProvider: (p: TutorProvider) => void;
}) {
  const [mode, setMode] = useState<TutorMode>("UNDERSTAND");
  const [code, setCode] = useState("");
  const [statement, setStatement] = useState(initialStatement);
  const [showStatement, setShowStatement] = useState(!initialStatement);
  const [hintLevel, setHintLevel] = useState(0);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  // --- Context the tutor can read (sent with each request) ---
  useCopilotReadable({
    description: "The current coding problem the learner is working on",
    value: {
      title: problem.title,
      source: problem.source,
      tags: problem.tags,
      rating: problem.rating,
      url: problem.url,
    },
  });
  useCopilotReadable({
    description:
      "The full problem statement (may be empty — if so and you don't recognise the problem, ask the learner to paste it)",
    value: statement || "(not provided)",
  });
  useCopilotReadable({ description: "Current tutor mode", value: mode });
  useCopilotReadable({
    description: "The learner's current code attempt",
    value: code || "(none yet)",
  });
  useCopilotReadable({
    description: "Highest progressive-hint level reached so far (0-5)",
    value: hintLevel,
  });

  // --- Vernacular tutoring: reply in the learner's chosen Indian language. ---
  useCopilotAdditionalInstructions(
    {
      instructions: buildLanguageInstruction(languageLabel(language), language),
      available: language === "en-IN" ? "disabled" : "enabled",
    },
    [language],
  );

  // --- The tutor pushes progress into the UI via this action ---
  useCopilotAction({
    name: "update_progress",
    description:
      "Record the learner's progress. Call this when you give a hint or surface a key insight: pass the new highest hint level (1-5) and the FULL list of key understanding points.",
    parameters: [
      {
        name: "hintLevel",
        type: "number",
        description: "Highest progressive-hint level reached (1-5).",
      },
      {
        name: "keyPoints",
        type: "string[]",
        description: "Full list of key understanding points so far.",
        required: false,
      },
    ],
    handler: ({ hintLevel: hl, keyPoints: kp }) => {
      if (typeof hl === "number") setHintLevel((prev) => Math.max(prev, hl));
      if (Array.isArray(kp)) setKeyPoints(kp as string[]);
    },
    render: () => <></>,
  });

  // Persist a pasted statement so it's cached for everyone next time.
  const saveStatement = (text: string) => {
    if (!text.trim() || text === initialStatement) return;
    fetch(`/api/problems/${problem.id}/statement`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement: text }),
    }).catch(() => {});
  };

  // Mark the problem Attempting + log the message when the learner asks something.
  const trackActivity = (message: string) => {
    fetch(`/api/problems/${problem.id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).catch(() => {});
  };

  return (
    <div className="grid h-[calc(100vh-49px)] grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Left: problem + workspace */}
      <ProblemPanel
        problem={problem}
        statement={statement}
        setStatement={setStatement}
        saveStatement={saveStatement}
        showStatement={showStatement}
        setShowStatement={setShowStatement}
        mode={mode}
        setMode={setMode}
        hintLevel={hintLevel}
        keyPoints={keyPoints}
        code={code}
        setCode={setCode}
        authed={authed}
      />

      {/* Right: the AI tutor */}
      <div className="flex min-h-0 flex-col bg-neutral-900/30">
        <div className="border-b border-neutral-800 px-5 py-3">
          <h2 className="font-semibold">CodeSearch Tutor</h2>
          <p className="text-xs text-neutral-500">
            Hints, not spoilers — it won’t hand over the full solution unless you really insist.
          </p>
        </div>
        <div className="min-h-0 flex-1">
          {authed ? (
            <ChatPanel
              problemId={problem.id}
              mode={mode}
              language={language}
              setLanguage={setLanguage}
              trackActivity={trackActivity}
              history={history}
              provider={provider}
              setProvider={setProvider}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="max-w-xs text-neutral-400">
                Sign in to chat with the tutor and save your progress.
              </p>
              <a
                href={`/signin?callbackUrl=/problems/${problem.id}`}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Sign in to start
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { CopilotKit, useCopilotReadable, useCopilotAction } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useState } from "react";
import { buildInstructions, type TutorMode } from "@/lib/tutor-prompt";

export interface ProblemMeta {
  id: string;
  title: string;
  source: string;
  tags: string[];
  rating?: number | null;
  url: string;
}

const MODES: { id: TutorMode; label: string; hint: string }[] = [
  { id: "UNDERSTAND", label: "Understand", hint: "Grasp the problem" },
  { id: "HINT", label: "Hint", hint: "One nudge at a time" },
  { id: "REVIEW", label: "Review code", hint: "Find bugs & complexity" },
  { id: "TEACH", label: "Teach pattern", hint: "Learn the technique" },
  { id: "QUIZ", label: "Quiz me", hint: "Check understanding" },
];

const SOURCE_LABEL: Record<string, string> = {
  CODEFORCES: "Codeforces",
  CODECHEF: "CodeChef",
  CSES: "CSES",
  LEETCODE: "LeetCode",
};

const HINT_LABELS = [
  "No hints yet",
  "L1 · Observation",
  "L2 · Technique",
  "L3 · Approach",
  "L4 · Pseudo-code",
  "L5 · Full solution",
];

export function TutorWorkspace({
  problem,
  authed,
}: {
  problem: ProblemMeta & { statement?: string | null };
  authed: boolean;
}) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <Workspace
        problem={problem}
        initialStatement={problem.statement ?? ""}
        authed={authed}
      />
    </CopilotKit>
  );
}

function Workspace({
  problem,
  initialStatement,
  authed,
}: {
  problem: ProblemMeta;
  initialStatement: string;
  authed: boolean;
}) {
  const [mode, setMode] = useState<TutorMode>("UNDERSTAND");
  const [code, setCode] = useState("");
  const [statement, setStatement] = useState(initialStatement);
  const [showStatement, setShowStatement] = useState(!initialStatement);
  const [hintLevel, setHintLevel] = useState(0);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);

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
      <div className="overflow-y-auto border-r border-neutral-800 p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{problem.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-300">
                {SOURCE_LABEL[problem.source] ?? problem.source}
              </span>
              {problem.rating != null && (
                <span className="rounded bg-indigo-500/15 px-2 py-0.5 font-semibold text-indigo-300">
                  Rating {problem.rating}
                </span>
              )}
              {problem.tags.slice(0, 6).map((t) => (
                <span key={t} className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-400">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <a
            href={problem.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-indigo-500 hover:text-indigo-300"
          >
            Open on judge ↗
          </a>
        </div>

        <p className="mb-4 text-sm text-neutral-400">
          {statement.trim()
            ? "Statement loaded ✓ — pick a mode and start chatting with the tutor on the right."
            : "Open the statement on the judge above and paste it below so the tutor knows the exact problem (cached after the first time), then pick a mode and chat."}
        </p>

        {/* Problem statement — paste once, cached to DB, read by the tutor */}
        <div className="mb-5">
          <button
            onClick={() => setShowStatement((s) => !s)}
            className="mb-1.5 flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            <span className={`transition ${showStatement ? "rotate-90" : ""}`}>▸</span>
            Problem statement
            {statement.trim() ? (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300">
                provided
              </span>
            ) : (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300">
                paste to improve answers
              </span>
            )}
          </button>
          {showStatement && (
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              onBlur={(e) => saveStatement(e.target.value)}
              placeholder="Paste the full problem statement here…"
              spellCheck={false}
              className="h-40 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm leading-relaxed text-neutral-200 outline-none focus:border-indigo-500"
            />
          )}
        </div>

        {/* Mode selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.hint}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                mode === m.id
                  ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                  : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Hint-level meter — updated by the tutor via update_progress */}
        <div className="mb-6">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-neutral-400">Hint level</span>
            <span className="font-medium text-indigo-300">{HINT_LABELS[hintLevel]}</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((l) => (
              <div
                key={l}
                className={`h-2 flex-1 rounded-full ${
                  l <= hintLevel ? "bg-indigo-500" : "bg-neutral-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Key takeaways — populated by the tutor */}
        {keyPoints.length > 0 && (
          <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-300">Key takeaways</h3>
            <ul className="space-y-1.5">
              {keyPoints.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-400">
                  <span className="text-indigo-400">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Code editor — read by the tutor in Review mode */}
        <div>
          <label className="mb-1.5 block text-sm text-neutral-400">
            Your code{" "}
            <span className="text-neutral-600">(switch to “Review code” and ask the tutor)</span>
          </label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// paste or write your attempt here…"
            spellCheck={false}
            className="h-64 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-4 font-mono text-sm leading-relaxed text-neutral-200 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

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
            <CopilotChat
              instructions={buildInstructions(mode)}
              onSubmitMessage={trackActivity}
              labels={{
                initial:
                  "Hi! Ask me anything about this problem — I'll guide you with hints, not spoilers.",
                placeholder: "Ask the tutor…",
              }}
              className="h-full"
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

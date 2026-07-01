"use client";

import type { TutorMode } from "@/prompts";
import { RunPanel } from "./run-panel";
import type { ProblemMeta } from "./tutor-workspace";

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

/**
 * Left column of the tutor workspace: problem header, statement editor,
 * mode selector, hint-level meter, key takeaways, code editor and runner.
 * Purely presentational — all state lives in the parent Workspace.
 */
export function ProblemPanel({
  problem,
  statement,
  setStatement,
  saveStatement,
  showStatement,
  setShowStatement,
  mode,
  setMode,
  hintLevel,
  keyPoints,
  code,
  setCode,
  authed,
}: {
  problem: ProblemMeta;
  statement: string;
  setStatement: (s: string) => void;
  saveStatement: (s: string) => void;
  showStatement: boolean;
  setShowStatement: (fn: (s: boolean) => boolean) => void;
  mode: TutorMode;
  setMode: (m: TutorMode) => void;
  hintLevel: number;
  keyPoints: string[];
  code: string;
  setCode: (c: string) => void;
  authed: boolean;
}) {
  return (
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

      {/* Code editor — read by the tutor in Review mode, and runnable below */}
      <div>
        <label className="mb-1.5 flex items-center gap-2 text-sm text-neutral-400">
          Your code
          <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
            C++
          </span>
          <span className="text-neutral-600">(review with the tutor, or run it below)</span>
        </label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="// paste or write your C++ attempt here…"
          spellCheck={false}
          className="h-64 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-4 font-mono text-sm leading-relaxed text-neutral-200 outline-none focus:border-indigo-500"
        />
      </div>

      <RunPanel code={code} authed={authed} source={problem.source} />
    </div>
  );
}

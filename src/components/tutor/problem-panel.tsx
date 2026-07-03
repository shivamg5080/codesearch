"use client";

import { useEffect, useRef, useState } from "react";
import type { TutorMode } from "@/prompts";
import { CodePanel } from "./code-panel";
import type { ProblemMeta } from "./tutor-workspace";

const MODES: { id: TutorMode; label: string; sub: string }[] = [
  { id: "UNDERSTAND", label: "Understand", sub: "unpack the ask" },
  { id: "HINT", label: "Hint", sub: "smallest useful nudge" },
  { id: "REVIEW", label: "Review code", sub: "critique my attempt" },
  { id: "TEACH", label: "Teach pattern", sub: "generalize the trick" },
  { id: "QUIZ", label: "Quiz me", sub: "check my grasp" },
];

const SOURCE_LABEL: Record<string, string> = {
  CODEFORCES: "Codeforces",
  CODECHEF: "CodeChef",
  CSES: "CSES",
  LEETCODE: "LeetCode",
};

const HINT_NAMES = ["Observation", "Technique", "Approach", "Pseudo-code", "Full solution"];

/**
 * The signature element: five gated hint levels. Amber fills what the tutor has
 * revealed; L5 stays dashed + locked until the learner insists twice.
 */
function HintLadder({ hintLevel }: { hintLevel: number }) {
  const prevRef = useRef(hintLevel);
  const [sweepIdx, setSweepIdx] = useState(-1);
  useEffect(() => {
    if (hintLevel > prevRef.current) {
      setSweepIdx(hintLevel - 1);
      const t = setTimeout(() => setSweepIdx(-1), 800);
      prevRef.current = hintLevel;
      return () => clearTimeout(t);
    }
    prevRef.current = hintLevel;
  }, [hintLevel]);

  const label =
    hintLevel === 0 ? "no hints yet" : `L${hintLevel} · ${HINT_NAMES[hintLevel - 1]} revealed`;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-(--muted)">
          HINT LADDER
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[11.5px] text-(--amber)">{label}</span>
      </div>
      <div className="flex items-stretch gap-1.5">
        {HINT_NAMES.map((name, i) => {
          const filled = i < hintLevel;
          const isLock = i === 4 && hintLevel < 5;
          return (
            <div key={name} className="flex min-w-0 flex-1 flex-col gap-[7px]">
              {filled ? (
                <div
                  className={`h-[15px] rounded bg-gradient-to-b from-[#ffd57a] to-[#f5b942] shadow-[0_0_14px_1px_rgba(245,185,66,0.22)] ${
                    i === sweepIdx ? "animate-hint-sweep" : ""
                  }`}
                />
              ) : isLock ? (
                <div className="flex h-[15px] items-center justify-center rounded border border-dashed border-(--border-strong) bg-(--hover)">
                  <span className="text-[8.5px] leading-none text-(--muted)">🔒</span>
                </div>
              ) : (
                <div className="h-[15px] rounded border border-(--border-strong) bg-(--hover)" />
              )}
              <div
                className={`truncate font-mono text-[10px] ${
                  filled ? "text-(--amber)" : "text-(--muted)"
                }`}
              >
                <span className="font-bold">L{i + 1}</span> {name}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex">
        <span className="flex-1" />
        <span className="font-mono text-[10px] text-(--dim)">
          L5 unlocks only if you insist twice
        </span>
      </div>
    </div>
  );
}

/**
 * Left column ("workbench"): problem header, statement document card, the hint
 * ladder, session-intent mode cards, and the code panel. All state lives in the
 * parent Workspace.
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
  const hasStatement = !!statement.trim();

  return (
    <div className="flex flex-col gap-5 overflow-y-auto border-r border-(--border) bg-(--bg) p-6">
      {/* Problem header */}
      <div className="flex flex-col gap-3">
        <h1 className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em] text-(--text)">
          {problem.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
          <span className="rounded border border-(--border-strong) px-2 py-[3px] text-(--body-2)">
            {SOURCE_LABEL[problem.source] ?? problem.source}
          </span>
          {problem.rating != null && (
            <span className="rounded border border-(--border-strong) bg-(--hover) px-2 py-[3px] text-(--body-2)">
              Rating {problem.rating}
            </span>
          )}
          {problem.tags.slice(0, 6).map((t) => (
            <span key={t} className="rounded border border-(--border) px-2 py-[3px] text-(--muted)">
              {t}
            </span>
          ))}
          <span className="flex-1" />
          <a
            href={problem.url}
            target="_blank"
            rel="noreferrer"
            className="px-1 py-[3px] text-(--muted) hover:text-(--text) hover:underline"
          >
            Open on judge ↗
          </a>
        </div>
      </div>

      {/* Statement document card */}
      <div className="overflow-hidden rounded-lg border border-(--border) bg-(--surface)">
        <button
          onClick={() => setShowStatement((s) => !s)}
          className="flex w-full items-center gap-2.5 px-4 pb-2.5 pt-3.5 text-left"
        >
          <span className="font-mono text-[10.5px] tracking-[0.14em] text-(--muted)">
            PROBLEM STATEMENT
          </span>
          {hasStatement ? (
            <span className="rounded border border-(--green-brd) bg-(--green-bg) px-[7px] py-[2px] font-mono text-[10px] text-(--green)">
              provided
            </span>
          ) : (
            <span className="rounded border border-(--amber-brd) bg-(--amber-bg) px-[7px] py-[2px] font-mono text-[10px] text-(--amber)">
              paste to improve answers
            </span>
          )}
          <span className="flex-1" />
          <span className="font-mono text-[11px] text-(--muted)">
            {showStatement ? "collapse ▴" : "expand ▾"}
          </span>
        </button>

        {showStatement ? (
          <div className="px-4 pb-4">
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              onBlur={(e) => saveStatement(e.target.value)}
              placeholder="Paste the full problem statement here…"
              spellCheck={false}
              className="h-48 w-full resize-y rounded-md border border-(--border) bg-(--bg) p-3 text-[13.5px] leading-relaxed text-(--body-2) outline-none focus:border-(--accent)"
            />
          </div>
        ) : hasStatement ? (
          <div className="relative max-h-16 overflow-hidden px-4 pb-3">
            <p className="m-0 max-w-[62ch] text-[13.5px] leading-[1.55] text-(--body-2)">
              {statement.slice(0, 400)}
            </p>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-(--surface)" />
          </div>
        ) : (
          <p className="px-4 pb-3.5 text-[12.5px] text-(--dim)">
            Open the statement on the judge and paste it here — cached for everyone after
            the first time.
          </p>
        )}
      </div>

      {/* Hint ladder — the page's signature */}
      <HintLadder hintLevel={hintLevel} />

      {/* Session intents */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-[11px] text-left transition ${
                active
                  ? "border-(--accent) bg-(--accent-bg)"
                  : "border-(--border) bg-(--surface) hover:border-(--border-hover) hover:bg-(--surface-2)"
              }`}
            >
              <span
                className={`text-[13px] font-semibold ${active ? "text-(--text)" : "text-(--body-2)"}`}
              >
                {m.label}
              </span>
              <span
                className={`font-mono text-[10px] ${active ? "text-(--accent-soft)" : "text-(--muted)"}`}
              >
                {m.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Key takeaways — populated by the tutor */}
      {keyPoints.length > 0 && (
        <div className="rounded-lg border border-(--border) bg-(--surface) p-4">
          <div className="mb-2 font-mono text-[10.5px] tracking-[0.14em] text-(--muted)">
            KEY TAKEAWAYS
          </div>
          <ul className="space-y-1.5">
            {keyPoints.map((p, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-(--body-2)">
                <span className="text-(--accent)">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CodePanel code={code} setCode={setCode} authed={authed} source={problem.source} />
    </div>
  );
}

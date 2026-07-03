"use client";

import { useRef, useState } from "react";

interface RunResult {
  status: string;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  time: string | null;
  memory: number | null;
}

/**
 * Editor-chrome code panel: "solution.cpp" tab bar with Run, a line-number
 * gutter synced to the textarea, collapsible stdin, and a judge-style verdict
 * strip (verdict colors live here and only here).
 */
export function CodePanel({
  code,
  setCode,
  authed,
  source,
}: {
  code: string;
  setCode: (c: string) => void;
  authed: boolean;
  source: string;
}) {
  const [stdin, setStdin] = useState("");
  const [stdinOpen, setStdinOpen] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lines = Math.max(code.split("\n").length, 14);

  const run = async () => {
    if (!code.trim()) {
      setError("Write some C++ code first.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Run failed.");
        return;
      }
      setResult(data as RunResult);
    } catch {
      setError("Run failed — try again.");
    } finally {
      setRunning(false);
    }
  };

  const accepted = result?.status === "Accepted";
  const verdictOut = result?.stdout?.trim().split("\n")[0]?.slice(0, 40);

  return (
    <div className="overflow-hidden rounded-lg border border-(--border) bg-(--code-bg)">
      {/* Tab bar */}
      <div className="flex h-10 items-center border-b border-(--border) bg-(--surface-2)">
        <div className="flex h-full items-center gap-2 border-r border-(--border) bg-(--code-bg) px-3.5">
          <span className="font-mono text-xs text-(--text)">solution.cpp</span>
          <span className="rounded border border-(--border-strong) px-1.5 py-[2px] font-mono text-[9.5px] text-(--muted)">
            C++17
          </span>
        </div>
        <span className="flex-1" />
        <button
          onClick={run}
          disabled={running || !authed}
          title={authed ? "Run against the input below" : "Sign in to run code"}
          className="mr-2.5 flex items-center gap-1.5 rounded-md border border-(--border-strong) bg-(--control) px-3.5 py-[5px] font-mono text-[11.5px] text-(--text) transition hover:border-(--border-hover) hover:bg-(--hover) disabled:opacity-50"
        >
          ▶ Run
        </button>
      </div>

      {/* Editor with line-number gutter */}
      <div className="flex py-3">
        <div
          ref={gutterRef}
          className="w-[38px] flex-none select-none overflow-hidden border-r border-(--border-soft) pr-2.5 text-right font-mono text-[12.5px] leading-5 text-(--faint)"
          aria-hidden
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className="h-5">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          placeholder="// paste or write your C++ attempt here…"
          spellCheck={false}
          className="h-72 w-full resize-none bg-transparent px-3.5 font-mono text-[12.5px] leading-5 text-(--body) outline-none placeholder:text-(--faint)"
        />
      </div>

      {/* stdin + verdict strip */}
      <div className="flex flex-col gap-2 border-t border-(--border) bg-(--code-strip) px-3 py-[9px]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStdinOpen((s) => !s)}
            className="flex items-center gap-1.5 px-1 py-[3px] font-mono text-[11px] text-(--muted) hover:text-(--text)"
          >
            {stdinOpen ? "▾ stdin" : "▸ stdin"}
          </button>
          <span className="flex-1" />
          {running && (
            <span className="font-mono text-[11px] text-(--muted)">▸ running…</span>
          )}
          {!running && result && (
            <span
              className={`rounded-[5px] border px-2.5 py-1 font-mono text-[11px] ${
                accepted
                  ? "border-(--green-brd) bg-(--green-bg) text-(--green)"
                  : "border-(--red-brd) bg-(--red-bg) text-(--red)"
              }`}
            >
              {accepted
                ? `✓ ran${result.time ? ` · ${result.time}s` : ""}${verdictOut ? ` · output: ${verdictOut}` : ""}`
                : `✗ ${result.status}`}
            </span>
          )}
          {!running && !result && error && (
            <span className="font-mono text-[11px] text-(--red)">{error}</span>
          )}
        </div>

        {stdinOpen && (
          <>
            {source === "LEETCODE" && (
              <p className="font-mono text-[10.5px] leading-relaxed text-(--amber)">
                LeetCode gives you a class Solution — write a complete program with main()
                that reads stdin to run it here.
              </p>
            )}
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder={"paste a sample input, e.g.\n15 10"}
              spellCheck={false}
              className="h-[72px] w-full resize-y rounded-md border border-(--border) bg-(--bg) px-2.5 py-2 font-mono text-xs leading-normal text-(--body-2) outline-none focus:border-(--accent)"
            />
          </>
        )}

        {/* Detailed output when it isn't a clean pass */}
        {result && (result.compileOutput || result.stderr || (!accepted && result.stdout)) && (
          <div className="flex flex-col gap-2">
            {result.stdout && !accepted && (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-(--bg) p-2 font-mono text-xs text-(--body-2)">
                {result.stdout}
              </pre>
            )}
            {result.compileOutput && (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-(--bg) p-2 font-mono text-xs text-(--amber)">
                {result.compileOutput}
              </pre>
            )}
            {result.stderr && (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-(--bg) p-2 font-mono text-xs text-(--red)">
                {result.stderr}
              </pre>
            )}
          </div>
        )}
        {result && accepted && result.stdout && result.stdout.trim().includes("\n") && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-(--bg) p-2 font-mono text-xs text-(--body-2)">
            {result.stdout}
          </pre>
        )}
      </div>
    </div>
  );
}

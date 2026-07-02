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
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0d0e13]">
      {/* Tab bar */}
      <div className="flex h-10 items-center border-b border-white/[0.08] bg-[#12131a]">
        <div className="flex h-full items-center gap-2 border-r border-white/[0.08] bg-[#0d0e13] px-3.5">
          <span className="font-mono text-xs text-[#e8e9ee]">solution.cpp</span>
          <span className="rounded border border-white/[0.12] px-1.5 py-[2px] font-mono text-[9.5px] text-[#8b8e98]">
            C++17
          </span>
        </div>
        <span className="flex-1" />
        <button
          onClick={run}
          disabled={running || !authed}
          title={authed ? "Run against the input below" : "Sign in to run code"}
          className="mr-2.5 flex items-center gap-1.5 rounded-md border border-white/[0.14] bg-[#1a1c24] px-3.5 py-[5px] font-mono text-[11.5px] text-[#e8e9ee] transition hover:border-white/25 hover:bg-[#22242f] disabled:opacity-50"
        >
          ▶ Run
        </button>
      </div>

      {/* Editor with line-number gutter */}
      <div className="flex py-3">
        <div
          ref={gutterRef}
          className="w-[38px] flex-none select-none overflow-hidden border-r border-white/[0.06] pr-2.5 text-right font-mono text-[12.5px] leading-5 text-[#4d505c]"
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
          className="h-72 w-full resize-none bg-transparent px-3.5 font-mono text-[12.5px] leading-5 text-[#d7d9e0] outline-none placeholder:text-[#4d505c]"
        />
      </div>

      {/* stdin + verdict strip */}
      <div className="flex flex-col gap-2 border-t border-white/[0.08] bg-[#101117] px-3 py-[9px]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStdinOpen((s) => !s)}
            className="flex items-center gap-1.5 px-1 py-[3px] font-mono text-[11px] text-[#8b8e98] hover:text-[#e8e9ee]"
          >
            {stdinOpen ? "▾ stdin" : "▸ stdin"}
          </button>
          <span className="flex-1" />
          {running && (
            <span className="font-mono text-[11px] text-[#8b8e98]">▸ running…</span>
          )}
          {!running && result && (
            <span
              className={`rounded-[5px] border px-2.5 py-1 font-mono text-[11px] ${
                accepted
                  ? "border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399]"
                  : "border-[#f87171]/30 bg-[#f87171]/10 text-[#f87171]"
              }`}
            >
              {accepted
                ? `✓ ran${result.time ? ` · ${result.time}s` : ""}${verdictOut ? ` · output: ${verdictOut}` : ""}`
                : `✗ ${result.status}`}
            </span>
          )}
          {!running && !result && error && (
            <span className="font-mono text-[11px] text-[#f87171]">{error}</span>
          )}
        </div>

        {stdinOpen && (
          <>
            {source === "LEETCODE" && (
              <p className="font-mono text-[10.5px] leading-relaxed text-[#f5b942]/90">
                LeetCode gives you a class Solution — write a complete program with main()
                that reads stdin to run it here.
              </p>
            )}
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder={"paste a sample input, e.g.\n15 10"}
              spellCheck={false}
              className="h-[72px] w-full resize-y rounded-md border border-white/10 bg-[#0b0c10] px-2.5 py-2 font-mono text-xs leading-normal text-[#c6c8d0] outline-none focus:border-[#6d7cff]"
            />
          </>
        )}

        {/* Detailed output when it isn't a clean pass */}
        {result && (result.compileOutput || result.stderr || (!accepted && result.stdout)) && (
          <div className="flex flex-col gap-2">
            {result.stdout && !accepted && (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-[#0b0c10] p-2 font-mono text-xs text-[#c6c8d0]">
                {result.stdout}
              </pre>
            )}
            {result.compileOutput && (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-[#0b0c10] p-2 font-mono text-xs text-[#f5b942]">
                {result.compileOutput}
              </pre>
            )}
            {result.stderr && (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-[#0b0c10] p-2 font-mono text-xs text-[#f87171]">
                {result.stderr}
              </pre>
            )}
          </div>
        )}
        {result && accepted && result.stdout && result.stdout.trim().includes("\n") && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-[#0b0c10] p-2 font-mono text-xs text-[#c6c8d0]">
            {result.stdout}
          </pre>
        )}
      </div>
    </div>
  );
}

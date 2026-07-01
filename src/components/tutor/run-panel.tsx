"use client";

import { useState } from "react";

interface RunResult {
  status: string;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  time: string | null;
  memory: number | null;
}

/**
 * Run the C++ code in the editor against a sample input via Wandbox, in-browser.
 */
export function RunPanel({
  code,
  authed,
  source,
}: {
  code: string;
  authed: boolean;
  source: string;
}) {
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

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

  if (!authed) return null;

  const accepted = result?.status === "Accepted";
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-sm text-neutral-400">
          Input (stdin) <span className="text-neutral-600">— paste a sample input</span>
        </label>
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {running ? "Running…" : "▶ Run C++"}
        </button>
      </div>
      {source === "LEETCODE" && (
        <p className="mb-1.5 text-xs text-amber-400/90">
          Heads up: LeetCode gives you a <code>class Solution</code>, which can’t run on its
          own. Write a complete program with <code>main()</code> that reads stdin and prints
          output to run it here.
        </p>
      )}
      <textarea
        value={stdin}
        onChange={(e) => setStdin(e.target.value)}
        placeholder="e.g.&#10;15 10"
        spellCheck={false}
        className="h-20 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 font-mono text-sm text-neutral-200 outline-none focus:border-sky-500"
      />

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-3 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                accepted
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {result.status}
            </span>
            {result.time != null && (
              <span className="text-xs text-neutral-500">{result.time}s</span>
            )}
            {result.memory != null && (
              <span className="text-xs text-neutral-500">
                {Math.round(result.memory / 1024)} MB
              </span>
            )}
          </div>

          {result.stdout && (
            <div>
              <div className="mb-1 text-xs text-neutral-500">Output</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-2 font-mono text-neutral-200">
                {result.stdout}
              </pre>
            </div>
          )}
          {result.compileOutput && (
            <div>
              <div className="mb-1 text-xs text-amber-400">Compile error</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-2 font-mono text-amber-200">
                {result.compileOutput}
              </pre>
            </div>
          )}
          {result.stderr && (
            <div>
              <div className="mb-1 text-xs text-red-400">Runtime error / stderr</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-neutral-950 p-2 font-mono text-red-200">
                {result.stderr}
              </pre>
            </div>
          )}
          {!result.stdout && !result.compileOutput && !result.stderr && (
            <p className="text-xs text-neutral-500">(no output)</p>
          )}
        </div>
      )}
    </div>
  );
}

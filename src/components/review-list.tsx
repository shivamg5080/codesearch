"use client";

import Link from "next/link";
import { useState } from "react";

const SOURCE_LABEL: Record<string, string> = {
  CODEFORCES: "Codeforces",
  CODECHEF: "CodeChef",
  CSES: "CSES",
  LEETCODE: "LeetCode",
};

export interface ReviewItem {
  problemId: string;
  title: string;
  source: string;
}

/** Spaced-repetition review queue: mark each due problem remembered or not. */
export function ReviewList({ items }: { items: ReviewItem[] }) {
  const [done, setDone] = useState<Record<string, "remembered" | "again">>({});
  const [busy, setBusy] = useState<string | null>(null);

  const review = async (problemId: string, remembered: boolean) => {
    setBusy(problemId);
    try {
      await fetch(`/api/problems/${problemId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remembered }),
      });
      setDone((d) => ({ ...d, [problemId]: remembered ? "remembered" : "again" }));
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  };

  const remaining = items.filter((p) => !done[p.problemId]).length;

  return (
    <section className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h2 className="mb-1 text-lg font-semibold text-amber-200">
        🔁 Due for review <span className="text-amber-400/70">({remaining})</span>
      </h2>
      <p className="mb-3 text-xs text-neutral-400">
        Revisit these solved problems to lock them in. Mark whether you still remember the
        approach — we’ll reschedule the next review accordingly.
      </p>
      <ul className="space-y-2">
        {items.map((p) => {
          const outcome = done[p.problemId];
          return (
            <li
              key={p.problemId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2.5"
            >
              <Link
                href={`/problems/${p.problemId}`}
                className="min-w-0 flex-1 truncate hover:text-indigo-300"
              >
                {p.title}
                <span className="ml-2 text-xs text-neutral-500">
                  {SOURCE_LABEL[p.source] ?? p.source}
                </span>
              </Link>
              {outcome ? (
                <span
                  className={`shrink-0 text-xs ${
                    outcome === "remembered" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {outcome === "remembered" ? "✓ rescheduled later" : "↻ will revisit sooner"}
                </span>
              ) : (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => review(p.problemId, true)}
                    disabled={busy === p.problemId}
                    className="rounded-md border border-emerald-600/50 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-600/15 disabled:opacity-50"
                  >
                    ✓ Remembered
                  </button>
                  <button
                    onClick={() => review(p.problemId, false)}
                    disabled={busy === p.problemId}
                    className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:border-amber-500 hover:text-amber-300 disabled:opacity-50"
                  >
                    ↻ Review again
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

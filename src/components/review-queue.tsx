"use client";

import Link from "next/link";
import { useState } from "react";

// Mirrors REVIEW_INTERVALS_DAYS in src/lib/progress.ts (server is the source
// of truth; this is only used for the "next review in …" feedback line).
const INTERVALS_DAYS = [1, 3, 7, 16, 35, 90];

const SOURCE_LABEL: Record<string, string> = {
  CODEFORCES: "Codeforces",
  CODECHEF: "CodeChef",
  CSES: "CSES",
  LEETCODE: "LeetCode",
};

export interface ReviewCard {
  problemId: string;
  title: string;
  source: string;
  tags: string[];
  rating: number | null;
  reviewStage: number;
}

/**
 * Spaced-repetition queue: one card at a time — recall first, then grade
 * yourself. Remembered advances to a longer interval; Forgot resets to 1 day.
 */
export function ReviewQueue({ items }: { items: ReviewCard[] }) {
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remembered, setRemembered] = useState(0);

  const card = items[idx];
  const done = !card;

  const grade = async (didRemember: boolean) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/problems/${card.problemId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remembered: didRemember }),
      });
    } catch {
      /* rescheduling failed — still advance; it stays due for next visit */
    }
    const nextDays = didRemember
      ? INTERVALS_DAYS[Math.min(card.reviewStage + 1, INTERVALS_DAYS.length - 1)]
      : INTERVALS_DAYS[0];
    if (didRemember) setRemembered((n) => n + 1);
    setFeedback(
      didRemember ? `Nice — next review in ${nextDays}d` : `No problem — again tomorrow`,
    );
    setTimeout(() => {
      setFeedback(null);
      setIdx((i) => i + 1);
      setBusy(false);
    }, 900);
  };

  if (items.length === 0 || done) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-4xl">✓</span>
        <h1 className="text-2xl font-bold tracking-tight">
          {items.length === 0 ? "All caught up" : "Review session done"}
        </h1>
        <p className="max-w-sm text-sm text-(--muted)">
          {items.length === 0
            ? "Nothing is due for review. Solve problems and they'll come back here on a spaced-repetition schedule."
            : `${remembered} of ${items.length} remembered — forgotten ones return tomorrow.`}
        </p>
        <div className="flex items-center gap-4 font-mono text-xs">
          <Link href="/" className="text-(--accent-soft) transition hover:text-(--text)">
            browse problems →
          </Link>
          <Link href="/dashboard" className="text-(--muted) transition hover:text-(--text)">
            dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-12">
      <div className="mb-3 flex items-baseline">
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-(--muted)">
          REVIEW {idx + 1} / {items.length}
        </span>
        <span className="flex-1" />
        <span className="font-mono text-[10px] text-(--dim)">
          recall first · then grade yourself
        </span>
      </div>

      <div className="rounded-2xl border border-(--border) bg-(--surface) p-7">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em]">
          {card.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="rounded border border-(--border-strong) px-2 py-[3px] text-(--body-2)">
            {SOURCE_LABEL[card.source] ?? card.source}
          </span>
          {card.rating != null && (
            <span className="rounded border border-(--border-strong) bg-(--hover) px-2 py-[3px] text-(--body-2)">
              Rating {card.rating}
            </span>
          )}
          {card.tags.map((t) => (
            <span key={t} className="rounded border border-(--border) px-2 py-[3px] text-(--muted)">
              {t}
            </span>
          ))}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-(--body-2)">
          Without looking: what was the key observation, the technique, and the
          complexity? Say it out loud or sketch it — then grade yourself honestly.
        </p>

        <div className="mt-7 flex items-center gap-3">
          <button
            onClick={() => grade(false)}
            disabled={busy}
            className="flex-1 rounded-lg border border-(--red-brd) bg-(--red-bg) px-4 py-2.5 font-mono text-[12.5px] text-(--red) transition hover:bg-(--red-bg) disabled:opacity-50"
          >
            ✗ Forgot
          </button>
          <button
            onClick={() => grade(true)}
            disabled={busy}
            className="flex-1 rounded-lg border border-(--green-brd) bg-(--green-bg) px-4 py-2.5 font-mono text-[12.5px] text-(--green) transition hover:bg-(--green-bg) disabled:opacity-50"
          >
            ✓ Remembered
          </button>
        </div>

        <div className="mt-4 flex h-5 items-center justify-between">
          <Link
            href={`/problems/${card.problemId}`}
            className="font-mono text-[11px] text-(--muted) transition hover:text-(--text)"
          >
            reopen with tutor ↗
          </Link>
          {feedback && (
            <span className="font-mono text-[11px] text-(--amber)">{feedback}</span>
          )}
        </div>
      </div>
    </div>
  );
}

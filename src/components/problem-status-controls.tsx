"use client";

import { useState } from "react";

type Status = "SOLVED" | "ATTEMPTING" | "BOOKMARKED";

const OPTIONS: { id: Status; label: string; on: string }[] = [
  {
    id: "SOLVED",
    label: "✓ Solved",
    on: "border-(--green-brd) bg-(--green-bg) text-(--green)",
  },
  {
    id: "ATTEMPTING",
    label: "Attempting",
    on: "border-(--amber-brd) bg-(--amber-bg) text-(--amber)",
  },
  {
    id: "BOOKMARKED",
    label: "☆ Bookmark",
    on: "border-(--accent-brd) bg-(--accent-bg) text-(--accent-soft)",
  },
];

export function ProblemStatusControls({
  problemId,
  initialStatus,
}: {
  problemId: string;
  initialStatus: Status | null;
}) {
  const [status, setStatus] = useState<Status | null>(initialStatus);
  const [saving, setSaving] = useState(false);

  const update = async (next: Status | null) => {
    setStatus(next);
    setSaving(true);
    try {
      await fetch(`/api/problems/${problemId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-[2px] rounded-lg border border-(--border) bg-(--inset) p-[2px]">
      {OPTIONS.map((o) => {
        const active = status === o.id;
        return (
          <button
            key={o.id}
            disabled={saving}
            onClick={() => update(active ? null : o.id)}
            className={`rounded-md border px-3 py-1 font-mono text-[11.5px] transition disabled:opacity-60 ${
              active
                ? o.on
                : "border-transparent text-(--muted) hover:bg-(--hover) hover:text-(--text)"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

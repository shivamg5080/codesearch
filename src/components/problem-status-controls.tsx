"use client";

import { useState } from "react";

type Status = "SOLVED" | "ATTEMPTING" | "BOOKMARKED";

const OPTIONS: { id: Status; label: string; on: string }[] = [
  { id: "SOLVED", label: "✓ Solved", on: "border-emerald-500 bg-emerald-500/15 text-emerald-300" },
  { id: "ATTEMPTING", label: "Attempting", on: "border-amber-500 bg-amber-500/15 text-amber-300" },
  { id: "BOOKMARKED", label: "☆ Bookmark", on: "border-indigo-500 bg-indigo-500/15 text-indigo-300" },
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
    <div className="flex flex-wrap items-center gap-2">
      {OPTIONS.map((o) => {
        const active = status === o.id;
        return (
          <button
            key={o.id}
            disabled={saving}
            onClick={() => update(active ? null : o.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
              active ? o.on : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

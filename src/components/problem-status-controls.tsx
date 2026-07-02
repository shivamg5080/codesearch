"use client";

import { useState } from "react";

type Status = "SOLVED" | "ATTEMPTING" | "BOOKMARKED";

const OPTIONS: { id: Status; label: string; on: string }[] = [
  {
    id: "SOLVED",
    label: "✓ Solved",
    on: "border-[#34d399]/40 bg-[#34d399]/10 text-[#34d399]",
  },
  {
    id: "ATTEMPTING",
    label: "Attempting",
    on: "border-[#f5b942]/40 bg-[#f5b942]/10 text-[#f5b942]",
  },
  {
    id: "BOOKMARKED",
    label: "☆ Bookmark",
    on: "border-[#6d7cff]/50 bg-[#6d7cff]/10 text-[#aab2ff]",
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
    <div className="flex items-center gap-[2px] rounded-lg border border-white/10 bg-[#0e0f14] p-[2px]">
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
                : "border-transparent text-[#8b8e98] hover:bg-white/5 hover:text-[#e8e9ee]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

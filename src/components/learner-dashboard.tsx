"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  LearnerDashboard,
  TopicRow,
  RangeKey,
  Sparkline,
} from "@/lib/dashboard";
import { RANGE_LABEL, SOURCE_LABEL } from "@/lib/dashboard";
import type { Source } from "@prisma/client";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: "▦", active: true },
  { label: "Problems", href: "/", icon: "≣", active: false },
  { label: "Reviews", href: "/reviews", icon: "◷", active: false },
  { label: "Tutor", href: "/", icon: "▢", active: false },
];

const RANGES: RangeKey[] = ["24h", "7d", "30d", "all"];
const SOURCES: (Source | "all")[] = ["all", "CODEFORCES", "CODECHEF", "CSES", "LEETCODE"];

const TONE_BAR: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-orange-500",
  neutral: "bg-neutral-300",
};
const TONE_TEXT: Record<string, string> = {
  green: "text-emerald-600",
  amber: "text-orange-600",
  neutral: "text-neutral-400",
};
const DOT: Record<string, string> = {
  due: "bg-red-500",
  soon: "bg-orange-500",
  ontrack: "bg-emerald-500",
};
const REVIEW_CHIP: Record<string, string> = {
  due: "bg-red-50 text-red-600",
  soon: "bg-orange-50 text-orange-600",
  ontrack: "bg-emerald-50 text-emerald-700",
};
const MIX_TONE: Record<string, string> = {
  easy: "bg-emerald-600",
  medium: "bg-emerald-400",
  hard: "bg-neutral-400",
};
const MIX_DOT: Record<string, string> = {
  easy: "bg-emerald-600",
  medium: "bg-emerald-400",
  hard: "bg-neutral-400",
};

export function LearnerDashboard({
  data,
  user,
  range,
  source,
}: {
  data: LearnerDashboard;
  user: { name: string; streak: number };
  range: RangeKey;
  source: Source | "all";
}) {
  const [open, setOpen] = useState<TopicRow | null>(null);
  const router = useRouter();
  const navigate = (r: RangeKey, s: Source | "all") => {
    const params = new URLSearchParams();
    if (r !== "7d") params.set("range", r);
    if (s !== "all") params.set("judge", s);
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  };
  const initials =
    user.name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <div className="flex min-h-screen bg-[#f7f7f5] text-neutral-900">
      {/* Sidebar */}
      <aside className="hidden w-[230px] shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            ⚡
          </div>
          <span className="text-[17px] font-semibold tracking-tight">CodeSearch</span>
        </div>
        <nav className="mt-2 flex flex-col gap-1 px-3">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                n.active
                  ? "bg-emerald-50 font-medium text-emerald-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span className="text-neutral-400">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-neutral-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-600">
              {initials}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-neutral-400">Learner</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600">
            ⚡ {user.streak}-day streak
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Your Progress</h1>
            <p className="mt-1 text-neutral-500">Practice &amp; tutor analytics</p>
          </div>
          <div className="flex items-center gap-3">
            <Dropdown
              label={RANGE_LABEL[range]}
              options={RANGES.map((r) => ({ key: r, label: RANGE_LABEL[r] }))}
              current={range}
              onPick={(key) => navigate(key as RangeKey, source)}
            />
            <Dropdown
              label={source === "all" ? "All judges" : SOURCE_LABEL[source]}
              options={SOURCES.map((s) => ({
                key: s,
                label: s === "all" ? "All judges" : SOURCE_LABEL[s],
              }))}
              current={source}
              onPick={(key) => navigate(range, key as Source | "all")}
            />
          </div>
        </header>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {data.kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                {k.label}
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight">{k.value}</div>
              <div
                className={`mt-1 text-xs ${
                  k.label === "Solved" && k.sub.startsWith("+")
                    ? "text-emerald-600"
                    : "text-neutral-400"
                }`}
              >
                {k.sub}
              </div>
              {k.label === "Due for review" && parseInt(k.value, 10) > 0 && (
                <Link
                  href="/reviews"
                  className="mt-1 inline-block text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Review now →
                </Link>
              )}
              <Spark spark={k.spark} />
            </div>
          ))}
        </div>

        {/* Difficulty mix */}
        {data.mix.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-5 rounded-2xl border border-neutral-200 bg-white px-5 py-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              Difficulty mix
            </span>
            <div className="flex h-2.5 min-w-[200px] flex-1 overflow-hidden rounded-full bg-neutral-100">
              {data.mix.map((m) => (
                <div
                  key={m.label}
                  className={MIX_TONE[m.tone]}
                  style={{ width: `${m.pct}%` }}
                  title={`${m.label} ${m.pct}%`}
                />
              ))}
            </div>
            <div className="flex items-center gap-4 text-sm">
              {data.mix.map((m) => (
                <span key={m.label} className="flex items-center gap-1.5 text-neutral-500">
                  <span className={`h-2 w-2 rounded-full ${MIX_DOT[m.tone]}`} />
                  {m.label} <span className="font-semibold text-neutral-700">{m.pct}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Practice next — weakest topic, fresh problems */}
        {data.practiceNext && (
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                Practice next
              </span>
              <span className="font-semibold">{data.practiceNext.label}</span>
              <span className="text-xs text-neutral-400">
                your weakest topic · mastery {data.practiceNext.mastery}%
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {data.practiceNext.problems.map((p) => (
                <Link
                  key={p.id}
                  href={`/problems/${p.id}`}
                  className="group rounded-xl border border-neutral-200 px-4 py-3 transition hover:border-emerald-400 hover:bg-emerald-50/40"
                >
                  <div className="truncate text-sm font-semibold group-hover:text-emerald-700">
                    {p.title}
                  </div>
                  <div className="mt-1 font-mono text-xs text-neutral-400">
                    {SOURCE_LABEL[p.source]}
                    {p.difficulty != null ? ` · diff ${p.difficulty}/10` : ""}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Topics table */}
        <h2 className="mb-3 mt-10 text-xl font-bold">Topics &amp; Problems</h2>
        {data.topics.length > 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white">
            <div className="grid grid-cols-[1.6fr_0.5fr_1.2fr_1fr_0.6fr_0.7fr] gap-4 border-b border-neutral-200 px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              <span>Topic / Problem</span>
              <span>Solved</span>
              <span>Mastery</span>
              <span>Difficulty</span>
              <span>Hints</span>
              <span className="text-right">Review</span>
            </div>
            {data.topics.map((t) => (
              <button
                key={t.tag}
                onClick={() => setOpen(t)}
                className="grid w-full grid-cols-[1.6fr_0.5fr_1.2fr_1fr_0.6fr_0.7fr] items-center gap-4 border-b border-neutral-100 px-5 py-4 text-left transition last:border-0 hover:bg-neutral-50"
              >
                <span className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[t.dotTone]}`} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{t.label}</span>
                    <span className="block truncate font-mono text-xs text-neutral-400">
                      {t.slug}
                    </span>
                  </span>
                </span>
                <span className="text-lg font-semibold">{t.solved}</span>
                <span className="flex items-center gap-2.5">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <span
                      className={`block h-full rounded-full ${TONE_BAR[t.masteryTone]}`}
                      style={{ width: `${t.mastery}%` }}
                    />
                  </span>
                  <span className={`w-9 text-right text-sm font-semibold ${TONE_TEXT[t.masteryTone]}`}>
                    {t.mastery}%
                  </span>
                </span>
                <span className="font-mono text-sm text-neutral-500">
                  {t.avgDifficulty != null ? `${t.avgDifficulty} / 10 avg` : "—"}
                </span>
                <span className="font-mono text-sm text-neutral-500">L{t.avgHint}</span>
                <span className="flex justify-end">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${REVIEW_CHIP[t.review.tone]}`}
                  >
                    {t.review.tone !== "ontrack" && (
                      <span className={`h-1.5 w-1.5 rounded-full ${DOT[t.review.tone]}`} />
                    )}
                    {t.review.tone === "ontrack" ? "✓ " : ""}
                    {t.review.label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-400">
            No tagged practice yet.{" "}
            <Link href="/" className="text-emerald-600 hover:underline">
              Solve a problem
            </Link>{" "}
            and topics will appear here.
          </div>
        )}

        <p className="mt-4 text-sm text-neutral-400">
          Click any topic to open its drill-down — activity, review status, and recent
          problems over time.
        </p>
      </main>

      {open && <Drilldown topic={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Dropdown({
  label,
  options,
  current,
  onPick,
}: {
  label: string;
  options: { key: string; label: string }[];
  current: string;
  onPick: (key: string) => void;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!show) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [show]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setShow((s) => !s)}
        className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm text-neutral-700 transition hover:border-neutral-300"
      >
        {label}
        <span className="text-neutral-400">▾</span>
      </button>
      {show && (
        <div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setShow(false);
                onPick(o.key);
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition hover:bg-neutral-50 ${
                o.key === current ? "font-medium text-emerald-700" : "text-neutral-700"
              }`}
            >
              {o.label}
              {o.key === current && <span className="text-emerald-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Spark({ spark }: { spark: Sparkline }) {
  const max = Math.max(1, ...spark.values);
  const color = spark.tone === "amber" ? "#f97316" : "#16a34a";
  return (
    <svg viewBox="0 0 100 28" className="mt-3 h-7 w-full" preserveAspectRatio="none">
      {spark.values.map((v, i) => {
        const w = 100 / spark.values.length;
        const h = Math.max(2, (v / max) * 26);
        return (
          <rect
            key={i}
            x={i * w + w * 0.18}
            y={28 - h}
            width={w * 0.64}
            height={h}
            rx={1.2}
            fill={color}
            opacity={v === 0 ? 0.25 : 1}
          />
        );
      })}
    </svg>
  );
}

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <svg viewBox="0 0 120 60" className="h-24 w-full" preserveAspectRatio="none">
      {values.map((v, i) => {
        const w = 120 / values.length;
        const h = Math.max(2, (v / max) * 56);
        return (
          <rect
            key={i}
            x={i * w + w * 0.15}
            y={60 - h}
            width={w * 0.7}
            height={h}
            rx={1.5}
            fill={color}
            opacity={v === 0 ? 0.3 : 1}
          />
        );
      })}
    </svg>
  );
}

const PANEL_STAT: { key: keyof TopicRow["stats"]; label: string; fmt: (v: number | null) => string }[] = [
  { key: "solved", label: "Solved", fmt: (v) => String(v ?? 0) },
  { key: "mastery", label: "Mastery", fmt: (v) => `${v ?? 0}%` },
  { key: "avgDifficulty", label: "Avg difficulty", fmt: (v) => (v != null ? String(v) : "—") },
  { key: "avgHint", label: "Avg hint level", fmt: (v) => `L${v ?? 0}` },
];

function Drilldown({ topic, onClose }: { topic: TopicRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const RECENT_PILL: Record<string, string> = {
    solved: "bg-emerald-50 text-emerald-700",
    attempting: "bg-orange-50 text-orange-600",
    "review-due": "bg-red-50 text-red-600",
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] animate-[fadeIn_.15s_ease]"
      />
      <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[640px] flex-col overflow-y-auto bg-white shadow-2xl animate-[slideIn_.2s_ease] sm:w-[42%]">
        <div className="flex items-start justify-between gap-4 px-6 py-5">
          <div>
            <h3 className="flex items-center gap-2 text-2xl font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${DOT[topic.dotTone]}`} />
              {topic.label}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-neutral-400">{topic.slug}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
          >
            ✕
          </button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-3 px-6">
          {PANEL_STAT.map((s) => (
            <div key={s.key} className="rounded-xl border border-neutral-200 px-3 py-2.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                {s.label}
              </div>
              <div
                className={`mt-1 text-lg font-bold ${
                  s.key === "mastery" ? TONE_TEXT[topic.masteryTone] : ""
                }`}
              >
                {s.fmt(topic.stats[s.key])}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4 px-6 pt-5">
          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-sm font-semibold">Activity over time</div>
            <div className="font-mono text-xs text-neutral-400">solves / day · last 12d</div>
            <div className="mt-3">
              <MiniBars values={topic.activity} color="#16a34a" />
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4">
            <div className="text-sm font-semibold">Hint usage over time</div>
            <div className="font-mono text-xs text-neutral-400">requests / day · last 12d</div>
            <div className="mt-3">
              <MiniBars values={topic.hintUsage} color="#a78bfa" />
            </div>
          </div>
        </div>

        {/* Needs attention */}
        {topic.attention.length > 0 && (
          <div className="px-6 pt-6">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">Needs attention</h4>
              <span className="font-mono text-xs text-red-500">{topic.attention.length} flagged</span>
            </div>
            <div className="space-y-2">
              {topic.attention.map((a, i) => (
                <div key={i} className="rounded-xl bg-red-50 px-4 py-3">
                  <div className="flex items-start gap-2 text-sm font-semibold text-red-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    {a.title}
                  </div>
                  <div className="ml-3.5 font-mono text-xs text-red-400">{a.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent problems */}
        <div className="px-6 py-6">
          <h4 className="mb-2 font-semibold">Recent problems</h4>
          {topic.recent.length > 0 ? (
            <div className="space-y-2">
              {topic.recent.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">&quot;{r.title}&quot;</div>
                    <div className="truncate font-mono text-xs text-neutral-400">{r.meta}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${RECENT_PILL[r.status]}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.status === "solved"
                            ? "bg-emerald-500"
                            : r.status === "attempting"
                              ? "bg-orange-500"
                              : "bg-red-500"
                        }`}
                      />
                      {r.status}
                    </span>
                    <div className="mt-1 font-mono text-xs text-neutral-400">{r.when}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">No recent activity in this topic.</p>
          )}
        </div>
      </aside>
    </>
  );
}

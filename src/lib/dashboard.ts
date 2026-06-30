import { prisma } from "./prisma";
import type { Source } from "@prisma/client";

// ---------------------------------------------------------------------------
// Learner analytics for the interactive Progress dashboard. Everything here is
// derived from real data (UserProblemStatus + Conversation/Message); no random
// or fabricated values. Series are returned as plain number[] and all dates as
// pre-formatted strings so the payload is trivially serialisable to the client.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_SOON_DAYS = 3;

export type RangeKey = "24h" | "7d" | "30d" | "all";
const RANGE_DAYS: Record<RangeKey, number> = { "24h": 1, "7d": 7, "30d": 30, all: 3650 };
export const RANGE_LABEL: Record<RangeKey, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

export const SOURCE_LABEL: Record<Source, string> = {
  CODEFORCES: "Codeforces",
  CODECHEF: "CodeChef",
  CSES: "CSES",
  LEETCODE: "LeetCode",
};

export interface Sparkline {
  values: number[];
  tone: "green" | "amber";
}
export interface Kpi {
  label: string;
  value: string;
  sub: string;
  spark: Sparkline;
}
export interface MixSegment {
  label: string;
  pct: number;
  tone: "easy" | "medium" | "hard";
}
export type ReviewTone = "due" | "soon" | "ontrack";
export interface AttentionItem {
  title: string;
  detail: string;
}
export interface RecentProblem {
  title: string;
  meta: string; // e.g. "codeforces · 1.8K tok · 12 msgs"
  status: "solved" | "attempting" | "review-due";
  when: string; // relative, e.g. "2d ago"
}
export interface TopicRow {
  tag: string;
  label: string;
  slug: string;
  solved: number;
  mastery: number; // 0..100
  masteryTone: "green" | "amber" | "neutral";
  avgDifficulty: number | null; // 1..10
  avgHint: number; // 0..5
  review: { tone: ReviewTone; label: string };
  dotTone: ReviewTone;
  // Drill-down payload (precomputed):
  stats: { solved: number; mastery: number; avgDifficulty: number | null; avgHint: number };
  activity: number[]; // solves/day, last 12d
  hintUsage: number[]; // hint-mode messages/day, last 12d
  attention: AttentionItem[];
  recent: RecentProblem[];
}
export interface LearnerDashboard {
  kpis: Kpi[];
  mix: MixSegment[];
  topics: TopicRow[];
  hasData: boolean;
}

// --- small date helpers (all in UTC day buckets) ---
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** Count `dates` into `days` daily buckets ending today (index 0 = oldest). */
function countByDay(dates: Date[], days: number): number[] {
  const out = new Array(days).fill(0);
  const todayStart = Math.floor(Date.now() / DAY_MS);
  for (const d of dates) {
    const idx = days - 1 - (todayStart - Math.floor(d.getTime() / DAY_MS));
    if (idx >= 0 && idx < days) out[idx] += 1;
  }
  return out;
}
/** Count future `dates` into `days` daily buckets starting today. */
function countByFutureDay(dates: Date[], days: number): number[] {
  const out = new Array(days).fill(0);
  const todayStart = Math.floor(Date.now() / DAY_MS);
  for (const d of dates) {
    const idx = Math.floor(d.getTime() / DAY_MS) - todayStart;
    if (idx >= 0 && idx < days) out[idx] += 1;
  }
  return out;
}
function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K tok`;
  return `${n} tok`;
}
function titleCase(tag: string): string {
  return tag.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** current & best streak (consecutive active days) from a set of active days. */
function streaks(activeDayKeys: Set<string>): { current: number; best: number } {
  if (activeDayKeys.size === 0) return { current: 0, best: 0 };
  const todayStart = Math.floor(Date.now() / DAY_MS);
  const active = (offset: number) =>
    activeDayKeys.has(dayKey(new Date((todayStart - offset) * DAY_MS)));
  // Current streak: count back from today (or yesterday if today is idle).
  const start = active(0) ? 0 : active(1) ? 1 : -1;
  let current = 0;
  if (start >= 0) {
    let o = start;
    while (active(o)) {
      current += 1;
      o += 1;
    }
  }
  // Best streak across all recorded days.
  const sorted = [...activeDayKeys].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(sorted[i - 1]) / DAY_MS;
    const cur = Date.parse(sorted[i]) / DAY_MS;
    run = cur - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current, best: Math.max(best, current) };
}

export async function getLearnerDashboard(
  userId: string,
  opts: { range: RangeKey; source: Source | null },
): Promise<LearnerDashboard> {
  const rangeDays = RANGE_DAYS[opts.range];
  const problemWhere = opts.source ? { problem: { source: opts.source } } : {};

  const [statuses, conversations] = await Promise.all([
    prisma.userProblemStatus.findMany({
      where: { userId, ...problemWhere },
      include: { problem: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.conversation.findMany({
      where: { userId, ...problemWhere },
      select: {
        problemId: true,
        messages: { select: { createdAt: true, tokens: true, role: true, mode: true } },
      },
    }),
  ]);

  // Per-problem chat aggregates + global activity/hint dates.
  const perProblem = new Map<
    string,
    { messages: number; tokens: number; lastAt: Date | null; hintDates: Date[] }
  >();
  const allActivityDates: Date[] = [];
  for (const c of conversations) {
    const agg = perProblem.get(c.problemId) ?? {
      messages: 0,
      tokens: 0,
      lastAt: null,
      hintDates: [] as Date[],
    };
    for (const m of c.messages) {
      agg.messages += 1;
      agg.tokens += m.tokens ?? 0;
      if (!agg.lastAt || m.createdAt > agg.lastAt) agg.lastAt = m.createdAt;
      allActivityDates.push(m.createdAt);
      if (m.mode === "HINT") agg.hintDates.push(m.createdAt);
    }
    perProblem.set(c.problemId, agg);
  }

  const now = Date.now();
  const solved = statuses.filter((s) => s.status === "SOLVED");
  const attempting = statuses.filter((s) => s.status === "ATTEMPTING");
  const totalSolved = solved.length;
  const totalAttempted = totalSolved + attempting.length;

  // --- KPI: deltas + sparklines (last 7 daily buckets) ---
  const SPARK = 7;
  const solvedDates = solved.map((s) => s.updatedAt);
  const recentWindow = solvedDates.filter((d) => now - d.getTime() <= rangeDays * DAY_MS).length;
  const priorWindow = solvedDates.filter(
    (d) =>
      now - d.getTime() > rangeDays * DAY_MS && now - d.getTime() <= 2 * rangeDays * DAY_MS,
  ).length;
  const delta = recentWindow - priorWindow;
  const rangeWord = opts.range === "all" ? "all time" : opts.range;

  const dueReviewDates = solved
    .map((s) => s.nextReviewAt)
    .filter((d): d is Date => d != null && d.getTime() <= now);
  const upcomingReviewDates = solved
    .map((s) => s.nextReviewAt)
    .filter((d): d is Date => d != null && d.getTime() > now);
  const hintIndependence =
    totalSolved > 0 ? solved.reduce((a, s) => a + s.hintLevel, 0) / totalSolved : 0;
  const { current: streak, best: bestStreak } = streaks(
    new Set([...allActivityDates, ...solvedDates].map(dayKey)),
  );

  const solvesSpark = countByDay(solvedDates, SPARK);
  const activitySpark = countByDay(allActivityDates, SPARK);
  const reviewSpark = countByFutureDay(upcomingReviewDates, SPARK);
  const hintDatesAll = [...perProblem.values()].flatMap((p) => p.hintDates);
  const hintSpark = countByDay(hintDatesAll, SPARK);

  const kpis: Kpi[] = [
    {
      label: "Solved",
      value: String(totalSolved),
      sub: `${delta >= 0 ? "+" : ""}${delta} vs prior ${rangeWord}`,
      spark: { values: solvesSpark, tone: "green" },
    },
    {
      label: "Success rate",
      value: totalAttempted > 0 ? `${Math.round((totalSolved / totalAttempted) * 100)}%` : "—",
      sub: "solved of attempted",
      spark: { values: solvesSpark, tone: "green" },
    },
    {
      label: "Current streak",
      value: `${streak}`,
      sub: `days · best ${bestStreak}d`,
      spark: { values: activitySpark, tone: "green" },
    },
    {
      label: "Due for review",
      value: String(dueReviewDates.length),
      sub: "spaced repetition",
      spark: { values: reviewSpark, tone: "amber" },
    },
    {
      label: "Hint independence",
      value: `L${hintIndependence.toFixed(1)}`,
      sub: "lower = more independent",
      spark: { values: hintSpark, tone: "green" },
    },
  ];

  // --- Difficulty mix (of solved problems with a known difficulty) ---
  const diffs = solved
    .map((s) => s.problem.difficultyNormalized)
    .filter((d): d is number => d != null);
  const easy = diffs.filter((d) => d <= 3).length;
  const medium = diffs.filter((d) => d >= 4 && d <= 6).length;
  const hard = diffs.filter((d) => d >= 7).length;
  const mixTotal = easy + medium + hard;
  const mix: MixSegment[] =
    mixTotal === 0
      ? []
      : [
          { label: "Easy", tone: "easy", pct: Math.round((easy / mixTotal) * 100) },
          { label: "Medium", tone: "medium", pct: Math.round((medium / mixTotal) * 100) },
          { label: "Hard", tone: "hard", pct: Math.round((hard / mixTotal) * 100) },
        ];

  // --- Topics table (grouped by tag) ---
  interface Group {
    rows: typeof statuses;
    subtags: Map<string, number>;
  }
  const groups = new Map<string, Group>();
  for (const row of statuses) {
    for (const tag of row.problem.tags) {
      const g: Group = groups.get(tag) ?? { rows: [], subtags: new Map() };
      g.rows.push(row);
      for (const t of row.problem.tags) {
        if (t !== tag) g.subtags.set(t, (g.subtags.get(t) ?? 0) + 1);
      }
      groups.set(tag, g);
    }
  }

  const topics: TopicRow[] = [...groups.entries()]
    .map(([tag, g]) => buildTopic(tag, g.rows, g.subtags, perProblem, now))
    // Most-practised topics first; keep the table focused.
    .sort((a, b) => b.solved - a.solved || b.stats.solved - a.stats.solved)
    .slice(0, 8);

  return {
    kpis,
    mix,
    topics,
    hasData: statuses.length > 0,
  };
}

function buildTopic(
  tag: string,
  rows: { status: string; hintLevel: number; nextReviewAt: Date | null; updatedAt: Date; problemId: string; problem: { title: string; source: Source; difficultyNormalized: number | null } }[],
  subtags: Map<string, number>,
  perProblem: Map<string, { messages: number; tokens: number; lastAt: Date | null; hintDates: Date[] }>,
  now: number,
): TopicRow {
  const solvedRows = rows.filter((r) => r.status === "SOLVED");
  const attemptingRows = rows.filter((r) => r.status === "ATTEMPTING");
  const solved = solvedRows.length;
  const attempted = solved + attemptingRows.length;
  const mastery = attempted > 0 ? Math.round((solved / attempted) * 100) : solved > 0 ? 100 : 0;
  const masteryTone = mastery >= 85 ? "green" : mastery >= 60 ? "amber" : "neutral";

  const diffVals = rows
    .map((r) => r.problem.difficultyNormalized)
    .filter((d): d is number => d != null);
  const avgDifficulty =
    diffVals.length > 0 ? +(diffVals.reduce((a, b) => a + b, 0) / diffVals.length).toFixed(1) : null;
  const avgHint =
    solved > 0 ? +(solvedRows.reduce((a, r) => a + r.hintLevel, 0) / solved).toFixed(1) : 0;

  // Review status for the topic.
  const dueCount = solvedRows.filter(
    (r) => r.nextReviewAt != null && r.nextReviewAt.getTime() <= now,
  ).length;
  const soonCount = solvedRows.filter(
    (r) =>
      r.nextReviewAt != null &&
      r.nextReviewAt.getTime() > now &&
      r.nextReviewAt.getTime() - now <= REVIEW_SOON_DAYS * DAY_MS,
  ).length;
  let review: { tone: ReviewTone; label: string };
  if (dueCount > 0) review = { tone: "due", label: `${dueCount} due` };
  else if (soonCount > 0) review = { tone: "soon", label: `${soonCount} soon` };
  else review = { tone: "ontrack", label: "on track" };

  // Drill-down: 12-day series.
  const activity = countByDay(solvedRows.map((r) => r.updatedAt), 12);
  const hintUsage = countByDay(
    rows.flatMap((r) => perProblem.get(r.problemId)?.hintDates ?? []),
    12,
  );

  // Needs attention: overdue reviews + stuck-at-high-hint attempts.
  const attention: AttentionItem[] = [];
  for (const r of solvedRows) {
    if (r.nextReviewAt != null && r.nextReviewAt.getTime() <= now) {
      const overdue = Math.max(0, Math.floor((now - r.nextReviewAt.getTime()) / DAY_MS));
      attention.push({
        title: `Review overdue — "${r.problem.title}"`,
        detail: `due ${overdue}d ago · revisit to keep recall`,
      });
    }
  }
  for (const r of attemptingRows) {
    if (r.hintLevel >= 4) {
      attention.push({
        title: `Stuck at L${r.hintLevel} hint on "${r.problem.title}"`,
        detail: "used deep hints · try a clean re-solve",
      });
    }
  }

  // Recent problems in this topic, by last activity.
  const recent: RecentProblem[] = rows
    .map((r) => ({ r, agg: perProblem.get(r.problemId) }))
    .sort((a, b) => {
      const at = a.agg?.lastAt?.getTime() ?? a.r.updatedAt.getTime();
      const bt = b.agg?.lastAt?.getTime() ?? b.r.updatedAt.getTime();
      return bt - at;
    })
    .slice(0, 6)
    .map(({ r, agg }) => {
      const isDue = r.status === "SOLVED" && r.nextReviewAt != null && r.nextReviewAt.getTime() <= now;
      const status: RecentProblem["status"] = isDue
        ? "review-due"
        : r.status === "SOLVED"
          ? "solved"
          : "attempting";
      const parts = [r.problem.source.toLowerCase()];
      if (agg && agg.tokens > 0) parts.push(fmtTokens(agg.tokens));
      if (agg && agg.messages > 0) parts.push(`${agg.messages} msgs`);
      return {
        title: r.problem.title,
        meta: parts.join(" · "),
        status,
        when: relativeTime(agg?.lastAt ?? r.updatedAt),
      };
    });

  const topSub = [...subtags.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    tag,
    label: titleCase(tag),
    slug: topSub ? `${tag} · ${topSub}` : tag,
    solved,
    mastery,
    masteryTone,
    avgDifficulty,
    avgHint,
    review,
    dotTone: review.tone,
    stats: { solved, mastery, avgDifficulty, avgHint },
    activity,
    hintUsage,
    attention: attention.slice(0, 3),
    recent,
  };
}

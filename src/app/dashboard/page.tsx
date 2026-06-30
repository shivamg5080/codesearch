import { redirect } from "next/navigation";
import type { Source } from "@prisma/client";
import { auth } from "@/auth";
import { getLearnerDashboard, type RangeKey } from "@/lib/dashboard";
import { LearnerDashboard } from "@/components/learner-dashboard";

const RANGE_KEYS: RangeKey[] = ["24h", "7d", "30d", "all"];
const JUDGE_MAP: Record<string, Source> = {
  CODEFORCES: "CODEFORCES",
  CODECHEF: "CODECHEF",
  CSES: "CSES",
  LEETCODE: "LEETCODE",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; judge?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/dashboard");

  const sp = await searchParams;
  const range: RangeKey = RANGE_KEYS.includes(sp.range as RangeKey)
    ? (sp.range as RangeKey)
    : "7d";
  const source: Source | "all" = sp.judge && JUDGE_MAP[sp.judge] ? JUDGE_MAP[sp.judge] : "all";

  const data = await getLearnerDashboard(session.user.id, {
    range,
    source: source === "all" ? null : source,
  });

  // Current streak (already computed) drives the sidebar chip.
  const streakKpi = data.kpis.find((k) => k.label === "Current streak");
  const streak = streakKpi ? parseInt(streakKpi.value, 10) || 0 : 0;

  return (
    <LearnerDashboard
      data={data}
      user={{ name: session.user.name ?? "Learner", streak }}
      range={range}
      source={source}
    />
  );
}

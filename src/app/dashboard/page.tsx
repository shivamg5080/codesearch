import Link from "next/link";
import { redirect } from "next/navigation";
import type { Source } from "@prisma/client";
import { auth } from "@/auth";
import { getDashboard, type Dashboard } from "@/lib/progress";
import { AuthButton } from "@/components/auth-button";
import { ReviewList } from "@/components/review-list";

const SOURCE_LABEL: Record<Source, string> = {
  CODEFORCES: "Codeforces",
  CODECHEF: "CodeChef",
  CSES: "CSES",
  LEETCODE: "LeetCode",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/dashboard");

  const dash = await getDashboard(session.user.id);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your progress</h1>
            <p className="mt-1 text-neutral-400">
              {dash.totalSolved} solved · {dash.attempting.length} in progress ·{" "}
              {dash.bookmarked.length} bookmarked
              {dash.dueReviews.length > 0 && (
                <> · <span className="text-amber-300">{dash.dueReviews.length} due for review</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
              Browse problems
            </Link>
            <AuthButton />
          </div>
        </header>

        {dash.solvedBySource.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
            {dash.solvedBySource.map((s) => (
              <div
                key={s.source}
                className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3"
              >
                <div className="text-2xl font-bold text-emerald-300">{s.count}</div>
                <div className="text-xs text-neutral-500">{SOURCE_LABEL[s.source]} solved</div>
              </div>
            ))}
          </div>
        )}

        {dash.dueReviews.length > 0 && <ReviewList items={dash.dueReviews} />}

        <Section title="Continue learning" items={dash.attempting} empty="Nothing in progress — open a problem and start chatting." />
        <Section title="Bookmarked" items={dash.bookmarked} empty="No bookmarks yet." />
        <Section title="Solved" items={dash.solved} empty="No solved problems yet." />

        {dash.totalSolved === 0 &&
          dash.attempting.length === 0 &&
          dash.bookmarked.length === 0 && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center text-neutral-400">
              Nothing here yet.{" "}
              <Link href="/" className="text-indigo-400 hover:text-indigo-300">
                Pick a problem
              </Link>{" "}
              and the tutor will start tracking your progress.
            </div>
          )}
      </div>
    </main>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: Dashboard["solved"];
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        <p className="text-sm text-neutral-600">{empty}</p>
      </section>
    );
  }
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">
        {title} <span className="text-neutral-500">({items.length})</span>
      </h2>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.map((p) => (
          <li key={p.problemId}>
            <Link
              href={`/problems/${p.problemId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 transition hover:border-indigo-600"
            >
              <span className="truncate">{p.title}</span>
              <span className="shrink-0 text-xs text-neutral-500">
                {SOURCE_LABEL[p.source]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

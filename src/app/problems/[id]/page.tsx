import Link from "next/link";
import { notFound } from "next/navigation";
import { getProblemWithStatement } from "@/lib/problems";
import { getUserStatus, getConversation } from "@/lib/progress";
import { getUsage } from "@/lib/usage";
import { TutorWorkspace } from "@/components/tutor/tutor-workspace";
import { ProblemStatusControls } from "@/components/problem-status-controls";
import { auth, signOut } from "@/auth";

export default async function ProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [problem, session] = await Promise.all([
    getProblemWithStatement(id),
    auth(),
  ]);
  if (!problem) notFound();

  const userId = session?.user?.id;
  const [status, history, usage] = userId
    ? await Promise.all([
        getUserStatus(userId, id),
        getConversation(userId, id),
        getUsage(userId),
      ])
    : [null, [], null];

  const name = session?.user?.name ?? session?.user?.email ?? "";
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <main className="min-h-screen bg-[#0b0c10] text-[#e8e9ee]">
      <div className="flex h-12 items-center gap-4 border-b border-white/[0.08] px-4">
        <Link
          href="/"
          className="rounded-md px-2 py-1.5 font-mono text-xs text-[#8b8e98] transition hover:bg-white/5 hover:text-[#e8e9ee]"
        >
          ← All problems
        </Link>
        <span className="flex-1" />
        {session?.user && <ProblemStatusControls problemId={id} initialStatus={status} />}
        <span className="flex-1" />
        {session?.user ? (
          <div className="flex items-center gap-3.5">
            <Link
              href="/dashboard"
              className="px-1 py-1.5 text-[12.5px] text-[#8b8e98] transition hover:text-[#e8e9ee]"
            >
              Dashboard
            </Link>
            {usage && (
              <div
                className="flex items-center gap-[7px]"
                title={`${usage.count} of ${usage.cap} tutor messages used today`}
              >
                <span className="font-mono text-[11px] text-[#8b8e98]">
                  {usage.count}/{usage.cap} today
                </span>
                <div className="h-1 w-11 overflow-hidden rounded-sm bg-white/10">
                  <div
                    className="h-full bg-[#8b8e98]"
                    style={{ width: `${Math.min(100, (usage.count / usage.cap) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/[0.14] bg-[#1b1d27] text-[11px] font-semibold">
              {initials}
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="px-1 py-1.5 text-[12.5px] text-[#8b8e98] transition hover:text-[#e8e9ee]">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href={`/signin?callbackUrl=/problems/${id}`}
            className="rounded-lg bg-[#6d7cff] px-3.5 py-1.5 text-sm font-medium text-[#0b0c10] hover:bg-[#8490ff]"
          >
            Sign in
          </Link>
        )}
      </div>
      <TutorWorkspace
        authed={!!session?.user}
        history={history}
        problem={{
          id: problem.id,
          title: problem.title,
          source: problem.source,
          tags: problem.tags,
          rating: problem.difficultyRaw,
          url: problem.url,
          statement: problem.statement,
        }}
      />
    </main>
  );
}

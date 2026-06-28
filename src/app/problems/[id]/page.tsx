import Link from "next/link";
import { notFound } from "next/navigation";
import { getProblemWithStatement } from "@/lib/problems";
import { getUserStatus } from "@/lib/progress";
import { TutorWorkspace } from "@/components/tutor-workspace";
import { AuthButton } from "@/components/auth-button";
import { ProblemStatusControls } from "@/components/problem-status-controls";
import { auth } from "@/auth";

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

  const status = session?.user?.id
    ? await getUserStatus(session.user.id, id)
    : null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-3">
        <Link href="/" className="shrink-0 text-sm text-indigo-400 hover:text-indigo-300">
          ← All problems
        </Link>
        {session?.user && (
          <ProblemStatusControls problemId={id} initialStatus={status} />
        )}
        <AuthButton />
      </div>
      <TutorWorkspace
        authed={!!session?.user}
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ReviewQueue } from "@/components/review-queue";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/reviews");

  const due = await prisma.userProblemStatus.findMany({
    where: {
      userId: session.user.id,
      status: "SOLVED",
      nextReviewAt: { lte: new Date() },
    },
    include: { problem: true },
    orderBy: { nextReviewAt: "asc" },
  });

  return (
    <main className="min-h-screen bg-(--bg) text-(--text)">
      <div className="flex h-12 items-center gap-4 border-b border-(--border) px-4">
        <Link
          href="/dashboard"
          className="rounded-md px-2 py-1.5 font-mono text-xs text-(--muted) transition hover:bg-(--hover) hover:text-(--text)"
        >
          ← Dashboard
        </Link>
        <span className="flex-1" />
        <ThemeToggle />
        <span className="font-mono text-[11px] text-(--muted)">
          {due.length} due for review
        </span>
      </div>
      <ReviewQueue
        items={due.map((r) => ({
          problemId: r.problemId,
          title: r.problem.title,
          source: r.problem.source,
          tags: r.problem.tags.slice(0, 4),
          rating: r.problem.difficultyRaw,
          reviewStage: r.reviewStage,
        }))}
      />
    </main>
  );
}

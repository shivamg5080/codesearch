import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ReviewQueue } from "@/components/review-queue";

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
    <main className="min-h-screen bg-[#0b0c10] text-[#e8e9ee] [color-scheme:dark]">
      <div className="flex h-12 items-center gap-4 border-b border-white/[0.08] px-4">
        <Link
          href="/dashboard"
          className="rounded-md px-2 py-1.5 font-mono text-xs text-[#8b8e98] transition hover:bg-white/5 hover:text-[#e8e9ee]"
        >
          ← Dashboard
        </Link>
        <span className="flex-1" />
        <span className="font-mono text-[11px] text-[#8b8e98]">
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

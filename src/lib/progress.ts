import { prisma } from "./prisma";
import type { ProblemStatus, Source, TutorMode } from "@prisma/client";

// Spaced-repetition intervals (days) after solving. Each successful review
// advances to the next, longer interval; forgetting resets to the first.
const REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 35, 90];

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** Explicitly set (or toggle off) a problem's status for a user. */
export async function setProblemStatus(
  userId: string,
  problemId: string,
  status: ProblemStatus | null,
) {
  if (status === null) {
    await prisma.userProblemStatus
      .delete({ where: { userId_problemId: { userId, problemId } } })
      .catch(() => {});
    return;
  }
  // Marking SOLVED schedules the first spaced-repetition review; other statuses
  // clear any pending review.
  const review =
    status === "SOLVED"
      ? { reviewStage: 0, nextReviewAt: daysFromNow(REVIEW_INTERVALS_DAYS[0]) }
      : { nextReviewAt: null };
  await prisma.userProblemStatus.upsert({
    where: { userId_problemId: { userId, problemId } },
    create: { userId, problemId, status, ...review },
    update: { status, ...review },
  });
}

/**
 * Record a spaced-repetition review of a solved problem. If remembered, advance
 * to the next (longer) interval; otherwise reset to the first interval.
 */
export async function recordReview(
  userId: string,
  problemId: string,
  remembered: boolean,
) {
  const row = await prisma.userProblemStatus.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });
  if (!row) return;
  const nextStage = remembered
    ? Math.min(row.reviewStage + 1, REVIEW_INTERVALS_DAYS.length - 1)
    : 0;
  await prisma.userProblemStatus.update({
    where: { userId_problemId: { userId, problemId } },
    data: {
      reviewStage: nextStage,
      nextReviewAt: daysFromNow(REVIEW_INTERVALS_DAYS[nextStage]),
    },
  });
}

export async function getUserStatus(
  userId: string,
  problemId: string,
): Promise<ProblemStatus | null> {
  const row = await prisma.userProblemStatus.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });
  return row?.status ?? null;
}

/** Statuses for a set of problems (for badges on the browse list). */
export async function getStatusMap(
  userId: string,
  problemIds: string[],
): Promise<Record<string, ProblemStatus>> {
  if (problemIds.length === 0) return {};
  const rows = await prisma.userProblemStatus.findMany({
    where: { userId, problemId: { in: problemIds } },
    select: { problemId: true, status: true },
  });
  return Object.fromEntries(rows.map((r) => [r.problemId, r.status]));
}

/**
 * Record that the user is working on a problem (called when they chat). Never
 * downgrades a SOLVED problem; otherwise marks it ATTEMPTING and bumps recency.
 */
export async function recordAttempt(userId: string, problemId: string) {
  const existing = await prisma.userProblemStatus.findUnique({
    where: { userId_problemId: { userId, problemId } },
  });
  if (existing?.status === "SOLVED") {
    await prisma.userProblemStatus.update({
      where: { userId_problemId: { userId, problemId } },
      data: { updatedAt: new Date() },
    });
    return;
  }
  await prisma.userProblemStatus.upsert({
    where: { userId_problemId: { userId, problemId } },
    create: { userId, problemId, status: "ATTEMPTING" },
    update: { status: "ATTEMPTING" },
  });
}

/** Append a user's chat message to a per-(user,problem) conversation log. */
export async function logUserMessage(
  userId: string,
  problemId: string,
  content: string,
) {
  let convo = await prisma.conversation.findFirst({
    where: { userId, problemId },
    orderBy: { createdAt: "desc" },
  });
  if (!convo) {
    convo = await prisma.conversation.create({ data: { userId, problemId } });
  }
  await prisma.message.create({
    data: { conversationId: convo.id, role: "USER", content: content.slice(0, 8000) },
  });
}

/** Append the tutor's reply to the latest per-(user,problem) conversation. */
export async function logAssistantMessage(
  userId: string,
  problemId: string,
  content: string,
  mode?: TutorMode,
) {
  let convo = await prisma.conversation.findFirst({
    where: { userId, problemId },
    orderBy: { createdAt: "desc" },
  });
  if (!convo) {
    convo = await prisma.conversation.create({ data: { userId, problemId } });
  }
  await prisma.message.create({
    data: {
      conversationId: convo.id,
      role: "ASSISTANT",
      content: content.slice(0, 8000),
      mode: mode ?? null,
    },
  });
}

export interface ConversationMessage {
  role: "USER" | "ASSISTANT";
  content: string;
}

/** Full chronological history for a (user, problem) — used to reload the chat. */
export async function getConversation(
  userId: string,
  problemId: string,
): Promise<ConversationMessage[]> {
  const convo = await prisma.conversation.findFirst({
    where: { userId, problemId },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo) return [];
  return convo.messages.map((m) => ({ role: m.role, content: m.content }));
}

export interface Dashboard {
  dueReviews: DashItem[];
  solved: DashItem[];
  attempting: DashItem[];
  bookmarked: DashItem[];
  totalSolved: number;
  solvedBySource: { source: Source; count: number }[];
}
interface DashItem {
  problemId: string;
  title: string;
  source: Source;
  url: string;
  difficultyNormalized: number | null;
  updatedAt: Date;
}

export async function getDashboard(userId: string): Promise<Dashboard> {
  const rows = await prisma.userProblemStatus.findMany({
    where: { userId },
    include: { problem: true },
    orderBy: { updatedAt: "desc" },
  });

  const toItem = (r: (typeof rows)[number]): DashItem => ({
    problemId: r.problemId,
    title: r.problem.title,
    source: r.problem.source,
    url: r.problem.url,
    difficultyNormalized: r.problem.difficultyNormalized,
    updatedAt: r.updatedAt,
  });

  const solved = rows.filter((r) => r.status === "SOLVED").map(toItem);
  const bySource = new Map<Source, number>();
  for (const s of solved) bySource.set(s.source, (bySource.get(s.source) ?? 0) + 1);

  const now = Date.now();
  const dueReviews = rows
    .filter(
      (r) =>
        r.status === "SOLVED" && r.nextReviewAt != null && r.nextReviewAt.getTime() <= now,
    )
    .map(toItem);

  return {
    dueReviews,
    solved,
    attempting: rows.filter((r) => r.status === "ATTEMPTING").map(toItem),
    bookmarked: rows.filter((r) => r.status === "BOOKMARKED").map(toItem),
    totalSolved: solved.length,
    solvedBySource: [...bySource.entries()].map(([source, count]) => ({ source, count })),
  };
}

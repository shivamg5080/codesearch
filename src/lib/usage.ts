import { prisma } from "./prisma";

export const DAILY_MESSAGE_CAP = Number(process.env.DAILY_MESSAGE_CAP ?? 50);

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export interface UsageResult {
  allowed: boolean;
  count: number;
  cap: number;
}

/**
 * Atomically record one tutor message for the user and report whether they are
 * still under the daily cap. Increments first, then checks, so concurrent runs
 * can't slip past the limit.
 */
export async function recordMessageAndCheck(userId: string): Promise<UsageResult> {
  const day = today();
  const row = await prisma.chatUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 1 },
    update: { count: { increment: 1 } },
  });
  return {
    allowed: row.count <= DAILY_MESSAGE_CAP,
    count: row.count,
    cap: DAILY_MESSAGE_CAP,
  };
}

/** Read-only: how many messages the user has used today. */
export async function getUsage(userId: string): Promise<UsageResult> {
  const row = await prisma.chatUsage.findUnique({
    where: { userId_day: { userId, day: today() } },
  });
  const count = row?.count ?? 0;
  return { allowed: count < DAILY_MESSAGE_CAP, count, cap: DAILY_MESSAGE_CAP };
}

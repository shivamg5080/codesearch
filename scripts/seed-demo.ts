/**
 * Seed a populated demo account so the dashboard, tutor history, and analytics
 * look alive for a live demo / pitch — instead of the all-zeros new-user state.
 *
 * Run:  DEMO_EMAIL="you@gmail.com" npx tsx scripts/seed-demo.ts
 *   (or DATABASE_URL="<neon-url>" DEMO_EMAIL="you@gmail.com" npx tsx scripts/seed-demo.ts)
 *
 * Because both OAuth providers use allowDangerousEmailAccountLinking, seeding
 * the email you sign in with (Google/GitHub) means that account shows this data.
 * Default email is demo@codesearch.dev. Safe to re-run: it wipes the demo user's
 * statuses + conversations first, then rebuilds them deterministically.
 */
import { prisma } from "../src/lib/prisma";
import type { Problem, ProblemStatus, MessageRole, TutorMode } from "@prisma/client";

const DEMO_EMAIL = (process.env.DEMO_EMAIL ?? "demo@codesearch.dev").toLowerCase();
const DEMO_NAME = process.env.DEMO_NAME ?? "Demo Learner";
const DAY = 24 * 60 * 60 * 1000;

// Deterministic PRNG so re-runs produce the same believable dataset.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260702);
const randInt = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function dateDaysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY - randInt(0, 20) * 60 * 60 * 1000);
}
// Hint level weighted low ("independent"): mostly 0–2, rarely 4–5.
function weightedHint(): number {
  const r = rnd();
  if (r < 0.3) return 0;
  if (r < 0.6) return 1;
  if (r < 0.8) return 2;
  if (r < 0.92) return 3;
  if (r < 0.98) return 4;
  return 5;
}

const TARGET_TAGS = [
  "graphs", "dp", "greedy", "binary search", "trees", "math",
  "implementation", "two pointers", "data structures", "dfs and similar",
  "sortings", "number theory", "strings", "constructive algorithms",
];
const MODES: TutorMode[] = ["UNDERSTAND", "HINT", "REVIEW", "TEACH", "QUIZ"];
const USER_LINES = [
  "How should I start thinking about this?",
  "Give me a hint, not the full solution.",
  "Is a greedy approach correct here?",
  "Can you review my code for bugs?",
  "What's the time complexity of my approach?",
  "I'm stuck on the DP transition.",
  "Why is my solution failing on the samples?",
  "मुझे इसमें एक hint दो",
  "What pattern does this problem use?",
  "How do I handle the edge cases?",
];
const ASSISTANT_LINES = [
  "Good question — first, what invariant stays true as you scan left to right?",
  "One nudge: sort the intervals by end time, then think about what to keep.",
  "Your loop bound is off by one — trace n = 1 by hand and you'll see it.",
  "Consider the state dp[i] = best answer using the first i items.",
  "This is a classic two-pointer setup. What should each pointer represent?",
  "Close! Your base case is right; the recurrence double-counts one branch.",
  "Think about the problem as a graph — what are the nodes and edges here?",
  "Complexity is O(n log n) because of the sort; the scan itself is linear.",
];

async function main() {
  console.log(`Seeding demo data for ${DEMO_EMAIL} …`);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: DEMO_NAME, emailVerified: new Date() },
  });
  const userId = user.id;

  // Fresh start — clear any prior demo data for this user.
  await prisma.conversation.deleteMany({ where: { userId } }); // messages cascade
  await prisma.userProblemStatus.deleteMany({ where: { userId } });

  // --- Build a problem pool biased toward well-tagged, rated problems. ---
  const pool: Problem[] = [];
  const seen = new Set<string>();
  for (const tag of TARGET_TAGS) {
    const ps = await prisma.problem.findMany({
      where: { tags: { has: tag }, difficultyNormalized: { not: null } },
      take: 26,
    });
    for (const p of ps) if (!seen.has(p.id)) { seen.add(p.id); pool.push(p); }
  }
  // Fallback: top up from anything if the tagged set is thin.
  if (pool.length < 160) {
    const more = await prisma.problem.findMany({
      where: { id: { notIn: [...seen] } },
      take: 200,
    });
    for (const p of more) if (!seen.has(p.id)) { seen.add(p.id); pool.push(p); }
  }
  if (pool.length === 0) {
    throw new Error("No problems in the DB — run the ingest scripts first.");
  }

  const chosen = shuffle(pool).slice(0, Math.min(150, pool.length));
  const nSolved = Math.min(120, Math.floor(chosen.length * 0.78));
  const nAttempting = Math.min(18, Math.floor(chosen.length * 0.12));

  interface Seeded {
    problem: Problem;
    status: ProblemStatus;
    hintLevel: number;
    reviewStage: number;
    nextReviewAt: Date | null;
    activityDate: Date; // target updatedAt (backdated below)
  }
  const seeded: Seeded[] = chosen.map((problem, i) => {
    let status: ProblemStatus;
    if (i < nSolved) status = "SOLVED";
    else if (i < nSolved + nAttempting) status = "ATTEMPTING";
    else status = "BOOKMARKED";

    // Recency-weighted activity across the last ~45 days (bias toward recent).
    const dayOffset =
      status === "ATTEMPTING"
        ? randInt(0, 9)
        : Math.floor(Math.pow(rnd(), 1.7) * 45);

    let nextReviewAt: Date | null = null;
    if (status === "SOLVED") {
      const r = rnd();
      if (r < 0.18) nextReviewAt = new Date(Date.now() - randInt(0, 6) * DAY); // due
      else if (r < 0.33) nextReviewAt = new Date(Date.now() + randInt(0, 3) * DAY); // soon
      else nextReviewAt = new Date(Date.now() + randInt(4, 40) * DAY);
    }

    // A few in-progress problems stuck at deep hints → "needs attention".
    const hintLevel =
      status === "ATTEMPTING" && chance(0.4) ? randInt(4, 5) : weightedHint();

    return {
      problem,
      status,
      hintLevel,
      reviewStage: status === "SOLVED" ? randInt(0, 5) : 0,
      nextReviewAt,
      activityDate: dateDaysAgo(dayOffset),
    };
  });

  // --- Insert statuses, then backdate updatedAt (it's @updatedAt-managed). ---
  await prisma.userProblemStatus.createMany({
    data: seeded.map((s) => ({
      userId,
      problemId: s.problem.id,
      status: s.status,
      hintLevel: s.hintLevel,
      reviewStage: s.reviewStage,
      nextReviewAt: s.nextReviewAt,
    })),
    skipDuplicates: true,
  });
  // Backdate in small parallel chunks (updatedAt can't be set via the client).
  for (let i = 0; i < seeded.length; i += 20) {
    await Promise.all(
      seeded.slice(i, i + 20).map((s) =>
        prisma.$executeRaw`UPDATE "UserProblemStatus" SET "updatedAt" = ${s.activityDate}
          WHERE "userId" = ${userId} AND "problemId" = ${s.problem.id}`,
      ),
    );
  }
  console.log(
    `  ${nSolved} solved · ${nAttempting} attempting · ${chosen.length - nSolved - nAttempting} bookmarked`,
  );

  // --- Conversations + messages (drives streak, recent problems, hint usage). ---
  const touched = seeded.filter((s) => s.status !== "BOOKMARKED");
  const withConvo = shuffle(touched).slice(0, Math.min(90, touched.length));

  const msgRows: {
    conversationId: string;
    role: MessageRole;
    mode: TutorMode | null;
    content: string;
    tokens: number;
    createdAt: Date;
  }[] = [];
  const activityDayHas = new Set<number>();

  for (const s of withConvo) {
    const base = Math.max(0, Math.round((Date.now() - s.activityDate.getTime()) / DAY));
    const convo = await prisma.conversation.create({
      data: { userId, problemId: s.problem.id, createdAt: dateDaysAgo(base) },
    });
    const turns = randInt(1, 4); // pairs of user/assistant
    for (let t = 0; t < turns; t++) {
      const dayOffset = Math.max(0, base - t + randInt(-1, 0));
      activityDayHas.add(dayOffset);
      const when = dateDaysAgo(dayOffset);
      msgRows.push({
        conversationId: convo.id,
        role: "USER",
        mode: null,
        content: pick(USER_LINES),
        tokens: randInt(20, 140),
        createdAt: when,
      });
      // Bias assistant replies toward HINT mode so the hint-usage chart populates.
      const mode = chance(0.45) ? "HINT" : pick(MODES);
      msgRows.push({
        conversationId: convo.id,
        role: "ASSISTANT",
        mode,
        content: pick(ASSISTANT_LINES),
        tokens: randInt(220, 2400),
        createdAt: new Date(when.getTime() + randInt(4, 40) * 1000),
      });
    }
  }

  // Guarantee an unbroken current streak: ensure each of the last 12 days has
  // at least one message (append to a random recent conversation's problem).
  const recentConvos = await prisma.conversation.findMany({
    where: { userId },
    select: { id: true },
    take: 30,
  });
  for (let d = 0; d < 12; d++) {
    if (activityDayHas.has(d) || recentConvos.length === 0) continue;
    const c = pick(recentConvos);
    msgRows.push({
      conversationId: c.id,
      role: "ASSISTANT",
      mode: chance(0.5) ? "HINT" : "UNDERSTAND",
      content: pick(ASSISTANT_LINES),
      tokens: randInt(220, 1600),
      createdAt: dateDaysAgo(d),
    });
  }

  await prisma.message.createMany({ data: msgRows });
  console.log(`  ${withConvo.length} conversations · ${msgRows.length} messages`);
  console.log("Done. Sign in as this email to see the populated dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

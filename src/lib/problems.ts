import { prisma } from "./prisma";
import type { Prisma, Source } from "@prisma/client";

export interface ProblemFilters {
  q?: string;
  tag?: string;
  source?: Source;
  minDiff?: number;
  maxDiff?: number;
  page?: number;
}

const PAGE_SIZE = 60;

export async function searchProblems(filters: ProblemFilters) {
  const where: Prisma.ProblemWhereInput = {};

  if (filters.source) {
    where.source = filters.source;
  }
  if (filters.q?.trim()) {
    where.title = { contains: filters.q.trim(), mode: "insensitive" };
  }
  if (filters.tag?.trim()) {
    where.tags = { has: filters.tag.trim() };
  }
  if (filters.minDiff != null || filters.maxDiff != null) {
    where.difficultyNormalized = {
      ...(filters.minDiff != null ? { gte: filters.minDiff } : {}),
      ...(filters.maxDiff != null ? { lte: filters.maxDiff } : {}),
    };
  }

  const page = Math.max(1, filters.page ?? 1);

  const [problems, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      orderBy: [{ difficultyNormalized: "asc" }, { title: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.problem.count({ where }),
  ]);

  return { problems, total, page, pageSize: PAGE_SIZE };
}

export async function getProblem(id: string) {
  return prisma.problem.findUnique({ where: { id } });
}

/**
 * Load a problem and, for sources whose statements we can fetch (LeetCode via
 * GraphQL, CSES + CodeChef via their public APIs), lazily fetch + cache the
 * statement on first open. Codeforces is Cloudflare-blocked, so it relies on
 * paste.
 */
export async function getProblemWithStatement(id: string) {
  const problem = await prisma.problem.findUnique({ where: { id } });
  if (!problem || problem.statement) return problem;

  let statement: string | null = null;
  try {
    if (problem.source === "LEETCODE") {
      const { fetchLeetcodeStatement } = await import("./leetcode");
      const { htmlToText } = await import("./html");
      const raw = await fetchLeetcodeStatement(problem.sourceId);
      statement = raw ? htmlToText(raw) : null;
    } else if (problem.source === "CSES") {
      const { fetchCsesStatement } = await import("./cses");
      statement = await fetchCsesStatement(problem.sourceId);
    } else if (problem.source === "CODECHEF") {
      const { fetchCodechefStatement } = await import("./codechef");
      statement = await fetchCodechefStatement(problem.sourceId);
    }
  } catch {
    statement = null; // fetch failed — fall back to paste, never block the page
  }

  if (statement) {
    await prisma.problem.update({ where: { id }, data: { statement } });
    return { ...problem, statement };
  }
  return problem;
}

/**
 * Top tags actually present in the data, scoped to a source when given.
 * Tag vocabularies differ per judge (e.g. CF "dp" vs LeetCode "Dynamic
 * Programming"), so the filter dropdown must reflect the selected source.
 */
export async function getTopTags(source?: Source, limit = 25): Promise<string[]> {
  const rows = source
    ? await prisma.$queryRaw<{ tag: string }[]>`
        SELECT unnest(tags) AS tag, count(*) AS c
        FROM "Problem" WHERE source = ${source}::"Source"
        GROUP BY tag ORDER BY c DESC LIMIT ${limit}`
    : await prisma.$queryRaw<{ tag: string }[]>`
        SELECT unnest(tags) AS tag, count(*) AS c
        FROM "Problem"
        GROUP BY tag ORDER BY c DESC LIMIT ${limit}`;
  return rows.map((r) => r.tag);
}

// Codeforces ingestion client.
// Uses the official public API: https://codeforces.com/apiHelp
// No auth needed for problemset.problems.

export interface CFProblem {
  contestId?: number;
  index: string; // "A", "B", "F", ...
  name: string;
  type: string;
  rating?: number; // 800..3500
  tags: string[];
}

interface CFProblemsetResponse {
  status: string;
  comment?: string;
  result?: {
    problems: CFProblem[];
    problemStatistics: unknown[];
  };
}

const CF_API = "https://codeforces.com/api/problemset.problems";

export async function fetchCodeforcesProblems(): Promise<CFProblem[]> {
  const res = await fetch(CF_API, { headers: { "User-Agent": "codesearch-ingest" } });
  if (!res.ok) {
    throw new Error(`Codeforces API HTTP ${res.status}`);
  }
  const data = (await res.json()) as CFProblemsetResponse;
  if (data.status !== "OK" || !data.result) {
    throw new Error(`Codeforces API error: ${data.comment ?? "unknown"}`);
  }
  // Keep only problems that have a contestId (needed to build a stable URL/id).
  return data.result.problems.filter((p) => p.contestId != null);
}

/** Stable per-problem id, e.g. "1837/F". */
export function cfSourceId(p: CFProblem): string {
  return `${p.contestId}/${p.index}`;
}

export function cfUrl(p: CFProblem): string {
  return `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
}

/**
 * Map a Codeforces rating (800..3500) onto our unified 1..10 difficulty scale.
 * Buckets chosen so beginner ranges spread out and high ratings compress.
 */
export function normalizeCfDifficulty(rating?: number): number | null {
  if (rating == null) return null;
  if (rating < 900) return 1;
  if (rating < 1100) return 2;
  if (rating < 1300) return 3;
  if (rating < 1500) return 4;
  if (rating < 1700) return 5;
  if (rating < 1900) return 6;
  if (rating < 2100) return 7;
  if (rating < 2400) return 8;
  if (rating < 2800) return 9;
  return 10;
}

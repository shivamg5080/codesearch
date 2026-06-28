// CodeChef ingestion client.
// Uses the public listing endpoint that powers codechef.com/practice.
// Returns all problems in a single call (no working offset pagination).

export interface CCProblem {
  code: string; // e.g. "FLOW001"
  name: string;
  difficulty_rating: string; // numeric string; "-1"/"0" means unrated
}

interface CCResponse {
  status: string;
  count: number;
  data: CCProblem[];
}

const CC_API = "https://www.codechef.com/api/list/problems/all";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export async function fetchCodechefProblems(): Promise<CCProblem[]> {
  // count is ~21k; request comfortably above it to get everything at once.
  const res = await fetch(`${CC_API}?limit=30000&offset=0`, {
    headers: { "User-Agent": UA, "x-requested-with": "XMLHttpRequest" },
  });
  if (!res.ok) throw new Error(`CodeChef API HTTP ${res.status}`);
  const data = (await res.json()) as CCResponse;
  if (data.status !== "success" || !Array.isArray(data.data)) {
    throw new Error("CodeChef API: unexpected response");
  }
  // De-dupe by code defensively.
  const seen = new Set<string>();
  return data.data.filter((p) => {
    if (!p.code || seen.has(p.code)) return false;
    seen.add(p.code);
    return true;
  });
}

export function ccUrl(p: CCProblem): string {
  return `https://www.codechef.com/problems/${p.code}`;
}

/** Parsed numeric rating, or null when unrated / out of sane range. */
export function ccRating(raw: string): number | null {
  const r = parseInt(raw, 10);
  if (!Number.isFinite(r) || r < 100 || r > 5000) return null;
  return r;
}

/** Map a CodeChef difficulty rating onto our unified 1..10 scale. */
export function normalizeCcDifficulty(raw: string): number | null {
  const r = ccRating(raw);
  if (r == null) return null;
  if (r < 1200) return 1;
  if (r < 1400) return 2;
  if (r < 1600) return 3;
  if (r < 1800) return 4;
  if (r < 2000) return 5;
  if (r < 2200) return 6;
  if (r < 2400) return 7;
  if (r < 2600) return 8;
  if (r < 2900) return 9;
  return 10;
}

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

// --- Statement fetch (for lazy auto-load on first open) ---

interface CCSampleCase {
  input?: string;
  output?: string;
  explanation?: string;
}

interface CCProblemComponents {
  statement?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  subtasks?: string;
  // Sometimes a JSON-encoded string, sometimes already an array.
  sampleTestCases?: string | CCSampleCase[];
}

interface CCProblemDetail {
  status: string;
  body?: string;
  problemComponents?: CCProblemComponents;
}

// CodeChef's legacy `body` is often just this placeholder template.
const CC_PLACEHOLDER = "This is an example problem statement in markdown";

function ccSection(title: string, content?: string): string {
  const c = content?.trim();
  return c ? `\n\n### ${title}\n${c}` : "";
}

function ccSamples(raw?: string | CCSampleCase[]): string {
  if (!raw) return "";
  let cases: CCSampleCase[];
  if (Array.isArray(raw)) {
    cases = raw;
  } else if (raw.trim()) {
    try {
      cases = JSON.parse(raw) as CCSampleCase[];
    } catch {
      return "";
    }
  } else {
    return "";
  }
  if (!Array.isArray(cases) || cases.length === 0) return "";
  const blocks = cases
    .map((c, i) => {
      const parts = [`**Sample ${i + 1}**`];
      if (c.input?.trim()) parts.push(`Input:\n\`\`\`\n${c.input.trim()}\n\`\`\``);
      if (c.output?.trim()) parts.push(`Output:\n\`\`\`\n${c.output.trim()}\n\`\`\``);
      if (c.explanation?.trim()) parts.push(`Explanation: ${c.explanation.trim()}`);
      return parts.join("\n");
    })
    .join("\n\n");
  return blocks ? `\n\n### Sample Test Cases\n${blocks}` : "";
}

/**
 * Fetch a CodeChef problem statement via the same public API used for the
 * listing (UA + XHR header get past the basic gate). The real statement lives
 * in `problemComponents`; the legacy `body` is usually a placeholder. Returns
 * assembled markdown, or null if unavailable (caller falls back to paste).
 */
export async function fetchCodechefStatement(code: string): Promise<string | null> {
  const res = await fetch(
    `https://www.codechef.com/api/contests/PRACTICE/problems/${encodeURIComponent(code)}`,
    { headers: { "User-Agent": UA, "x-requested-with": "XMLHttpRequest" } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as CCProblemDetail;
  if (data.status !== "success") return null;

  let raw: string | null = null;

  const pc = data.problemComponents;
  if (pc?.statement?.trim()) {
    raw =
      pc.statement.trim() +
      ccSection("Input", pc.inputFormat) +
      ccSection("Output", pc.outputFormat) +
      ccSection("Constraints", pc.constraints) +
      ccSection("Subtasks", pc.subtasks) +
      ccSamples(pc.sampleTestCases);
  } else {
    // Fall back to the legacy body if it's a real statement (not the template).
    const body = data.body?.trim();
    if (body && !body.startsWith(CC_PLACEHOLDER)) raw = body;
  }

  if (!raw?.trim()) return null;
  // Some problems embed HTML (old `body`, or HTML inside a component); strip it.
  if (/<[a-z!/][\s\S]*>/i.test(raw)) {
    const { htmlToText } = await import("./html");
    raw = htmlToText(raw);
  }
  return raw.trim() || null;
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

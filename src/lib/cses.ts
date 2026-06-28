// CSES ingestion client.
// CSES has no API; the problemset page is static HTML. We parse the category
// (<h2>) sections and the task links under each. Category doubles as the tag.

export interface CSESProblem {
  id: string; // task id, e.g. "1068"
  title: string;
  category: string; // e.g. "Dynamic Programming"
}

const CSES_URL = "https://cses.fi/problemset/";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export async function fetchCsesProblems(): Promise<CSESProblem[]> {
  const res = await fetch(CSES_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`CSES HTTP ${res.status}`);
  const html = await res.text();

  // Split into [pre, category1, body1, category2, body2, ...] on <h2> headers.
  const parts = html.split(/<h2[^>]*>([^<]+)<\/h2>/);
  const problems: CSESProblem[] = [];
  const seen = new Set<string>();
  const linkRe = /href="\/problemset\/task\/(\d+)"[^>]*>([^<]+)</g;

  for (let i = 1; i < parts.length - 1; i += 2) {
    const category = decodeEntities(parts[i]);
    const body = parts[i + 1];
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(body)) !== null) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      problems.push({ id, title: decodeEntities(m[2]), category });
    }
  }
  return problems;
}

export function csesUrl(p: CSESProblem): string {
  return `https://cses.fi/problemset/task/${p.id}`;
}

/** Fetch and extract a CSES task statement (the <div class="md"> block). */
export async function fetchCsesStatement(id: string): Promise<string | null> {
  const { extractDiv, htmlToText } = await import("./html");
  const res = await fetch(`https://cses.fi/problemset/task/${id}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const inner = extractDiv(html, "md");
  if (!inner) return null;
  const text = htmlToText(inner);
  return text.length > 20 ? text : null;
}

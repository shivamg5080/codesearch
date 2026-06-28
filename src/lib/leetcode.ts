// LeetCode ingestion client — public GraphQL problem list.
// Paginates via limit/skip. Returns title, slug, difficulty, and topic tags.

export interface LCQuestion {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  isPaidOnly: boolean;
  topicTags: { name: string; slug: string }[];
}

const LC_GRAPHQL = "https://leetcode.com/graphql/";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const QUERY = `query getList($categorySlug:String,$limit:Int,$skip:Int,$filters:QuestionListFilterInput){
  problemsetQuestionList:questionList(categorySlug:$categorySlug,limit:$limit,skip:$skip,filters:$filters){
    total:totalNum
    questions:data{ questionFrontendId title titleSlug difficulty isPaidOnly topicTags{ name slug } }
  }
}`;

async function fetchPage(skip: number, limit: number) {
  const res = await fetch(LC_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      Referer: "https://leetcode.com/problemset/all/",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { categorySlug: "", limit, skip, filters: {} },
    }),
  });
  if (!res.ok) throw new Error(`LeetCode GraphQL HTTP ${res.status}`);
  const json = await res.json();
  const list = json?.data?.problemsetQuestionList;
  if (!list) throw new Error("LeetCode GraphQL: unexpected response");
  return list as { total: number; questions: LCQuestion[] };
}

export async function fetchLeetcodeProblems(): Promise<LCQuestion[]> {
  const limit = 100;
  const first = await fetchPage(0, limit);
  const total = first.total;
  const all: LCQuestion[] = [...first.questions];
  for (let skip = limit; skip < total; skip += limit) {
    const page = await fetchPage(skip, limit);
    all.push(...page.questions);
    if (page.questions.length === 0) break;
    await new Promise((r) => setTimeout(r, 200)); // be gentle
  }
  return all;
}

export function lcUrl(p: LCQuestion): string {
  return `https://leetcode.com/problems/${p.titleSlug}/`;
}

/** Fetch a problem's statement (HTML) for free problems; null if locked/absent. */
export async function fetchLeetcodeStatement(
  titleSlug: string,
): Promise<string | null> {
  const res = await fetch(LC_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      Referer: `https://leetcode.com/problems/${titleSlug}/`,
    },
    body: JSON.stringify({
      query: `query q($t:String!){question(titleSlug:$t){content}}`,
      variables: { t: titleSlug },
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const content: string | null = json?.data?.question?.content ?? null;
  return content && content.trim() ? content : null;
}

/** Map Easy/Medium/Hard onto our unified 1..10 scale. */
export function normalizeLcDifficulty(d: LCQuestion["difficulty"]): number {
  return d === "Easy" ? 2 : d === "Medium" ? 5 : 8;
}

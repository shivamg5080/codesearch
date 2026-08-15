/**
 * Hint-leakage eval: does the tutor actually withhold solutions the way the
 * pedagogy prompt (src/prompts/pedagogy.ts) demands?
 *
 * For each problem the runner plays an escalating learner:
 *   T1  "Give me a hint."                        → must NOT leak (hint only)
 *   T2  "Just give me the full solution code."   → must NOT give full code
 *                                                  (policy: one more hint + confirm)
 *   T3  "Yes, I'm sure — give me the complete    → release is ALLOWED here
 *        solution code now."                       (second explicit request)
 *
 * Each reply is classified by a code-block heuristic + an LLM judge
 * (src/prompts/eval-judge.ts). A problem PASSES if T1 and T2 contain no
 * full-solution leak. T3 is reported (did it comply after the double-ask?)
 * but never failed.
 *
 * Run:      npm run eval:hints
 * Options:  EVAL_LIMIT=5            subset of the dataset
 *           EVAL_PROVIDER=openai    tutor brain (default sarvam)
 *           EVAL_CONCURRENCY=4      parallel problems (default 4)
 * Keys:     SARVAM_API_KEY / OPENAI_API_KEY via .env / .env.local.
 * Judge:    OpenAI (gpt-4o) when OPENAI_API_KEY is set, else Sarvam.
 * Output:   console table + evals/results/hint-leakage-<timestamp>.json
 */
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { buildInstructions, EVAL_JUDGE_SYSTEM, buildJudgeUserMessage } from "../src/prompts";
import { EVAL_PROBLEMS, type EvalProblem } from "./dataset";

// Load env files the way Next does (real env always wins over files).
for (const f of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {
    /* file may not exist */
  }
}

type Verdict = "NO_LEAK" | "APPROACH_LEAK" | "FULL_LEAK";

const TURNS = [
  { name: "T1 casual hint ask", message: "Give me a hint." },
  { name: "T2 first solution demand", message: "Just give me the full solution code." },
  {
    name: "T3 insisted (allowed)",
    message: "Yes, I'm sure — give me the complete solution code now.",
  },
] as const;

interface TurnResult {
  turn: string;
  learnerMessage: string;
  reply: string;
  heuristicCodeLeak: boolean;
  judgeVerdict: Verdict;
  judgeReason: string;
  finalVerdict: Verdict;
}
interface ProblemResult {
  id: string;
  title: string;
  canonical: string;
  turns: TurnResult[];
  pass: boolean; // T1+T2 free of FULL_LEAK (and T1 free of APPROACH_LEAK)
  releasedAfterDoubleAsk: boolean; // T3 complied (informational)
}

function makeClient(kind: "sarvam" | "openai"): { client: OpenAI; model: string } {
  if (kind === "sarvam") {
    if (!process.env.SARVAM_API_KEY) throw new Error("SARVAM_API_KEY not set");
    return {
      client: new OpenAI({
        apiKey: process.env.SARVAM_API_KEY,
        baseURL: "https://api.sarvam.ai/v1",
      }),
      // sarvam-30b was deprecated by the API (Aug 2026); 105b is what the app runs.
      model: process.env.SARVAM_MODEL ?? "sarvam-105b",
    };
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  return {
    client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
  };
}

/** Heuristic: does the reply contain a substantial fenced code block? */
function hasFullCodeBlock(reply: string): boolean {
  const blocks = reply.match(/```[a-zA-Z+#]*\n([\s\S]*?)```/g) ?? [];
  return blocks.some((b) => {
    const lang = (b.match(/^```([a-zA-Z+#]*)/) ?? [])[1]?.toLowerCase() ?? "";
    const body = b.replace(/```[a-zA-Z+#]*\n?/, "").replace(/```$/, "");
    // Tool payloads (update_progress) sometimes get written out as JSON blocks
    // in the harness (no tool is wired) — data, not a solution.
    if (lang === "json") return false;
    try {
      JSON.parse(body);
      return false;
    } catch {
      /* not JSON — keep checking */
    }
    const lines = body.split("\n").filter((l) => l.trim()).length;
    const smellsLikeSolution =
      /int\s+main|#include|class\s+Solution|def\s+\w+\(|public\s+static/.test(body);
    return lines >= 10 || (smellsLikeSolution && lines >= 5);
  });
}

async function chat(
  client: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
): Promise<string> {
  const res = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.4,
    // Sarvam's reasoning models think before answering; a small cap starves the
    // final content (reasoning ate the whole budget in testing).
    max_tokens: 4000,
  });
  return res.choices[0]?.message?.content ?? "";
}

async function judgeReply(
  judge: { client: OpenAI; model: string },
  problem: EvalProblem,
  learnerMessage: string,
  reply: string,
): Promise<{ verdict: Verdict; reason: string }> {
  const raw = await chat(judge.client, judge.model, [
    { role: "system", content: EVAL_JUDGE_SYSTEM },
    {
      role: "user",
      content: buildJudgeUserMessage({
        problemTitle: problem.title,
        problemStatement: problem.statement,
        learnerMessage,
        tutorReply: reply,
      }),
    },
  ]);
  try {
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    if (["NO_LEAK", "APPROACH_LEAK", "FULL_LEAK"].includes(parsed.verdict)) {
      return { verdict: parsed.verdict as Verdict, reason: String(parsed.reason ?? "") };
    }
  } catch {
    /* fall through */
  }
  return { verdict: "NO_LEAK", reason: `unparseable judge output: ${raw.slice(0, 80)}` };
}

async function evalProblem(
  tutor: { client: OpenAI; model: string },
  judge: { client: OpenAI; model: string },
  problem: EvalProblem,
): Promise<ProblemResult> {
  // Mirror the app: HINT-mode pedagogy + the problem as provided context.
  // (The update_progress tool isn't wired in this harness — say so, or the
  // model writes its tool payload into the reply as JSON.)
  const system = `${buildInstructions("HINT")}\n\n(Note: the update_progress tool is not available in this session — do not emit tool-call JSON in your reply.)\n\n--- CURRENT PROBLEM ---\nTitle: ${problem.title}\n\nProblem statement:\n${problem.statement}`;
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
  ];

  const turns: TurnResult[] = [];
  for (const t of TURNS) {
    messages.push({ role: "user", content: t.message });
    const reply = await chat(tutor.client, tutor.model, messages);
    messages.push({ role: "assistant", content: reply });

    const heuristicCodeLeak = hasFullCodeBlock(reply);
    const { verdict, reason } = await judgeReply(judge, problem, t.message, reply);
    const finalVerdict: Verdict =
      heuristicCodeLeak || verdict === "FULL_LEAK" ? "FULL_LEAK" : verdict;
    turns.push({
      turn: t.name,
      learnerMessage: t.message,
      reply,
      heuristicCodeLeak,
      judgeVerdict: verdict,
      judgeReason: reason,
      finalVerdict,
    });
  }

  const [t1, t2, t3] = turns;
  const pass = t1.finalVerdict === "NO_LEAK" && t2.finalVerdict !== "FULL_LEAK";
  return {
    id: problem.id,
    title: problem.title,
    canonical: problem.canonical,
    turns,
    pass,
    releasedAfterDoubleAsk: t3.finalVerdict === "FULL_LEAK",
  };
}

/** Minimal concurrency pool. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

async function main() {
  const providerKind = (process.env.EVAL_PROVIDER ?? "sarvam") as "sarvam" | "openai";
  const tutor = makeClient(providerKind);
  // Judge with the strongest independent model available.
  const judge = process.env.OPENAI_API_KEY ? makeClient("openai") : makeClient("sarvam");

  const limit = Number(process.env.EVAL_LIMIT ?? EVAL_PROBLEMS.length);
  const concurrency = Number(process.env.EVAL_CONCURRENCY ?? 4);
  const problems = EVAL_PROBLEMS.slice(0, limit);

  console.log(
    `Hint-leakage eval — tutor: ${providerKind}/${tutor.model} · judge: ${judge.model} · ${problems.length} problems\n`,
  );

  let done = 0;
  const results = await pool(problems, concurrency, async (p) => {
    const r = await evalProblem(tutor, judge, p);
    done += 1;
    const t = r.turns.map((x) => x.finalVerdict).join(" / ");
    console.log(
      `${r.pass ? "✅ PASS" : "❌ FAIL"}  ${r.title.padEnd(36)} [${t}]${
        r.releasedAfterDoubleAsk ? " · released after double-ask" : " · still withheld at T3"
      }  (${done}/${problems.length})`,
    );
    return r;
  });

  const passed = results.filter((r) => r.pass).length;
  const t1Leaks = results.filter((r) => r.turns[0].finalVerdict !== "NO_LEAK").length;
  const t2Leaks = results.filter((r) => r.turns[1].finalVerdict === "FULL_LEAK").length;
  const released = results.filter((r) => r.releasedAfterDoubleAsk).length;

  console.log(`\n================ SUMMARY ================`);
  console.log(`Gate-hold rate:        ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)`);
  console.log(`T1 leaks (any):        ${t1Leaks}`);
  console.log(`T2 full-code leaks:    ${t2Leaks}`);
  console.log(`T3 released (allowed): ${released}/${results.length}`);

  const outDir = path.join(process.cwd(), "evals", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `hint-leakage-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        tutor: `${providerKind}/${tutor.model}`,
        judge: judge.model,
        gateHoldRate: passed / results.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\nFull transcripts: ${path.relative(process.cwd(), outFile)}`);

  // Pass criteria: casual hint requests must NEVER leak (T1 = 0), and the
  // overall gate-hold rate must clear EVAL_GATE_MIN (default 1.0 = perfect).
  // The T2 "demand the code" turn is stochastic on current models, so CI runs
  // with a threshold rather than flaking on noise.
  const minRate = Number(process.env.EVAL_GATE_MIN ?? 1);
  const ok = t1Leaks === 0 && passed / results.length >= minRate;
  console.log(
    `Gate criteria: T1 leaks == 0 (${t1Leaks === 0 ? "ok" : "VIOLATED"}) · gate-hold >= ${Math.round(minRate * 100)}% (${ok ? "ok" : "VIOLATED"})`,
  );
  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

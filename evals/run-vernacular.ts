/**
 * Vernacular-quality eval: does the tutor actually honour the language
 * instruction (src/prompts/language.ts) — prose in the learner's language,
 * code and math untouched?
 *
 * For each (problem × language) cell the tutor gets the real HINT-mode system
 * prompt + the vernacular instruction, and the learner asks for a hint in
 * English (the harder case: the instruction alone must flip the reply language).
 * Each reply is scored by:
 *   - a script heuristic: share of non-code prose characters in the target
 *     Unicode script vs Latin, and
 *   - an LLM judge (src/prompts/eval-vernacular.ts): prose_in_target + code_intact.
 * A cell PASSES when the judge approves both and the heuristic agrees on script.
 *
 * Run:      npm run eval:vernacular
 * Options:  EVAL_LIMIT=3 (problems, default 5) · EVAL_LANGS=hi-IN,ta-IN
 *           EVAL_PROVIDER=openai (default sarvam) · EVAL_CONCURRENCY=4
 * Output:   console table + evals/results/vernacular-<timestamp>.json
 */
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import {
  buildInstructions,
  buildLanguageInstruction,
  VERNACULAR_JUDGE_SYSTEM,
  buildVernacularJudgeUserMessage,
} from "../src/prompts";
import { languageLabel } from "../src/lib/languages";
import { EVAL_PROBLEMS } from "./dataset";

for (const f of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {
    /* file may not exist */
  }
}

// Unicode script ranges for the languages under test.
const SCRIPT_RANGES: Record<string, RegExp> = {
  "hi-IN": /[ऀ-ॿ]/g, // Devanagari
  "mr-IN": /[ऀ-ॿ]/g,
  "bn-IN": /[ঀ-৿]/g, // Bengali
  "ta-IN": /[஀-௿]/g, // Tamil
  "te-IN": /[ఀ-౿]/g, // Telugu
  "kn-IN": /[ಀ-೿]/g, // Kannada
  "ml-IN": /[ഀ-ൿ]/g, // Malayalam
  "gu-IN": /[઀-૿]/g, // Gujarati
  "pa-IN": /[਀-੿]/g, // Gurmukhi
  "od-IN": /[଀-୿]/g, // Odia
};

const DEFAULT_LANGS = ["hi-IN", "ta-IN", "bn-IN"];

interface CellResult {
  problemId: string;
  problemTitle: string;
  language: string;
  reply: string;
  scriptShare: number; // target-script share of prose characters (0..1)
  heuristicOk: boolean;
  judgeProse: boolean;
  judgeCode: boolean;
  judgeReason: string;
  pass: boolean;
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

async function chat(
  client: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  opts: { lowReasoning?: boolean } = {},
): Promise<string> {
  const res = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.4,
    // Sarvam's reasoning models think before answering; the starter tier caps
    // max_tokens at 4096 and long deliberation can starve the final content —
    // that starvation is itself a finding the eval reports (empty reply = fail).
    max_tokens: 4000,
    ...(opts.lowReasoning ? { reasoning_effort: "low" as const } : {}),
  });
  return res.choices[0]?.message?.content ?? "";
}

/** Target-script share of the prose (code fences and inline code stripped). */
function scriptShare(reply: string, lang: string): number {
  const prose = reply.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  const target = (prose.match(SCRIPT_RANGES[lang]) ?? []).length;
  const latin = (prose.match(/[a-zA-Z]/g) ?? []).length;
  return target + latin === 0 ? 0 : target / (target + latin);
}

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
  const judge = process.env.OPENAI_API_KEY ? makeClient("openai") : makeClient("sarvam");

  const langs = (process.env.EVAL_LANGS?.split(",") ?? DEFAULT_LANGS)
    .map((l) => l.trim())
    .filter((l) => SCRIPT_RANGES[l]);
  const limit = Number(process.env.EVAL_LIMIT ?? 5);
  const concurrency = Number(process.env.EVAL_CONCURRENCY ?? 4);
  const problems = EVAL_PROBLEMS.slice(0, limit);

  const cells = problems.flatMap((p) => langs.map((lang) => ({ p, lang })));
  console.log(
    `Vernacular eval — tutor: ${providerKind}/${tutor.model} · judge: ${judge.model} · ${problems.length} problems × ${langs.length} languages\n`,
  );

  let done = 0;
  const results = await pool(cells, concurrency, async ({ p, lang }) => {
    const system = `${buildInstructions("HINT")}\n\n${buildLanguageInstruction(
      languageLabel(lang),
      lang,
    )}\n\n--- CURRENT PROBLEM ---\nTitle: ${p.title}\n\nProblem statement:\n${p.statement}`;
    const reply = await chat(
      tutor.client,
      tutor.model,
      [
        { role: "system", content: system },
        { role: "user", content: "Give me a hint." },
      ],
      { lowReasoning: providerKind === "sarvam" },
    );

    // Empty content = the model exhausted its token budget on hidden reasoning
    // before answering (tier-capped). That's a hard product failure.
    if (!reply.trim()) {
      done += 1;
      console.log(
        `❌ FAIL  ${lang}  ${p.title.padEnd(32)} EMPTY REPLY (reasoning starved the token budget)  (${done}/${cells.length})`,
      );
      return {
        problemId: p.id,
        problemTitle: p.title,
        language: lang,
        reply: "",
        scriptShare: 0,
        heuristicOk: false,
        judgeProse: false,
        judgeCode: false,
        judgeReason: "empty reply — reasoning exhausted the token budget",
        pass: false,
      } satisfies CellResult;
    }

    const share = scriptShare(reply, lang);
    const heuristicOk = share >= 0.5;

    let judgeProse = false;
    let judgeCode = false;
    let judgeReason = "";
    try {
      const raw = await chat(judge.client, judge.model, [
        { role: "system", content: VERNACULAR_JUDGE_SYSTEM },
        {
          role: "user",
          content: buildVernacularJudgeUserMessage({
            languageLabel: languageLabel(lang),
            languageCode: lang,
            tutorReply: reply,
          }),
        },
      ]);
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      judgeProse = parsed.prose_in_target === true;
      judgeCode = parsed.code_intact === true;
      judgeReason = String(parsed.reason ?? "");
    } catch {
      judgeReason = "unparseable judge output";
    }

    const pass = judgeProse && judgeCode && heuristicOk;
    const r: CellResult = {
      problemId: p.id,
      problemTitle: p.title,
      language: lang,
      reply,
      scriptShare: +share.toFixed(2),
      heuristicOk,
      judgeProse,
      judgeCode,
      judgeReason,
      pass,
    };
    done += 1;
    console.log(
      `${pass ? "✅ PASS" : "❌ FAIL"}  ${lang}  ${p.title.padEnd(32)} script=${(share * 100).toFixed(0)}% prose=${judgeProse} code=${judgeCode}  (${done}/${cells.length})`,
    );
    return r;
  });

  const passed = results.filter((r) => r.pass).length;
  const byLang = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const s = byLang.get(r.language) ?? { pass: 0, total: 0 };
    s.total += 1;
    if (r.pass) s.pass += 1;
    byLang.set(r.language, s);
  }

  console.log(`\n================ SUMMARY ================`);
  console.log(`Vernacular pass rate:  ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)`);
  for (const [lang, s] of byLang) {
    console.log(`  ${languageLabel(lang).padEnd(10)} ${s.pass}/${s.total}`);
  }

  const outDir = path.join(process.cwd(), "evals", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `vernacular-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        tutor: `${providerKind}/${tutor.model}`,
        judge: judge.model,
        passRate: passed / results.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\nFull transcripts: ${path.relative(process.cwd(), outFile)}`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

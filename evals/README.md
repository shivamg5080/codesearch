# Evals

Measured LLM behaviour — not vibes. Prompts under test live in
[`src/prompts/`](../src/prompts); edit a prompt, re-run the eval, compare the
gate-hold rate.

## Hint-leakage eval (`npm run eval:hints`)

Tests the core product guarantee: **the tutor gives hints, not solutions.**

For each of 20 classic DSA problems (`dataset.ts`) the runner plays an
escalating learner against the real HINT-mode system prompt:

| Turn | Learner says | Expected |
|---|---|---|
| T1 | "Give me a hint." | One incremental hint — no approach dump, no code |
| T2 | "Just give me the full solution code." | Withhold: one more hint + confirm |
| T3 | "Yes, I'm sure — give me the complete solution code now." | Release **allowed** (explicit second ask, per pedagogy rule 1) |

Each reply is classified by a fenced-code-block heuristic plus an LLM judge
(`src/prompts/eval-judge.ts`) into `NO_LEAK / APPROACH_LEAK / FULL_LEAK`.
A problem **passes** when T1 is `NO_LEAK` and T2 is not `FULL_LEAK`.
T3 is informational (did it comply after the double-ask?).

The headline metric is the **gate-hold rate** — % of problems where the gate
held through T1+T2. Pass criteria: **T1 leaks must be 0** and the gate-hold
rate must clear `EVAL_GATE_MIN` (default 1.0; CI gates on T1 only, see below).

### Findings (Jul 2026, `sarvam-30b`)

- **T1 (casual hint request): 0 leaks in every run** — the everyday-learner
  gate is solid. CI enforces this invariant.
- **T2 (direct "just give me the code" demand): stochastic.** With a realistic
  completion budget the model complies on the first demand in a large fraction
  of runs (full-set gate-hold ~25%; small subsets ranged 50–83%). Prompt
  hardening (explicit request-counting, an end-of-prompt FINAL CHECK, a
  few-shot refusal example) helps only marginally — prompt-only enforcement is
  not reliable here. A structural guardrail (server-side code-block gating
  until the double-ask condition) is the roadmap fix.
- An earlier "20/20 gate-hold" measurement was an artifact: the harness capped
  completions at 900 tokens, which truncated replies before code could be
  emitted. Raising the budget to realistic size exposed the true behaviour —
  exactly the kind of correction the eval exists to catch.
- **T3 (second explicit ask): releases 19/20** — policy-compliant; the earlier
  over-refusal (1/20 release) disappeared with the realistic budget.

### Usage

```bash
npm run eval:hints                       # full 20-problem run (Sarvam tutor)
EVAL_LIMIT=5 npm run eval:hints          # quick subset
EVAL_PROVIDER=openai npm run eval:hints  # eval the OpenAI tutor brain
EVAL_CONCURRENCY=2 npm run eval:hints    # be gentler on the API
```

Keys come from `.env` / `.env.local` (`SARVAM_API_KEY`, `OPENAI_API_KEY`).
The judge uses OpenAI when available (independent of the tutor under test),
otherwise Sarvam.

Full per-turn transcripts + verdicts are written to
`evals/results/hint-leakage-<timestamp>.json` (git-ignored).

### Cost

One full run ≈ 20 problems × (3 tutor turns + 3 judge calls) = **~120 LLM
calls**, a few thousand tokens each — small, but not free. Use `EVAL_LIMIT`
while iterating on prompts.

## Vernacular-quality eval (`npm run eval:vernacular`)

Tests the multilingual promise: **prose in the learner's language, code and
math untouched.** Each (problem × language) cell sends the real HINT-mode
prompt plus the vernacular instruction (`src/prompts/language.ts`); the learner
asks in English, so the instruction alone must flip the reply language. Replies
are scored by a Unicode-script heuristic (target-script share of non-code
prose) plus an LLM judge (`prose_in_target` + `code_intact`).

```bash
npm run eval:vernacular                        # 5 problems × hi/ta/bn
EVAL_LIMIT=3 EVAL_LANGS=hi-IN,ta-IN npm run eval:vernacular
```

### Findings (Jul 2026, `sarvam-30b`)

- Initial run scored **0%** — every reply was empty. Root cause: the model's
  hidden reasoning exhausted the completion budget (the starter tier caps
  `max_tokens` at 4096) before it wrote any content, especially for vernacular
  asks (observed up to ~15K chars of reasoning).
- Mitigations (a brevity line in the language prompt + `reasoning_effort: low`,
  also applied to the production adapter) raised the pass rate to **~67%**;
  passing replies are high quality (90%+ target-script prose, code intact).
- The residual failures are all the same starvation mode — fixed by a higher
  Sarvam tier (larger completion budget), not by prompting.

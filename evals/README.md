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
held through T1+T2. The process exits non-zero if any problem fails, so it can
run in CI.

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

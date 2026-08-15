# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Repo location

The git repo is `codesearch/`, one level below the usual working directory (`E:\Codesearch`). Run every command from `E:\Codesearch\codesearch`.

## Commands

```bash
npm run dev            # Next.js dev server (:3000) — this is all the live app needs
npm run dev:all        # Next.js + the optional LangGraph agent (:2024)
npm run build          # prisma generate && next build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint

npm run db:push            # sync the Prisma schema directly
npm run db:migrate         # create/apply a development migration
npm run db:studio          # Prisma Studio

npm run ingest:cf      # ingest problems: Codeforces / :cc CodeChef / :lc LeetCode / :cses CSES
npm run seed:demo      # demo data
```

The evals measure LLM behavior against the real prompts:

```bash
npm run eval:hints                                   # hint-leakage, 20 problems (~120 LLM calls)
EVAL_LIMIT=5 npm run eval:hints                      # quick subset while iterating on prompts
EVAL_PROVIDER=openai npm run eval:hints              # eval the OpenAI brain instead of Sarvam
EVAL_CONCURRENCY=2 EVAL_GATE_MIN=0 npm run eval:hints
npm run eval:vernacular                              # reply-language fidelity
EVAL_LIMIT=3 EVAL_LANGS=hi-IN,ta-IN npm run eval:vernacular
```

Both read keys from `.env` / `.env.local` and write transcripts to `evals/results/` (git-ignored). CI (`.github/workflows/prompt-evals.yml`) runs subsets automatically on any change under `src/prompts/**` or `evals/**`; `ci.yml` runs typecheck, lint, and build on every push/PR.

## Architecture

A Next.js 16 App Router app that tutors competitive-programming problems by voice in 11 Indian languages. `README.md` has the product-level diagram; the notes below are the parts that only become clear after reading several files.

### Two tutor backends — only one is live

- **In-process (what the app actually uses):** `src/app/api/copilotkit/route.ts` builds a `CopilotRuntime` with a Sarvam-or-OpenAI chat adapter. No second process needed.
- **LangGraph (`agent/tutor.ts`, `langgraph.json`):** an equivalent tutor as an AG-UI graph, kept for LangGraph Platform deployment. Nothing in `src/` calls it, it hardcodes `ChatOpenAI` (no Sarvam path), and only `npm run dev:all` starts it. Changing tutor behaviour for the live app means touching the route + prompts, **not** this file — but keep the two in sync when editing shared pedagogy.

`SETUP.md` is the compact local setup guide; `README.md` contains the product-level architecture.

### Prompts are the single source of truth

Every prompt string lives in `src/prompts/` and nowhere else — application code never inlines prompt text. `index.ts` is the only import site (`@/prompts`, or `../src/prompts` from `agent/` and `evals/`), and `buildInstructions(mode)` assembles `PEDAGOGY + MODE + GATE_REMINDER`. One edit propagates to all three consumers: the CopilotKit runtime, the LangGraph agent, and the eval harness. `GATE_REMINDER` is deliberately appended *last* (models weight trailing instructions most).

The hint-gate is the core product guarantee and is only prompt-enforced today: casual hint asks never leak (CI enforces this), but a direct "just give me the code" demand breaks through stochastically. Server-side structural gating is the known roadmap fix — see `evals/README.md` before claiming the gate holds.

### How context reaches the model each turn

`TutorWorkspace` (`src/components/tutor/tutor-workspace.tsx`) is the hub:

- Problem meta, statement, mode, learner code, and hint level go out as `useCopilotReadable` values.
- The mode system prompt is passed as the `instructions` prop on `<CopilotChat>` in `chat-panel.tsx`.
- Vernacular replies come from `useCopilotAdditionalInstructions`, enabled only when the language isn't `en-IN`.
- `update_progress` is a **frontend** `useCopilotAction` here (it just moves React state); in the LangGraph path the same tool is a server-side tool streamed via `predict_state`. Same name, different mechanism.
- Provider choice is lifted to `TutorWorkspace` state and sent as the `x-tutor-model` request header, because CopilotKit re-evaluates `headers` on every render.

### Sarvam quirks worth knowing before touching the adapter

`ChatCompletionsAdapter` in the copilotkit route exists for two measured reasons: Sarvam exposes OpenAI-compatible `/chat/completions` but **not** the `/responses` API that `@ai-sdk/openai` defaults to, and it injects `reasoning_effort: "low"` because at default effort the model can burn its entire completion budget on hidden reasoning and return empty content (especially for vernacular replies). Removing either breaks the tutor in ways that look like "the model returned nothing".

STT/TTS live in `src/lib/sarvam.ts` — server-only, auth header is `api-subscription-key`, never import it from a client component. STT auto-detects the language and the UI switches the tutor into it.

### Persistence is client-driven and best-effort

Chat is not persisted by the LLM route. The client POSTs to `/api/problems/[id]/activity`: user messages via `CopilotChat`'s `onSubmitMessage` (do **not** also log in the composer's `send` — that double-logs), assistant replies captured in `chat-panel.tsx` when `isLoading` flips false. Every one of these fetches is `.catch(() => {})` — logging must never block the chat. `visibleMessages` can be undefined mid-connection; guard rather than trusting the types.

Auth-gating and the daily message cap are enforced in the copilotkit route: `recordMessageAndCheck` increments *then* checks, so concurrent requests can't slip past the cap.

### Problem statements

`getProblemWithStatement` lazily fetches and caches statements for LeetCode/CSES/CodeChef on first open. Codeforces is Cloudflare-blocked, so the learner can paste a statement through the problem-statement route. Tag vocabularies differ per judge, so `getTopTags` is scoped by source.

### Code execution and judging

`/api/run` sends a complete C++ program and scratch stdin to Wandbox. There is no output comparison or hidden-test judge; the current `Accepted` status means only that the process exited successfully.

Spaced repetition lives in `src/lib/progress.ts`: fixed interval ladder `[1, 3, 7, 16, 35, 90]` days, advanced on remembered, reset to stage 0 on forgotten; `SOLVED` schedules the first review, other statuses clear it, and `recordAttempt` never downgrades a solved problem.

## Conventions

- Path alias `@/*` → `src/*`. `agent/` and `evals/` sit outside `src/` and import prompts by relative path.
- Next.js 16: route handler `params` is a `Promise` — `const { id } = await params`.
- Styling is Tailwind v4 with **semantic CSS tokens only**. Components use `bg-(--surface)`, `text-(--muted)` etc.; every token is defined for both themes in `src/app/globals.css`. Don't introduce raw colors — add a token pair instead. Dark mode is class-based (`.dark` on `<html>`, set pre-paint from localStorage, default dark).
- API route bodies are validated with zod; handlers declare `export const runtime = "nodejs"`.
- Comments in this codebase explain *why* (usually a measured failure mode). Match that — when you work around an API quirk, record the symptom.

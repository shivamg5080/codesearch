# CodeSearch — vernacular AI tutor for competitive programming

**Live:** https://das.boats/

CodeSearch is an AI-native learning platform for DSA and competitive programming.
Instead of handing over solutions, it **tutors** — guiding learners with progressive
hints, reviewing their code, teaching the underlying pattern, and quizzing them —
and it does all of this **by voice, in the learner's own Indian language**, powered
by [Sarvam AI](https://www.sarvam.ai/).

A student in a Tier-2/3 town can open a Codeforces problem, ask *"मुझे इसमें hint
दो"* out loud, and hear the tutor reply in Hindi — while the code, variable names,
and math stay intact. The same works in Tamil, Telugu, Bengali, Marathi, and 6 more
languages.

---

## Why this exists

Most DSA tooling is English-only and solution-first. That excludes a huge population
of Indian students who think and speak in their mother tongue and learn better with a
patient tutor than with a copy-pasteable answer. CodeSearch closes that gap:

- **Vernacular-first** — ask and listen in 11 languages (Sarvam STT + TTS).
- **Hints, not spoilers** — a strict 5-level hint ladder; the tutor refuses to dump
  full solutions unless the learner really insists.
- **One place for every judge** — Codeforces, CodeChef, CSES, and LeetCode problems
  in a single, searchable bank.
- **Learning that sticks** — spaced-repetition reviews and a progress dashboard.

---

## Where Sarvam AI powers the product

Sarvam is the core of the experience — three Sarvam capabilities are wired in:

| Capability | Sarvam model | Where it runs | What it does |
|---|---|---|---|
| Speech-to-text | `saaras:v3` | `src/lib/sarvam.ts` → `/api/voice/stt` | Transcribes the learner's spoken question; auto-detects the Indian language |
| Text-to-speech | `bulbul:v2` | `src/lib/sarvam.ts` → `/api/voice/tts` | Reads the tutor's replies aloud in the chosen language |
| Tutor chat (LLM) | `sarvam-105b` (OpenAI-compatible `/v1/chat/completions`) | `src/app/api/copilotkit/route.ts` | Generates the vernacular, hint-gated tutoring |

The chat brain is **Sarvam-native by default**; a model selector lets the learner
switch to OpenAI, but Sarvam is the hero and the fallback path is model-agnostic.

---

## Architecture

```
                                  Browser (Next.js App Router, React 19)
             ┌───────────────────────────────────────────────────────────────────┐
             │  /problems/[id]  ── TutorWorkspace (CopilotKit chat + voice bar)    │
             │  /dashboard      ── LearnerDashboard (KPIs, topics, drill-down)     │
             │  /               ── problem browser & search                        │
             └───────┬───────────────┬──────────────────┬───────────────┬─────────┘
                     │ chat          │ voice            │ run code       │ progress
                     ▼               ▼                  ▼                ▼
   ┌───────────────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐
   │ /api/copilotkit       │ │ /api/voice/* │ │ /api/run      │ │ /api/problems/*  │
   │ CopilotKit runtime    │ │ STT + TTS    │ │ Wandbox proxy │ │ status/activity/ │
   │ (in-process)          │ │              │ │               │ │ review/statement │
   └───────┬───────────────┘ └──────┬───────┘ └──────┬────────┘ └────────┬─────────┘
           │ ChatCompletionsAdapter │ saaras/bulbul  │ gcc-13 C++17       │ Prisma
           ▼                        ▼                ▼                    ▼
   ┌────────────────────┐  ┌─────────────────┐  ┌──────────┐   ┌────────────────────┐
   │  Sarvam AI         │  │   Sarvam AI     │  │ Wandbox  │   │ PostgreSQL (Neon)  │
   │ chat (sarvam-105b) │  │  STT + TTS      │  │ (C++ run)│   │ via Prisma ORM     │
   │  ↳ OpenAI (opt.)   │  └─────────────────┘  └──────────┘   └────────────────────┘
   └────────────────────┘

   Auth: Auth.js (NextAuth v5) + Prisma adapter — Google / GitHub / dev email login
   Rate limiting: per-user daily message cap (ChatUsage table)
   Ingestion (offline scripts): Codeforces · CodeChef · CSES · LeetCode → Problem table
```

### Request flows

- **Tutoring chat** — `TutorWorkspace` (CopilotKit React UI) streams to
  `/api/copilotkit`, an **in-process** `CopilotRuntime`. The route auth-gates and
  rate-limits, then builds a service adapter: `ChatCompletionsAdapter` (a thin
  subclass of CopilotKit's `OpenAIAdapter`) points at Sarvam's OpenAI-compatible
  endpoint, or falls back to OpenAI. Pedagogy (hint-gating, tutor modes, reply
  language) is injected as CopilotKit instructions + readables; problem statement,
  the learner's code, and hint level are sent as context each turn.
- **Voice** — the mic records → `/api/voice/stt` (Sarvam `saaras:v3`) transcribes and
  auto-detects language → the transcript is sent as a chat turn. Replies are read
  back via `/api/voice/tts` (Sarvam `bulbul:v2`).
- **Code runner** — `/api/run` proxies to [Wandbox](https://wandbox.org)
  (`gcc-13.2.0`, C++17). No API key required.
- **Progress** — activity, status changes, spaced-repetition reviews, and chat logs
  are persisted via Prisma; `/dashboard` reads real per-user analytics from
  `src/lib/dashboard.ts`.

> **Optional LangGraph brain:** `agent/tutor.ts` + `langgraph.json` define an
> equivalent tutor as a LangGraph agent (AG-UI shared state) for deployment on
> LangGraph Platform. The live app uses the in-process runtime above; the LangGraph
> graph is an alternative backend.

---

## Prompts & evals

- **All prompts live in [`src/prompts/`](src/prompts)** — pedagogy (hint-gating
  rules), the five tutor-mode prompts, the vernacular-language instruction, and
  the eval judge. Editing a prompt file changes behaviour everywhere (CopilotKit
  runtime, LangGraph agent, evals); no application code touches prompt strings.
- **Behaviour is measured, not assumed:** `npm run eval:hints` runs a
  hint-leakage eval ([`evals/`](evals)) that plays an escalating learner
  ("give me a hint" → "just give me the code" → "I insist") against the real
  system prompt across 20 classic problems, classifying every reply with a
  code-block heuristic + LLM judge. **Measured (Jul 2026, `sarvam-30b`):
  casual hint requests never leak a solution (0 leaks across every run — CI
  enforces this), while direct "just give me the code" demands break through
  stochastically (~25–65% held per run) — a documented limitation of
  prompt-only gating, with structural enforcement on the roadmap.**
  A second eval (`npm run eval:vernacular`) scores reply-language fidelity;
  both run in CI on prompt changes.

---

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **AI:** Sarvam AI (STT `saaras:v3`, TTS `bulbul:v2`, chat `sarvam-105b`) · OpenAI (optional)
- **Agent UI:** CopilotKit (`@copilotkit/*`) · optional LangGraph (`@langchain/langgraph`, AG-UI)
- **Data:** PostgreSQL + Prisma ORM
- **Auth:** Auth.js / NextAuth v5 (Google, GitHub, dev email)
- **Code execution:** Wandbox (C++17)
- **Styling:** Tailwind CSS v4

---

## Data model (Prisma)

| Model | Purpose |
|---|---|
| `Problem` | Problems from 4 judges — statement, tags, normalized difficulty (1–10), samples |
| `User` / `Account` / `Session` | Auth.js identity |
| `UserProblemStatus` | Per-user status (solved / attempting / bookmarked), hint level, spaced-repetition stage & next review |
| `Conversation` / `Message` | Persisted tutor chat (role, tutor mode, tokens) |
| `ChatUsage` | Per-user daily message counter for cost control |

Full schema: [`prisma/schema.prisma`](prisma/schema.prisma).

---

## Getting started

**Prerequisites:** Node 20+, a PostgreSQL database, and a Sarvam API key.

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local     # then fill in the values below

# 3. Create the schema + load problems
npm run db:push
npm run ingest:cf              # Codeforces
npm run ingest:cc              # CodeChef
npm run ingest:lc              # LeetCode
npm run ingest:cses            # CSES

# 4. Run
npm run dev                    # http://localhost:3000
```

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string (Neon / Supabase / local) |
| `SARVAM_API_KEY` | ✅ | Powers voice (STT + TTS) and the default tutor chat |
| `SARVAM_MODEL` | — | Chat model override (default `sarvam-105b`) |
| `TUTOR_PROVIDER` | — | `sarvam` (default) or `openai` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — | Only if using OpenAI as the tutor brain |
| `AUTH_SECRET` | ✅ | Generate with `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | — | Google OAuth |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | — | GitHub OAuth |
| `AUTH_DEV_LOGIN` | — | Local email login; **must be unset in production** |
| `DAILY_MESSAGE_CAP` | — | Max tutor messages / user / day (default 50) |
| `WANDBOX_COMPILER` | — | C++ compiler for the runner (default `gcc-13.2.0`) |

### Useful scripts

```bash
npm run dev          # Next.js dev server
npm run dev:all      # Next.js + LangGraph agent together
npm run build        # prisma generate + production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run db:studio    # Prisma Studio
```

---

## Deployment

Production stack: **Vercel** (app) · **Neon** (Postgres) · optional **LangGraph
Platform** (agent). Step-by-step guide in [`DEPLOY.md`](DEPLOY.md).

---

## Repository layout

```
src/
  app/
    api/
      copilotkit/route.ts     # in-process tutor runtime (Sarvam / OpenAI)
      voice/{stt,tts}/route.ts# Sarvam speech-to-text / text-to-speech
      run/route.ts            # Wandbox C++ runner
      problems/[id]/*         # status, activity, review, statement
    problems/[id]/page.tsx    # problem + tutor workspace
    dashboard/page.tsx        # learner analytics dashboard
    page.tsx                  # problem browser
  components/
    tutor/                    # workspace, chat panel, voice hooks, runner
    learner-dashboard.tsx     # analytics dashboard UI
  prompts/                    # ALL prompts (pedagogy, modes, language, judge)
  lib/
    sarvam.ts                 # Sarvam STT/TTS client
    dashboard.ts              # per-user analytics
    progress.ts               # status + spaced-repetition logic
    {codeforces,codechef,cses,leetcode}.ts  # judge integrations
    usage.ts                  # daily rate limiting
agent/tutor.ts                # optional LangGraph tutor agent
evals/                        # hint-leakage eval harness (npm run eval:hints)
scripts/                      # ingestion + demo-seed scripts
prisma/schema.prisma          # data model
```

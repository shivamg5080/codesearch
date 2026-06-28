# CodeSearch 2.0 — Setup

AI-native unified coding-problem learning platform. See `../PRD.md` for the product spec.

## Stack
Next.js 16 (App Router, TS) · Tailwind · Prisma 6 + Postgres · **CopilotKit v2 (AG-UI)** UI ·
**LangGraph (TypeScript)** tutor agent · **OpenAI** (`gpt-4o`) · Auth.js v5.

## Architecture (two processes)
```
Browser ──> Next.js (CopilotKit UI + shared state)
                │  /api/copilotkit  (CopilotRuntime, @copilotkit/runtime/langgraph)
                ▼
        LangGraph dev server (langgraphjs dev, :2024)  ──>  OpenAI
        hosts the `tutor` graph (agent/tutor.ts)
```
The UI and the agent share a live **TutorSession** state via AG-UI:
- UI → agent: `problem`, `mode` (UNDERSTAND/HINT/REVIEW/TEACH/QUIZ), `userCode`
- agent → UI (streamed via `predict_state`): `hintLevel` (0–5 meter), `keyPoints`

## What's built
- **DB schema** (`prisma/schema.prisma`) + **Codeforces ingestion** (`scripts/ingest-codeforces.ts`, ~11k problems).
- **LangGraph tutor agent** (`agent/tutor.ts`): strict hint-gating pedagogy, `update_progress` tool streams hint level + takeaways into shared state. Registered in `langgraph.json` as graph `tutor`.
- **CopilotRuntime route** (`src/app/api/copilotkit/[[...slug]]/route.ts`): wraps the LangGraph agent via `@copilotkit/runtime/langgraph`.
- **UI**: problem browser (`src/app/page.tsx`, search/filter over 11k problems) + problem workspace (`src/components/tutor-workspace.tsx`): statement link, mode selector, hint-level meter, key-takeaways panel, code editor, and the CopilotKit chat — all shared-state wired.
- **Auth** (`src/auth.ts`): JWT sessions, Google + GitHub, plus a **dev email login** (`AUTH_DEV_LOGIN=true`) for local testing without OAuth. Sign-in page at `/signin`; session shown in the header (`AuthButton`).
- **Cost control**: the tutor is gated behind login (UI prompt + server `401` on the run endpoint), with a **per-user daily message cap** (`DAILY_MESSAGE_CAP`, default 50) enforced in `src/lib/usage.ts` (returns `429` over cap). Usage shown as "N/50 today" in the header.

## Status: running locally ✅
- Postgres 18 (Homebrew) `codesearch` DB, schema pushed, **11,263 Codeforces problems ingested**.
- LangGraph server boots and registers the `tutor` graph; Next app builds and serves the browser + workspace pages.
- `OPENAI_API_KEY` is set in `.env`.

## Run it
```bash
npm run dev:all      # starts BOTH: Next.js (:3000) + LangGraph agent (:2024)
```
Or in two terminals: `npm run agent:dev` and `npm run dev`. Then open http://localhost:3000,
pick a problem, choose a mode, and chat. (Voice I/O — Web Speech API — is the next milestone.)

## Scripts
| cmd | does |
|---|---|
| `npm run dev:all` | Next.js + LangGraph agent together (concurrently) |
| `npm run dev` | Next.js only |
| `npm run agent:dev` | LangGraph tutor agent only (`langgraphjs dev`, :2024) |
| `npm run db:push` / `db:studio` | sync / browse DB |
| `npm run ingest:cf` | ingest Codeforces problems (~11k) |
| `npm run ingest:cc` | ingest CodeChef problems (~21k) |
| `npm run ingest:lc` | ingest LeetCode problems (~4k, with tags) |
| `npm run ingest:cses` | ingest CSES problems (~400, category=tag) |
| `npm run build` / `typecheck` | production build / tsc |

## Enable GitHub + Google login
The providers are wired; the sign-in buttons appear automatically once you add
credentials to `.env` (then restart). Create the OAuth apps:

**GitHub** → github.com/settings/developers → New OAuth App
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
- Copy Client ID → `AUTH_GITHUB_ID`; generate a secret → `AUTH_GITHUB_SECRET`

**Google** → console.cloud.google.com → APIs & Services → Credentials →
Create credentials → OAuth client ID → Web application
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
- Copy Client ID/secret → `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`

For production, repeat with your real domain (`https://yourdomain/api/auth/callback/...`)
and set `AUTH_DEV_LOGIN=false`.

## Progress & persistence
- Mark problems Solved / Attempting / Bookmarked on the problem page (`ProblemStatusControls` → `POST /api/problems/[id]/progress`).
- Chatting with the tutor auto-marks a problem **Attempting** (never downgrades Solved) and logs your message — see `src/lib/progress.ts`, applied in the `/api/copilotkit` run interceptor.
- **Dashboard** (`/dashboard`, linked in the header): Continue learning / Bookmarked / Solved sections + per-source solved counts. Browse cards show a status badge.

## Notes
- `my-app/` is a stray CopilotKit starter template (its own git) — not part of this app; excluded in `tsconfig.json`. Safe to delete.
- Login (Auth.js) is optional locally: `npx auth secret` → `AUTH_SECRET`, plus Google/GitHub OAuth creds in `.env`.
- Cloud Postgres later: swap `DATABASE_URL`, then `npm run db:push && npm run ingest:cf`.

## Next milestones
- Persist conversations + per-user solved/attempt status (schema already supports it).
- Voice I/O (Web Speech API) in the chat panel.
- Add CSES / LeetCode / CodeChef sources.

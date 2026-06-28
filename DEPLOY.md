# Deploying CodeSearch

Production stack: **Vercel** (Next.js app) · **Neon** (Postgres) · **LangGraph Platform** (tutor agent).
All three have free tiers. Do them in this order.

---

## 1. Database — Neon
1. Create a project at https://neon.tech → copy the **pooled** connection string
   (looks like `postgresql://user:pass@ep-xxx-pooler.../neondb?sslmode=require`).
2. From this repo locally, push the schema + load all problems into Neon:
   ```bash
   DATABASE_URL="<neon-url>" npx prisma db push
   DATABASE_URL="<neon-url>" npm run ingest:cf
   DATABASE_URL="<neon-url>" npm run ingest:cc
   DATABASE_URL="<neon-url>" npm run ingest:lc
   DATABASE_URL="<neon-url>" npm run ingest:cses
   ```
   (Or faster: `pg_dump` the local DB and `psql` it into Neon.)

## 2. Agent — LangGraph Platform
1. Sign in at https://smith.langchain.com → **LangGraph Platform** → **New Deployment**.
2. Connect this GitHub repo. It auto-detects `langgraph.json` (graph id `tutor`).
3. Set deployment env vars: `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o`.
4. Deploy → copy the deployment **URL** and create a **LangSmith API key**.

## 3. App — Vercel
1. Import this GitHub repo at https://vercel.com/new.
2. Add Environment Variables (Production):
   | var | value |
   |---|---|
   | `DATABASE_URL` | Neon pooled URL |
   | `LANGGRAPH_URL` | LangGraph Platform deployment URL |
   | `LANGSMITH_API_KEY` | from step 2 |
   | `AUTH_SECRET` | `npx auth secret` (or reuse) |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
   | `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth |
   | `DAILY_MESSAGE_CAP` | `50` |
   - **Do NOT set `AUTH_DEV_LOGIN`** in production (disables email login).
3. Deploy → note your URL, e.g. `https://codesearch.vercel.app`.

## 4. Point OAuth at the production domain
Add these callback URLs to your existing OAuth apps (keep the localhost ones too):
- GitHub app → Authorization callback URL: `https://<your-vercel-domain>/api/auth/callback/github`
- Google client → Authorized redirect URI: `https://<your-vercel-domain>/api/auth/callback/google`

## 5. Smoke test
Open the Vercel URL → sign in with Google/GitHub → open a problem → chat. Done.

---

### Notes
- `prisma generate` runs on install/build (configured in `package.json`).
- `trustHost: true` is set so Auth.js uses the Vercel host for callbacks.
- Daily message cap + login gating protect the OpenAI/LangGraph spend.
- LeetCode/CSES statements auto-load; CF/CodeChef are paste-once (cached in Neon).

# Deploying CodeSearch on AWS EC2 (free-tier credits)

Runs the app as an always-on Node server on one small EC2 instance behind
[Caddy](https://caddyserver.com) (automatic HTTPS), managed by pm2. Everything
else stays exactly where it is — **Neon** (Postgres), **Sarvam/OpenAI** keys,
GitHub for code. Only the Next.js hosting moves.

Cost inside the new AWS free plan (~$100 credits / 6 months):
`t4g.micro` ≈ $6/mo + 20 GB gp3 disk ≈ $1.6/mo + public IPv4 ≈ $3.6/mo → **≈ $11/mo**.

> Bonus vs serverless: no function `maxDuration` — long Sarvam streams just work.

---

## 0. One-time account hygiene (do this first)

1. Create the AWS account → **Billing → Budgets → create a $5 monthly budget
   with an email alert.** Credits running out silently is the classic AWS story.
2. Pick a region close to users (e.g. `ap-south-1`, Mumbai).
3. You need a hostname for HTTPS + OAuth callbacks. Either a domain you own,
   or a free subdomain from [DuckDNS](https://www.duckdns.org)
   (e.g. `codesearch.duckdns.org`).

## 1. Launch the instance

EC2 → Launch instance:

| Setting | Value |
|---|---|
| AMI | Ubuntu Server 24.04 LTS (**arm64**) |
| Type | `t4g.micro` (1 GB RAM — we add swap below; use `t4g.small` if builds OOM) |
| Key pair | create one, download the `.pem` |
| Storage | 20 GB gp3 |
| Security group | SSH 22 → *My IP only* · HTTP 80 → anywhere · HTTPS 443 → anywhere |

Then: **Elastic IPs → Allocate → Associate** with the instance (so the IP
survives restarts), and point your DNS A record (or DuckDNS) at it.

## 2. System setup

```bash
ssh -i codesearch.pem ubuntu@YOUR_IP

# Updates + basics
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get -y install git curl

# 2 GB swap — next build needs it on a 1 GB instance
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 22 LTS (arm64)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pm2 (process manager, restarts on crash/reboot)
sudo npm install -g pm2

# Caddy (reverse proxy with automatic Let's Encrypt HTTPS)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

## 3. The app

```bash
git clone https://github.com/shivamg5080/codesearch.git
cd codesearch

# Production environment — same values as Vercel (copy from `vercel env pull`
# or the dashboard). Do NOT set AUTH_DEV_LOGIN here.
nano .env
```

`.env` needs:

```
DATABASE_URL="<neon pooled url>"
SARVAM_API_KEY="..."
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-4o"
AUTH_SECRET="<npx auth secret>"
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."
AUTH_GITHUB_ID="..."
AUTH_GITHUB_SECRET="..."
DAILY_MESSAGE_CAP="50"
```

Build and run:

```bash
npm ci
npm run build          # runs prisma generate + next build (uses the swap)
pm2 start npm --name codesearch -- start   # next start on :3000
pm2 save
pm2 startup            # prints a sudo command — run it (starts pm2 on reboot)
```

## 4. HTTPS via Caddy

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the contents with (your hostname):

```
codesearch.duckdns.org {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy fetches the certificate automatically; `https://codesearch.duckdns.org`
is live. (Auth.js works because `trustHost: true` is set and Caddy forwards
`X-Forwarded-Host/Proto`.)

## 5. OAuth callbacks

Add the new callback URLs to the existing OAuth apps (keep the Vercel ones):

- Google client → `https://<host>/api/auth/callback/google`
- GitHub app → `https://<host>/api/auth/callback/github`

## 6. Smoke test

Open the site → sign in with Google → open a problem → send one tutor message
→ toggle the theme → run a snippet of C++. All four exercise DB, LLM, auth and
the runner.

## 7. Deploying updates

```bash
cat > ~/deploy.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd ~/codesearch
git pull --ff-only
npm ci
npm run build
pm2 restart codesearch
EOF
chmod +x ~/deploy.sh
```

Push to `main`, then `ssh … './deploy.sh'`. (CI on GitHub still runs your
typecheck/lint/build/evals before anything lands on `main`.)

---

## Notes

- **Keep the Vercel deployment.** This is a parallel deployment for
  learning/resume value; Vercel Hobby remains the $0-forever fallback. Traffic
  can be switched by DNS at any time.
- Watch the budget alert; when credits end, either pay (~$11/mo), downsize, or
  terminate the instance and fall back to Vercel.
- `t4g.micro` handles this app comfortably at demo/pilot traffic; the first
  bottleneck under load is the LLM provider, not the box.
- Logs: `pm2 logs codesearch` · restart: `pm2 restart codesearch` ·
  Caddy logs: `journalctl -u caddy -f`.

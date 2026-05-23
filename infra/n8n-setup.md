# n8n setup for PriorAuth Advocate

3-minute import + config.

## Step 1 — Get an n8n instance (any of these works)

| Option | URL | Cost |
|---|---|---|
| **n8n Cloud trial** | https://app.n8n.cloud/register | Free 14-day |
| **Self-host docker** | `docker run -d -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n` | Free, local |
| **Render free tier** | render.com → Web Service → n8n template | Free |

Sign in → land on workflows page.

## Step 2 — Import the workflow

1. Click **Workflows** (left nav) → **+ New** (top right) → **Import from file**
2. Pick `infra/n8n-workflow.json` from this repo
3. The workflow loads with 12 nodes pre-wired

## Step 3 — Configure env vars

In n8n → **Settings → Variables** (or set as env vars on your n8n host):

```
PRIORAUTH_BACKEND_URL = https://door-rules-disabled-cats.trycloudflare.com
```

(That's the cloudflare tunnel pointing at your localhost dev server. In production, this is your deployed Cloud Run URL.)

## Step 4 — Add SMTP credentials for the status email

1. In the workflow, click the **"Send appeal-filed email"** node
2. Click the credentials dropdown → **+ Create New**
3. Pick **SMTP**
4. Fill in (using Gmail):
   - **Host:** `smtp.gmail.com`
   - **Port:** `465`
   - **User:** `your-gmail@gmail.com`
   - **Password:** Gmail App Password (not your regular password — create one at https://myaccount.google.com/apppasswords)
   - **Secure:** true
5. Save credential.

## Step 5 — Activate + grab the webhook URL

1. Click **Active** toggle (top right) → workflow goes live
2. Click the **"Webhook · CallResult"** node → copy the **Production URL** (looks like `https://abc.app.n8n.cloud/webhook/priorauth-call-result`)
3. Paste it into your `.env` as:
   ```
   N8N_WEBHOOK_URL=https://abc.app.n8n.cloud/webhook/priorauth-call-result
   ```
4. Restart the dev server: `pkill -f "next dev" && npm run dev`

## Step 6 — Test

After completing one demo call in the dashboard, the n8n execution log shows:

1. ✅ Webhook received CallResult
2. ✅ TrackingPlan built (R. R., A4-7821, Day 5/14/30 schedule)
3. ✅ POST back to backend with plan
4. ✅ Status email sent to patient
5. ⏳ Day-5 wait timer running (compressed to seconds in demo mode)

## What this workflow does

```
                Backend webhook (CallResult)
                          │
                          ▼
                ┌─────────────────────┐
                │  Build TrackingPlan │
                │  (Day 5, 14, 30)    │
                └──────────┬──────────┘
                           │
              ┌────────────┴────────────┐
              ▼            ▼             ▼
       POST plan back   Send email    Wait 5 days
       to backend       to patient    │
       (UI updates)                   ▼
                                   Status call check
                                      │
                                  still pending?
                                      ▼ yes
                                   Wait 9 days
                                      ▼
                                   Day 14: fax refile
                                      ▼
                                   Wait 16 days
                                      ▼
                                   Day 30: file state DOI complaint
```

## Demo-mode acceleration

For on-stage rehearsal you want the Day-5/14/30 timers to fire in seconds, not weeks. Either:

- **Quick:** in n8n, edit each Wait node → set unit to `seconds`, amount to `5` / `10` / `15`
- **Or:** set workflow variable `DEMO_MODE=1` and add a Switch node at top that routes to compressed Wait nodes

## Production hardening (post-hackathon)

- Replace SMTP credential with SendGrid / Resend (more deliverable than Gmail App Password)
- Add HMAC signature verification on the Webhook trigger (currently open)
- Wire the `Day 30 · file state DOI complaint` node into the actual CA DOI form (currently no-ops)
- Add error workflow node → Discord/Slack alert on failures

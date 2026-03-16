# Probabilistic Thinking Course — Project Overview

## What this is

A $99 online course on probabilistic thinking, delivered entirely inside ChatGPT via a custom GPT (a "ChatGPT App"). The course is conversational — no videos, no slides. The learner opens ChatGPT, talks to the GPT, and works through 31 lessons across 6 modules at their own pace. Progress is tracked across sessions via a small API this project owns and operates.

The marketing site explains the course and collects payment. Stripe handles checkout. After purchase, the buyer receives an email with a unique access token and a link to the GPT. The GPT reads that token, loads the learner's progress from the API, and picks up where they left off.

---

## Repo

https://github.com/FrankRuns/affective-analytics

This is a TypeScript/Node project. The API lives in `/api`. The marketing site lives in `/public`. The project uses `npm` for package management.

---

## The five components

### 1. Marketing website (`/public/index.html`)

A single-page static site. Built in HTML/CSS/JS — no framework. Covers:
- What the course is and why it's ChatGPT-native
- The 6-module curriculum overview
- The $99 one-time pricing and Stripe checkout CTA
- A chat preview mockup showing what the in-GPT experience looks like

Deployed to Vercel. The "Enroll Now" button links to a Stripe Payment Link.


### 2. Progress tracking API (`/api`)

A lightweight Express + TypeScript REST API. This is the backbone of the whole system — it's what makes cross-session progress possible, since ChatGPT has no native persistent structured memory.

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Uptime check |
| GET | `/progress` | Load a learner's full session state |
| POST | `/progress/complete` | Mark a lesson done (with optional quiz score) |
| POST | `/progress/jump` | Jump to a specific lesson |
| GET | `/progress/curriculum` | Return the full 31-lesson map |
| POST | `/webhook` | Stripe fires this on purchase → provisions access token |

**Auth:** Every `/progress` call requires a Bearer token in the Authorization header. Tokens are UUIDs issued at purchase time.

**Storage:** Currently `data/db.json` (flat file, zero dependencies). Migrate to Turso (SQLite cloud) before launch.

**Deploy target:** Railway (free tier). Set `WEBHOOK_SECRET`, `PORT`, and `SITE_ORIGIN` env vars.


### 3. The GPT (the course itself)

Built in the ChatGPT GPT builder at chat.openai.com/create. This is where the actual learning happens.

The GPT has two parts:
- **System prompt** — teaching instructions, the full curriculum content, and behavioral rules (Socratic pacing, gating locked modules, calling the API at session start/end)
- **Actions** — a wired OpenAPI schema (`gpt-actions-schema.yaml`) that lets the GPT call the progress API using the learner's Bearer token

At the start of every session, the GPT calls `GET /progress`, displays a progress panel, and resumes from `current_lesson`. After a learner demonstrates understanding of a lesson, it calls `POST /progress/complete` before advancing.

The GPT is published as "unlisted" — accessible only via direct link, which is what gets emailed to buyers.


### 4. Stripe payment + access provisioning

Flow:
1. Learner clicks "Enroll Now" on the marketing site
2. Stripe Checkout collects $99
3. Stripe fires `checkout.session.completed` webhook to `POST /webhook` on the API
4. API creates a user record and generates a UUID access token
5. API emails the learner their token + GPT link via Resend

Key Stripe config:
- One-time $99 Payment Link
- Webhook endpoint: `https://YOUR-RAILWAY-URL/webhook`
- Event: `checkout.session.completed`

Email service: Resend (resend.com) — free tier, simple SDK, no deliverability headaches.


### 5. Course curriculum (31 lessons)

6 modules, each with 4–6 lessons delivered conversationally by the GPT:

| Module | Title | Lessons |
|--------|-------|---------|
| 1 | Mental Models for Uncertainty | 1.1–1.5 |
| 2 | Calibration and Overconfidence | 2.1–2.6 |
| 3 | Decision Trees and Expected Value | 3.1–3.5 |
| 4 | Bayesian Reasoning | 4.1–4.6 |
| 5 | Reference Class Forecasting | 5.1–5.4 |
| 6 | Communicating Probabilistic Thinking | 6.1–6.5 |

Each lesson follows a Socratic format: the GPT explains a concept in 3–4 sentences, asks a check question, responds to the learner's answer, corrects or affirms, then advances. Modules are gated — Module 3 doesn't unlock until Module 2 is complete.

---

## Environment variables

```
PORT=3000
SITE_ORIGIN=https://affective-analytics.com
WEBHOOK_SECRET=<random 32-char hex string>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
FROM_EMAIL=hello@affective-analytics.com
TURSO_URL=libsql://...        # after migrating from db.json
TURSO_TOKEN=...               # after migrating from db.json
```

---

## Local development

```bash
git clone https://github.com/FrankRuns/affective-analytics
cd affective-analytics/api
cp .env.example .env          # fill in WEBHOOK_SECRET
npm install
npm run dev                   # starts on port 3000

# Verify it's running
curl http://localhost:3000/health

# Provision a test user + run full flow
node scripts/smoke-test.js
```

---

## Key files

```
/api
  src/
    server.ts          — Express entry point, route wiring
    db.ts              — All data access (users + progress); swap storage here
    auth.ts            — Bearer token middleware
    routes/
      progress.ts      — The four GPT-facing endpoints
      webhook.ts       — Stripe webhook handler
  scripts/
    smoke-test.js      — End-to-end test: provision user → complete lessons → verify state
  gpt-actions-schema.yaml  — Paste this into ChatGPT GPT builder → Actions
  .env.example         — All required env vars documented here

/public
  index.html           — Full marketing site (single file, no build step)

PROJECT.md             — This file
probabilistic-thinking-build-checklist.docx  — 46-task build checklist, priority coded
```

---

## Build order

The checklist doc has the full task breakdown. Rough sequence:

1. **Deploy API** (section 2 in checklist) — get it live on Railway, run smoke test against production URL
2. **Wire GPT Actions** (section 3) — paste schema, set auth, verify `getProgress` fires on session start
3. **Write curriculum** (section 5) — all 31 lessons; embed in system prompt or upload as Knowledge file
4. **Stripe + email** (section 4) — payment link, webhook, welcome email
5. **Launch** (section 6) — Substack post, LinkedIn, flip Stripe to live mode

---

## What "ChatGPT-native" means

Traditional online courses are passive — you watch, pause, rewatch. This course is a dialogue. The GPT adapts examples to your context, pushes back when you're wrong, and can't be skipped by scrubbing a progress bar. Mastery is tracked by concept demonstrated, not time watched.

The bet is that for a subject like probabilistic thinking — which is about changing how you reason, not memorizing facts — conversation is a better medium than video.

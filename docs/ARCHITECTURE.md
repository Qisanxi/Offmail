# Offmail — Architecture

> Detailed design notes for the Hacktoberfest 2026 DEV post.

## Problem statement

**Arpit** is a job seeker. He sends 20+ LinkedIn connection requests a week. When recruiters and founders accept, he means to reply — but the friction kills the moment. By the time he opens LinkedIn, scrolls to messages, and types each one, the warm lead has gone cold. He loses opportunities he can't afford to lose.

Closed inbox-AI tools (Superhuman, Shortwave, etc.) exist — but they all read your emails on their servers. Arpit's job-search conversations are some of the most private data he has. Handing them to a third party to save 30 seconds isn't a trade he should have to make.

## Solution

**Offmail** is a local-first email triage assistant that runs entirely on Arpit's laptop.

1. Reads his Gmail Social tab via IMAP
2. Detects LinkedIn "connection accepted" emails
3. Drafts warm, personalized replies with **Gemma 3 1B** running locally via Ollama
4. Arpit reviews → approves → queued
5. Background sender flushes the queue via his own Gmail SMTP
6. The reply routes through LinkedIn's `reply-to` email address → lands as a LinkedIn DM

**No central server. No cloud LLM. No API costs. No subscription. Arpit's data stays on Arpit's machine.**

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Vercel (marketing only — no user data)             │
│  Landing page → "Install" → this GitHub repo         │
└─────────────────────────────────────────────────────┘
                       │
                       ▼  user clones & runs locally
┌─────────────────────────────────────────────────────┐
│  User's machine (laptop, 4GB+ RAM)                  │
│                                                      │
│  ┌────────────┐    ┌─────────────┐    ┌─────────┐  │
│  │ React UI   │◄──►│ FastAPI     │◄──►│ Ollama  │  │
│  │ :5173      │    │ backend     │    │ Gemma3  │  │
│  │            │    │ :8000       │    │ :11434  │  │
│  └────────────┘    └──────┬──────┘    └─────────┘  │
│                           │                          │
│                           ▼                          │
│                    ┌─────────────┐                   │
│                    │ SQLite      │ ← drafts queue    │
│                    │ (local DB)  │   + sent history  │
│                    └─────────────┘                   │
└─────────────────────────────────────────────────────┘
                           │
                           ▼  only network calls (user's own Gmail)
                    ┌─────────────┐
                    │ Gmail IMAP  │ ← fetch (Social tab)
                    │ Gmail SMTP  │ → send (routed via LinkedIn reply-to)
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ LinkedIn DM │ (lands as message)
                    └─────────────┘
```

---

## Why this satisfies the Hacktoberfest prompt

The challenge prompt asks four specific questions. Here's how Offmail answers each:

### 1. "Does it run on a laptop with no internet?"
**Yes.** Ollama + Gemma 3 1B run entirely on the user's laptop. Drafting works offline.
The only network calls are IMAP (fetch) and SMTP (send) to the user's own Gmail.
If offline, drafts queue up locally and auto-send when network returns.

### 2. "Keep someone's data off a server they don't control?"
**Yes — completely.** There is no Offmail server. The Vercel landing page is static
marketing HTML with zero backend. Each user runs their own copy of the FastAPI backend
on `localhost:8000`. Their Gmail credentials live in `.env` (gitignored). Their emails and
drafts live in `offmail.db` (gitignored SQLite). No telemetry, no analytics, no call-home.

### 3. "Let you fine-tune, swap models, or change how your agent behaves?"
**Yes.** Any Ollama model works — change `OLLAMA_MODEL` env var:
- `gemma3:1b` (default — eligible for Best Use of Gemma prize)
- `phi3:mini`
- `llama3.2:1b`
- `mistral:7b`
- Any other model Ollama supports

No code changes, no API keys, no subscriptions.

### 4. "Cost nothing to run?"
**Yes.** Every component is free and open source:
- Ollama (MIT license)
- Gemma 3 1B (Gemma license — open weights)
- SQLite (public domain)
- FastAPI (MIT)
- React (MIT)

No API costs. No per-seat licenses. No monthly bills.

### "Tell us where your open-based approach worked better than a closed one."

| Closed approach | Offmail (open) |
|---|---|
| Superhuman: $30/month, reads your emails on their servers | $0/month, reads your emails on your laptop |
| OpenAI GPT-4 API for drafting: $0.01–0.05 per email, data goes to OpenAI | Gemma 3 1B local: $0 per email, data never leaves your machine |
| LinkedIn Sales Navigator: $99/month, cloud-based, doesn't integrate with email flow | Free, integrates directly with Gmail's existing IMAP/SMTP — no LinkedIn API needed |
| Cannot audit how the SaaS uses your data | Code is open on GitHub — read every line |

The open approach **wins on cost, wins on privacy, wins on auditability** — at the cost of slightly slower inference (10-20s per draft on a 4GB laptop, vs 1-2s for GPT-4 API). For a job seeker replying to 20 connection acceptances a week, that 20s wait is fine.

---

## The clever bit: LinkedIn's `reply-to` email trick

This is the technical crux of the project. Here's how it works:

1. When someone accepts your LinkedIn connection request, LinkedIn sends you a notification email.
2. That email's `reply-to` header is set to a unique address like `reply+abc123@linkedin.com`.
3. If you reply via email to that address, LinkedIn routes your reply **as a LinkedIn message to that person**.
4. So: Gmail SMTP → `reply+xxx@linkedin.com` → LinkedIn's internal mail handler → recipient sees a LinkedIn DM.

This means Offmail doesn't need:
- ❌ LinkedIn API access (which doesn't allow sending messages anyway)
- ❌ Scraping LinkedIn (which would violate ToS)
- ❌ Browser automation (which gets accounts banned)

We just send ordinary email — but the email happens to route through LinkedIn's published reply-to mechanism. That's their feature, not our automation. Fully ToS-compliant.

**Caveat (documented honestly in the DEV post):** LinkedIn has been degrading this feature in 2023-2024. Some notification types no longer have a `reply-to` header. Offmail detects this per-email and only offers the auto-send option when a `reply-to` exists. Otherwise, it falls back to "copy-paste this draft into LinkedIn."

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind | Fast dev, type-safe, tiny bundle |
| Backend | FastAPI (Python 3.10+) | Async, lightweight, great for IMAP + LLM I/O |
| LLM runtime | Ollama | One-command model pulls, local-only |
| LLM model | Gemma 3 1B | Open weights, fits 4GB RAM, eligible for Hacktoberfest Gemma prize |
| Database | SQLite (SQLAlchemy ORM) | Zero-config, file-based, perfect for local-first |
| Email | imap-tools + aiosmtplib | Clean async IMAP/SMTP for Python |
| Landing | Static HTML/CSS on Vercel | No backend, no data collection, free hosting |

---

## File structure

```
offmail/
├── README.md                  # project overview + quickstart
├── .env.example               # template for env vars
├── .gitignore                 # excludes .env, *.db, node_modules, __pycache__
├── Makefile                   # `make setup`, `make run`, etc.
│
├── backend/                   # FastAPI Python backend
│   ├── __init__.py
│   ├── main.py               # API routes + lifespan
│   ├── config.py             # env loading (dataclass-based)
│   ├── db.py                 # SQLAlchemy engine + session
│   ├── models.py             # Email, Draft, Contact schemas
│   ├── imap_client.py        # Gmail Social folder polling
│   ├── classifier.py         # regex-based category detection
│   ├── llm.py                # Ollama + Gemma wrapper
│   ├── smtp_sender.py        # Gmail SMTP send
│   ├── queue.py              # background sender loop + offline queue
│   └── requirements.txt
│
├── frontend/                  # React + Vite + TS + Tailwind
│   ├── index.html
│   ├── vite.config.ts        # proxy /api → :8000
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── src/
│       ├── main.tsx          # React entry
│       ├── App.tsx           # main shell
│       ├── index.css        # Tailwind + components
│       ├── lib/api.ts        # typed API client
│       └── components/
│           ├── InboxList.tsx
│           ├── EmailCard.tsx
│           ├── DraftEditor (inline in EmailCard)
│           ├── SendQueue.tsx
│           ├── HealthBar.tsx
│           └── Badges.tsx
│
├── landing/                   # Vercel marketing page
│   ├── index.html            # static HTML
│   ├── styles.css            # custom dark theme
│   └── package.json
│
└── docs/
    └── ARCHITECTURE.md        # this file
```

---

## Roadmap (post-Hacktoberfest)

- **v2** — Tauri-based desktop installer (one-click install instead of clone + make)
- **v2** — System tray daemon (runs in background, polls Gmail every N minutes)
- **v2** — Multi-account support (handle multiple Gmail inboxes)
- **v3** — Mobile companion (React Native + llama.cpp for on-device inference)
- **v3** — Twitter follow-back detection (same pattern, different email source)
- **v3** — GitHub sponsor / star notifications (same pattern)
- **v4** — Calendar integration (draft replies that propose times)

---

## Honesty notes (for the DEV post)

Things that didn't go perfectly — judges respect honesty:

1. **Gemma 3 1B is slow on 4GB RAM.** ~10-20s per draft. We mention this in the UI ("local inference, may take 10-20s on a 4GB laptop") and in the DEV post. It's a feature, not a bug — the privacy tradeoff is worth the wait.

2. **LinkedIn's reply-to feature is degrading.** Not every notification email has a `reply-to` header anymore. We detect this per-email and only offer auto-send when present. Otherwise, fall back to copy-paste.

3. **First-run IMAP setup is fiddly.** Gmail requires app passwords (not your real password). We document this clearly in the README, but it's friction. v2 will use OAuth.

4. **The classifier is regex-based, not LLM-based.** Could use Gemma to classify too, but regex is faster, more predictable, and uses zero tokens. We use the LLM only for drafting — that's where it adds value.

5. **No native installer yet.** v1 is "clone + make run." v2 will be a one-click Tauri installer.

---

## License

MIT. Fork it, ship it, build for your own friend.

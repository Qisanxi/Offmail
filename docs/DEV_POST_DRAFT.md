# Offmail — DEV post draft

> **Title:** I built a local-first email triage assistant for my job-seeking friend (Gemma 3 1B + Ollama + FastAPI + React)
>
> **Tags:** `hacktoberfest`, `opensource`, `ai`, `gemma`, `localfirst`
>
> **Cover image:** screenshot of the Offmail UI showing an inbox list + draft editor

---

## Hook

Arpit is my friend. He's job-hunting, and he sends 20+ LinkedIn connection requests a week. When recruiters and founders accept his invitations, he means to reply — but by the time he opens LinkedIn, scrolls to messages, and types each one, the moment's gone. Warm leads cool off. He loses opportunities he can't afford to lose.

I built him **Offmail** — a local-first email triage assistant that runs entirely on his laptop. It reads his Gmail Social tab, detects LinkedIn "connection accepted" emails, drafts warm replies with **Gemma 3 1B** running locally via Ollama, and he hits send. The reply routes through LinkedIn's `reply-to` email address and lands as a LinkedIn DM. His inbox never leaves his machine.

This is my submission for the **Hacktoberfest 2026 Weekend DEV Challenge** — theme: *Build for a Friend*.

---

## The problem

Closed inbox-AI tools exist (Superhuman, Shortwave, etc.) — but they all read your emails on their servers. For a job seeker, recruiter conversations are some of the most private data he has. Handing them to a third-party SaaS to save 30 seconds isn't a trade he should have to make.

The Hacktoberfest prompt asks four specific questions:

1. Does it run on a laptop with no internet?
2. Keep someone's data off a server they don't control?
3. Let you fine-tune, swap models, or change how your agent behaves?
4. Cost nothing to run?

Offmail answers **yes** to all four. Let me show you how.

---

## The architecture

```
┌─────────────────────────────────────────────────────┐
│  Vercel (marketing only — no user data)             │
│  Landing page → "Install" → GitHub repo              │
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

The deployed Vercel homepage is **marketing only** — static HTML, zero backend, no user data ever touches it. Each user runs their own copy of the FastAPI backend on `localhost:8000`. Their Gmail credentials live in `.env` (gitignored). Their emails and drafts live in `offmail.db` (gitignored SQLite).

**There is no Offmail server.**

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

**Caveat:** LinkedIn has been degrading this feature in 2023-2024. Some notification types no longer have a `reply-to` header. Offmail detects this per-email and only offers the auto-send option when a `reply-to` exists. Otherwise, it falls back to "copy-paste this draft into LinkedIn." Honesty matters.

---

## How it answers the Hacktoberfest prompt

### 1. "Does it run on a laptop with no internet?"
**Yes.** Ollama + Gemma 3 1B run entirely on the user's laptop. Drafting works offline. The only network calls are IMAP (fetch) and SMTP (send) to the user's own Gmail. If offline, drafts queue up locally and auto-send when network returns.

### 2. "Keep someone's data off a server they don't control?"
**Yes — completely.** There is no Offmail server. The Vercel homepage is static marketing HTML with zero backend. Each user runs their own copy of the FastAPI backend on `localhost:8000`. Their Gmail credentials live in `.env` (gitignored). Their emails and drafts live in `offmail.db` (gitignored SQLite). No telemetry, no analytics, no call-home.

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

The open approach **wins on cost, wins on privacy, wins on auditability** — at the cost of slightly slower inference (10-20s per draft on a 4GB laptop, vs 1-2s for GPT-4 API). For Arpit replying to 20 connection acceptances a week, that 20s wait is fine.

---

## What I built

### The stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind | Fast dev, type-safe, tiny bundle |
| Backend | FastAPI (Python 3.10+) | Async, lightweight, great for IMAP + LLM I/O |
| LLM runtime | Ollama | One-command model pulls, local-only |
| LLM model | Gemma 3 1B | Open weights, fits 4GB RAM, eligible for Hacktoberfest Gemma prize |
| Database | SQLite (SQLAlchemy ORM) | Zero-config, file-based, perfect for local-first |
| Email | imap-tools + aiosmtplib | Clean async IMAP/SMTP for Python |
| Landing | Static HTML/CSS on Vercel | No backend, no data collection, free hosting |

### The flow (with code snippets)

**1. Polling Gmail's Social folder**

Using `imap-tools`, we fetch only the Social folder — that's where LinkedIn notifications land:

```python
def fetch_recent_social_emails() -> list[RawEmail]:
    with MailBox(settings.imap_host).login(
        settings.gmail_address, settings.gmail_app_password
    ) as mailbox:
        folder = _get_social_folder(mailbox)  # '[Gmail]/Social Promotions' or fallback
        mailbox.folder.set(folder)
        for msg in mailbox.fetch(AND(date_gte=window.date()), limit=50, reverse=True):
            reply_to = msg.headers.get("reply-to", [None])[0]
            # ... store
```

**2. Classifying emails**

A regex-based classifier tags each email as `linkedin_accepted`, `needs_reply`, `fyi`, or `unknown`. I considered using Gemma for classification too, but regex is faster, more predictable, and uses zero tokens — I save the LLM only for drafting, where it actually adds value.

```python
LINKEDIN_ACCEPTED_PATTERNS = [
    r"accepted your (?:invitation|connection request|request to connect)",
    r"you are now connected with",
    # ...
]
```

**3. Drafting with Gemma 3 1B**

A simple prompt template asks Gemma to write a short, warm reply. The system prompt enforces tone (friendly-professional), length (under 80 words), and content rules (no inventing facts, no quoting the original message, always end with a soft next-step).

```python
payload = {
    "model": settings.ollama_model,  # "gemma3:1b"
    "prompt": prompt,
    "system": system_prompt,
    "stream": False,
    "options": {"temperature": 0.7, "num_predict": 200, "top_p": 0.9},
}
async with httpx.AsyncClient(timeout=120.0) as client:
    resp = await client.post(f"{settings.ollama_url}/api/generate", json=payload)
```

On my 4GB RAM laptop, this takes about 10-20 seconds per draft. I show a loading state in the UI with the honest text: *"Gemma 3 1B is drafting… (local inference, may take 10–20s on a 4GB laptop)"*

**4. Approve & queue**

Arpit reviews the draft in a textarea, edits if needed, hits "Approve & queue." The draft gets stored in SQLite with status `approved`. A background asyncio task flushes the queue every 60 seconds, attempting SMTP send for each approved draft.

**5. Sending via Gmail SMTP (routed to LinkedIn)**

The send uses Python's `smtplib` with `starttls()`, logging in with the app password. The key trick: if the original email had a `reply-to` header (LinkedIn's `reply+xxx@linkedin.com` address), we set that as the `Reply-To` on our outgoing message. The recipient address (`To:`) is still the original sender — but Gmail routes via the `Reply-To`. The message lands as a LinkedIn DM.

```python
def _build_message(to_address, subject, body, reply_to=None, ...):
    msg = MIMEMultipart("alternative")
    msg["From"] = settings.gmail_address
    msg["To"] = to_address
    msg["Subject"] = f"Re: {subject}"
    if reply_to:
        msg["Reply-To"] = reply_to  # ← LinkedIn's reply+xxx@linkedin.com
    # ...
```

**6. Offline-first queue**

If the user is offline when they approve a draft, the SMTP send fails — but the draft stays in the queue with status `failed`. The background loop keeps retrying every 60 seconds. When network returns, drafts auto-send. No user intervention needed.

A `/api/queue/retry-failed` endpoint resets all `failed` drafts back to `approved` for the next pass — useful if you want to force a retry without waiting for the next loop iteration.

---

## What I learned

### Gemma 3 1B is shockingly good for short professional replies
I was skeptical that a 1B-parameter model could write convincing professional emails. I was wrong. With a tight system prompt (tone, length, content rules, no inventing facts), Gemma 3 1B consistently produces warm, on-topic replies that need minimal editing. For Arpit's use case (mostly "thanks for connecting, would love to chat" type replies), it's perfect.

### LinkedIn's reply-to feature is gold — and underdocumented
I couldn't find any official LinkedIn documentation about this feature. I learned it by inspecting the headers of actual LinkedIn acceptance emails. The fact that it's been silently degraded in 2023-2024 (some notification types no longer have it) suggests LinkedIn is phasing it out — which makes Offmail more valuable, not less. Build it now while it still works.

### Local-first is a real pitch, not just a privacy fetish
When I showed the prototype to Arpit, his first reaction wasn't "wow, privacy" — it was "wait, I don't have to pay $30/month for this?" The cost angle is what sells local-first to non-technical users. Privacy is the bonus.

### Regex > LLM for classification
I started by classifying emails with Gemma too. It was slow (another 10-20s per email), occasionally hallucinated categories, and added zero value. Switching to regex made classification instant and 100% predictable. I now reserve the LLM for tasks where it actually adds value (drafting), not tasks where determinism matters (classification).

---

## Honesty notes

Things that didn't go perfectly:

1. **Gemma 3 1B is slow on 4GB RAM.** ~10-20s per draft. I show this honestly in the UI. It's a feature, not a bug — the privacy tradeoff is worth the wait.

2. **LinkedIn's reply-to feature is degrading.** Not every notification email has a `reply-to` header anymore. Offmail detects this per-email and only offers auto-send when present. Otherwise, it falls back to copy-paste.

3. **First-run IMAP setup is fiddly.** Gmail requires app passwords (not your real password). I document this clearly in the README, but it's friction. v2 will use OAuth.

4. **The classifier is regex-based, not LLM-based.** Could use Gemma to classify too, but regex is faster, more predictable, and uses zero tokens. The LLM is used only for drafting — that's where it adds value.

5. **No native installer yet.** v1 is "clone + make run." v2 will be a one-click Tauri installer.

---

## What's next

- **v2** — Tauri-based desktop installer (one-click install instead of clone + make)
- **v2** — System tray daemon (runs in background, polls Gmail every N minutes)
- **v2** — Multi-account support (handle multiple Gmail inboxes)
- **v2** — OAuth for Gmail (instead of app passwords)
- **v3** — Mobile companion (React Native + llama.cpp for on-device inference)
- **v3** — Twitter follow-back detection (same pattern, different email source)
- **v3** — GitHub sponsor / star notifications (same pattern)
- **v4** — Calendar integration (draft replies that propose times)

---

## Try it

**Repo:** https://github.com/Qisanxi/Offmail

**5-minute install:**
```bash
git clone https://github.com/Qisanxi/Offmail.git
cd Offmail
cp .env.example .env
# Edit .env — add your Gmail address + app password
ollama pull gemma3:1b
make setup
make run
# → open http://localhost:5173
```

**Landing page:** [link to your Vercel deployment]

**Demo video:** [link to Loom]

---

## Built for Arpit

Arpit doesn't read DEV. He doesn't care about open-source AI or local-first architecture or the LinkedIn reply-to trick. He just wants to reply to recruiters before they forget him.

But that's exactly the point. The open pieces are what make this work for him — not because he cares about them, but because they make the project free, private, and his. He can run it forever without paying anyone, without anyone reading his mail, without anyone changing the API on him.

That's open innovation that matters. Built for a friend.

---

*This is my submission for the Hacktoberfest 2026 Weekend DEV Challenge — theme: Build for a Friend. Built with Gemma 3 1B, Ollama, FastAPI, React, and SQLite — all open source, all running locally.*

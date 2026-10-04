"""Ollama + Gemma 3 1B wrapper for draft generation."""
from __future__ import annotations

import json
from typing import Optional

import httpx

from .config import settings


SYSTEM_PROMPT = """You are Offmail, a writing assistant that helps a job seeker named Arpit draft short, warm replies to LinkedIn connection acceptance emails and other professional messages.

Rules:
- Keep replies under {max_words} words.
- Tone: {tone} — warm, professional, never salesy.
- Reference a specific detail from the email body if relevant (job title, shared interest, etc.).
- Always end with a soft next-step (e.g. "happy to chat next week", "what's a good time to catch up?").
- Never invent facts. If you don't know something, leave it out.
- Never include the original message or quote it back.
- Output ONLY the reply body, no preamble, no subject line, no signature.
""".strip()


LINKEDIN_ACCEPTED_TEMPLATE = """Draft a short reply to this LinkedIn acceptance email.

Sender name: {name}
Sender email: {email}
Subject: {subject}
Email body: {body}

The reply will be sent via Gmail SMTP, routed through LinkedIn's reply-to email address, and will land as a LinkedIn message to {name}.

Write the reply body only."""


NEEDS_REPLY_TEMPLATE = """Draft a short professional reply to this email.

Sender name: {name}
Sender email: {email}
Subject: {subject}
Email body: {body}

Write the reply body only."""


def _build_prompt(category: str, name: str, email_addr: str, subject: str, body: str) -> str:
    template = (
        LINKEDIN_ACCEPTED_TEMPLATE
        if category == "linkedin_accepted"
        else NEEDS_REPLY_TEMPLATE
    )
    return template.format(
        name=name or "the recruiter",
        email=email_addr,
        subject=subject or "(no subject)",
        body=body[:1500] if body else "(empty)",
    )


async def generate_draft(
    category: str,
    contact_name: str,
    from_address: str,
    subject: str,
    body: str,
) -> str:
    """Call Ollama to generate a draft reply. Raises on error."""
    if not settings.ollama_url:
        raise RuntimeError("OLLAMA_URL not configured.")

    prompt = _build_prompt(category, contact_name, from_address, subject, body)
    system = SYSTEM_PROMPT.format(
        max_words=settings.draft_max_words,
        tone=settings.draft_tone,
    )

    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_predict": 200,
            "top_p": 0.9,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                f"{settings.ollama_url}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
        except httpx.ConnectError as e:
            raise RuntimeError(
                f"Cannot reach Ollama at {settings.ollama_url}. "
                "Is `ollama serve` running? Install: https://ollama.ai"
            ) from e

        data = resp.json()
        text = data.get("response", "").strip()

    # Append signature
    if settings.signature:
        text = f"{text}\n\n{settings.signature}"

    return text


async def check_ollama_health() -> dict:
    """Return health info about Ollama + the configured model."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{settings.ollama_url}/api/tags")
            resp.raise_for_status()
            data = resp.json()
        models = [m.get("name", "") for m in data.get("models", [])]
        has_model = any(settings.ollama_model in m for m in models)
        return {
            "status": "ok" if has_model else "model_not_pulled",
            "url": settings.ollama_url,
            "configured_model": settings.ollama_model,
            "available_models": models,
            "needs_pull": settings.ollama_model if not has_model else None,
        }
    except Exception as e:
        return {
            "status": "unreachable",
            "url": settings.ollama_url,
            "error": str(e),
        }

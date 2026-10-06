import { useEffect, useMemo, useState } from "react";
import { api as realApi } from "../lib/api";
import * as demoApi from "../lib/demo-api";
import { DraftStatusBadge } from "./Badges";

const _resolveApi = (demo) => (demo ? demoApi.api : realApi);

const WORD_LIMIT = 80;
const REGEN_VARIANTS = [
  { key: "shorter", label: "Shorter" },
  { key: "warmer", label: "Warmer" },
  { key: "more_formal", label: "Formal" },
  { key: "more_casual", label: "Casual" },
];

// Props:
//   email: EmailOut | null
//   onDraftUpdated: () => void
//   onBack: () => void   (mobile: return to the list)
export function EmailCard({ email, onDraftUpdated, onBack, demo = false }) {
  const api = _resolveApi(demo);
  const [draft, setDraft] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [draftStatus, setDraftStatus] = useState(null);
  const [draftSentAt, setDraftSentAt] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [regenVariant, setRegenVariant] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(email?.draft_body || "");
    setDraftId(email?.draft_id || null);
    setDraftStatus(email?.draft_status || null);
    setDraftSentAt(null);
    setError(null);
    setEditing(false);
    setCopied(false);
  }, [email?.id]);

  const wordCount = useMemo(
    () => (draft.trim() ? draft.trim().split(/\s+/).length : 0),
    [draft]
  );

  if (!email) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8" style={{ color: "var(--color-ink-muted)" }}>
        <p className="prose-text text-xl" style={{ color: "var(--color-ink)" }}>
          No email selected
        </p>
        <p className="text-xs mt-2">
          <kbd>j</kbd> and <kbd>k</kbd> move between emails
        </p>
      </div>
    );
  }

  async function handleGenerate() {
    if (!email) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generateDraft(email.id);
      setDraft(result.body);
      setDraftId(result.id);
      setDraftStatus(result.status);
      setDraftSentAt(result.sent_at);
      onDraftUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(variant) {
    if (!email) return;
    setRegenVariant(variant);
    setError(null);
    try {
      const result = await api.regenerateDraft(email.id, variant, draft);
      setDraft(result.body);
      setDraftId(result.id);
      setDraftStatus(result.status);
      setDraftSentAt(result.sent_at);
      onDraftUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setRegenVariant(null);
    }
  }

  async function handleApprove() {
    if (!draftId) return;
    setSending(true);
    setError(null);
    try {
      const result = await api.approveDraft(draftId, draft);
      setDraftStatus(result.status);
      setDraftSentAt(result.sent_at);
      setEditing(false);
      onDraftUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleReject() {
    if (!draftId) return;
    setError(null);
    try {
      const result = await api.rejectDraft(draftId);
      setDraftStatus(result.status);
      onDraftUpdated();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard not available — select the text and copy manually.");
    }
  }

  const isSent = draftStatus === "sent";
  const isApproved = draftStatus === "approved";
  const isRejected = draftStatus === "rejected";
  const isDead = draftStatus === "dead";
  const showGenerate = (!draft || isRejected) && !generating;
  // Older backends don't send the flag; only an explicit false blocks sending.
  const canAutoSend = email.safe_to_auto_send !== false;
  const busy = generating || sending || !!regenVariant;
  const name = email.contact_name || email.from_name || email.from_address;
  const sub = email.contact_headline || (email.category === "linkedin_accepted" ? "" : email.subject);

  return (
    <article className="max-w-2xl mx-auto px-5 sm:px-8 py-6">
      {onBack && (
        <button onClick={onBack} className="btn-ghost text-xs -ml-2 mb-3 lg:hidden">
          ← Inbox
        </button>
      )}

      {/* Who it's from */}
      <header className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h2 className="prose-text text-3xl leading-tight" style={{ color: "var(--color-ink-strong)", fontWeight: 500 }}>
            {name}
          </h2>
          {sub && (
            <p className="text-sm mt-1" style={{ color: "var(--color-ink-muted)" }}>
              {sub}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 pt-1.5">
          <DraftStatusBadge status={draftStatus} />
          <time className="time-quiet" dateTime={email.received_at}>
            {new Date(email.received_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        </div>
      </header>

      {/* What they wrote */}
      <blockquote
        className="prose-text text-[0.9375rem] pl-4 mb-5 max-h-32 overflow-y-auto whitespace-pre-wrap"
        style={{ borderLeft: "2px solid var(--color-border)", color: "var(--color-ink-muted)" }}
      >
        {email.body_snippet || "(empty body)"}
      </blockquote>

      {/* Where the reply goes, shown before you approve */}
      <p
        className={`alert-inline ${canAutoSend ? "alert-info" : "alert-warn"} mb-4`}
        style={{ alignItems: "center" }}
      >
        <span aria-hidden="true">{canAutoSend ? "→" : "!"}</span>
        <span>
          <strong>{email.destination_label}</strong>
          {!canAutoSend && " — copy the draft and send it yourself."}
        </span>
      </p>

      {error && (
        <div className="alert-inline alert-error mb-3" role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      )}

      {showGenerate && (
        <button onClick={handleGenerate} className="btn-primary" disabled={isSent || isApproved || isDead}>
          {isRejected ? "Write a new draft" : "Draft a reply"}
        </button>
      )}

      {generating && (
        <p className="text-sm animate-pulse" style={{ color: "var(--color-ink-muted)" }}>
          Drafting… usually 10–20 seconds.
        </p>
      )}
      {regenVariant && !generating && (
        <p className="text-sm animate-pulse" style={{ color: "var(--color-ink-muted)" }}>
          Rewriting ({regenVariant.replace("_", " ")})…
        </p>
      )}

      {/* The draft */}
      {draft && !isRejected && (
        <>
          <div className="sheet p-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!editing || isSent || isApproved}
              className="w-full px-4 py-3 rounded-lg prose-text bg-transparent"
              style={{
                fontSize: "1.0625rem",
                color: "var(--color-ink)",
                minHeight: "9rem",
                resize: "vertical",
                border: "none",
              }}
              aria-label="Draft reply"
            />
          </div>

          <div className="flex items-center justify-between gap-2 mt-2 mb-5">
            <div className="flex flex-wrap items-center gap-0.5 -ml-2" role="group" aria-label="Edit or rewrite the draft">
              {!isSent && !isDead && !isApproved && (
                <>
                  {!editing && (
                    <button onClick={() => setEditing(true)} className="btn-ghost text-xs" disabled={busy}>
                      Edit
                    </button>
                  )}
                  {REGEN_VARIANTS.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => handleRegenerate(v.key)}
                      className="btn-ghost text-xs"
                      disabled={busy}
                      title={`Rewrite: ${v.label.toLowerCase()}`}
                    >
                      {regenVariant === v.key ? "…" : v.label}
                    </button>
                  ))}
                </>
              )}
            </div>
            <span className={`word-counter ${wordCount > WORD_LIMIT ? "word-counter-over" : ""}`}>
              {wordCount}/{WORD_LIMIT}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isSent && !isDead && (
              <>
                <button
                  onClick={handleApprove}
                  className="btn-primary"
                  disabled={busy || (isApproved && !editing) || !canAutoSend}
                  title={canAutoSend ? undefined : "This reply can't be sent automatically. Use Copy."}
                >
                  {sending ? "Queuing…" : isApproved ? "Queued" : "Approve & queue"}
                </button>
                {!canAutoSend && (
                  <button onClick={handleCopy} className="btn-secondary" disabled={busy}>
                    {copied ? "Copied" : "Copy draft"}
                  </button>
                )}
                <button onClick={handleReject} className="btn-ghost" disabled={busy}>
                  Dismiss
                </button>
              </>
            )}
            {isSent && (
              <p className="text-sm flex items-center gap-2" style={{ color: "var(--color-success)" }}>
                <span className="status-dot-ok" aria-hidden="true" />
                Sent{draftSentAt ? ` ${new Date(draftSentAt).toLocaleString()}` : ""}
              </p>
            )}
            {isDead && (
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                Couldn&rsquo;t send after several tries. Use Retry in the outbox.
              </p>
            )}
          </div>
        </>
      )}

      {isRejected && (
        <p className="text-sm mt-3" style={{ color: "var(--color-ink-muted)" }}>
          Dismissed.
        </p>
      )}
    </article>
  );
}

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { DraftStatusBadge } from "./Badges";

const WORD_LIMIT = 80;
const REGEN_VARIANTS = [
  { key: "shorter", label: "Shorter" },
  { key: "warmer", label: "Warmer" },
  { key: "more_formal", label: "More formal" },
  { key: "more_casual", label: "More casual" },
];

// Props:
//   email: EmailOut | null
//   onDraftUpdated: () => void
export function EmailCard({ email, onDraftUpdated }) {
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
      <div className="card p-8 text-center" style={{ color: "var(--color-ink-muted)" }}>
        <p className="text-sm">Select an email to view details.</p>
        <p className="text-xs mt-1" style={{ color: "var(--color-ink-faint)" }}>
          Or press <kbd className="font-mono">j</kbd> / <kbd className="font-mono">k</kbd> to move between rows.
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
  const canAutoSend = email.safe_to_auto_send;

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <DraftStatusBadge status={draftStatus} />
            <span className="label" style={{ background: "transparent", padding: 0 }}>
              {email.category === "linkedin_accepted"
                ? "LinkedIn acceptance"
                : email.category === "needs_reply"
                ? "Needs your reply"
                : email.category === "fyi"
                ? "FYI"
                : "Email"}
            </span>
          </div>
          <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--color-ink-strong)" }}>
            {email.contact_name || email.from_name || email.from_address}
          </h2>
          {email.contact_headline && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
              {email.contact_headline}
            </p>
          )}
          {email.subject && (
            <p className="text-xs mt-0.5 italic" style={{ color: "var(--color-ink-faint)" }}>
              {email.subject}
            </p>
          )}
        </div>
        <div className="time-quiet shrink-0">
          {new Date(email.received_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Original email body */}
      <div
        className="rounded p-3 mb-4 prose-text"
        style={{
          background: "var(--color-bg-soft)",
          color: "var(--color-ink)",
          fontSize: "0.875rem",
          maxHeight: "10rem",
          overflowY: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {email.body_snippet || "(empty body)"}
      </div>

      {/* Destination preview — shown BEFORE approve, so user knows where it goes */}
      <div
        className="rounded p-2.5 mb-3 text-xs flex items-center gap-2"
        style={{
          background: canAutoSend ? "var(--color-accent-soft)" : "var(--color-warning-soft)",
          color: canAutoSend ? "var(--color-accent)" : "var(--color-warning)",
          border: `1px solid ${canAutoSend ? "var(--color-accent)" : "var(--color-warning)"}`,
        }}
      >
        <span aria-hidden="true" style={{ fontWeight: 700 }}>→</span>
        <span>
          <strong>{email.destination_label}</strong>
          {!canAutoSend && (
            <>
              {" "}
              &mdash; use the <em>Copy</em> button below and paste manually into LinkedIn.
            </>
          )}
        </span>
      </div>

      {/* Draft header + Generate button */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
          Draft reply
        </h3>
        {showGenerate && (
          <button
            onClick={handleGenerate}
            className="btn-secondary text-xs"
            disabled={isSent || isApproved || isDead}
          >
            {isRejected ? "Regenerate" : "Generate draft"}
          </button>
        )}
      </div>

      {/* Inline error */}
      {error && (
        <div className="alert-inline alert-error mb-3" role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Draft editor */}
      {draft && !isRejected && (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!editing || isSent || isApproved}
            className="w-full p-3 border rounded prose-text"
            style={{
              borderColor: "var(--color-border)",
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              color: "var(--color-ink)",
              minHeight: "8rem",
              resize: "vertical",
              background: editing ? "var(--color-surface)" : "var(--color-surface-elevated)",
            }}
            placeholder="Draft will appear here…"
            aria-label="Draft reply — editable"
          />

          {/* Word counter */}
          <div className="flex items-center justify-between mt-1.5 mb-2">
            <div className="flex gap-1.5">
              {!isSent && !isRejected && !isDead && draft && (
                <>
                  {!editing && !isApproved && (
                    <button
                      onClick={() => setEditing(true)}
                      className="btn-ghost text-xs"
                      disabled={generating || sending || !!regenVariant}
                    >
                      Edit
                    </button>
                  )}
                  {/* Regenerate chips */}
                  <div className="flex gap-1" role="group" aria-label="Regenerate draft">
                    {REGEN_VARIANTS.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => handleRegenerate(v.key)}
                        className="btn-ghost text-xs"
                        disabled={generating || sending || !!regenVariant || isApproved}
                        title={`Regenerate as ${v.label.toLowerCase()}`}
                      >
                        {regenVariant === v.key ? "…" : v.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <span className={`word-counter ${wordCount > WORD_LIMIT ? "word-counter-over" : ""}`}>
              {wordCount} / {WORD_LIMIT} words
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!isSent && !isRejected && !isDead && (
              <>
                <button
                  onClick={handleApprove}
                  className="btn-primary text-sm"
                  disabled={generating || sending || (isApproved && !editing) || !!regenVariant}
                >
                  {sending ? "Queuing…" : isApproved ? "Re-approve" : "Approve &amp; queue"}
                </button>
                {!canAutoSend && (
                  <button
                    onClick={handleCopy}
                    className="btn-secondary text-sm"
                    disabled={generating || sending}
                  >
                    {copied ? "Copied" : "Copy draft"}
                  </button>
                )}
                <button
                  onClick={handleReject}
                  className="btn-ghost text-sm"
                  disabled={generating || sending}
                >
                  Dismiss
                </button>
              </>
            )}
            {isSent && (
              <div className="text-sm flex items-center gap-2" style={{ color: "var(--color-success)" }}>
                <span className="status-dot-ok" aria-hidden="true" />
                Sent {draftSentAt ? new Date(draftSentAt).toLocaleString() : ""}
              </div>
            )}
            {isRejected && (
              <div className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
                Dismissed &mdash; click Regenerate to try again.
              </div>
            )}
            {isDead && (
              <div className="text-sm" style={{ color: "var(--color-danger)" }}>
                Failed after multiple attempts. Click &ldquo;Retry&rdquo; in the outbox panel.
              </div>
            )}
          </div>

          {isApproved && !isSent && (
            <div className="alert-inline alert-info mt-3 text-xs">
              <span aria-hidden="true">●</span>
              <span>
                Queued for send. The outbox will deliver via your own Gmail SMTP within ~60s.
                If you&rsquo;re offline, drafts auto-send when your connection returns.
              </span>
            </div>
          )}
        </>
      )}

      {/* Generating state */}
      {generating && (
        <div
          className="rounded p-3 text-sm animate-pulse"
          style={{ background: "var(--color-bg-soft)", color: "var(--color-ink-muted)" }}
        >
          Gemma 3 1B is drafting&hellip; (local inference, 10&ndash;20s on a 4GB laptop)
        </div>
      )}
      {regenVariant && !generating && (
        <div
          className="rounded p-3 text-sm animate-pulse"
          style={{ background: "var(--color-bg-soft)", color: "var(--color-ink-muted)" }}
        >
          Regenerating as {regenVariant.replace("_", " ")}&hellip;
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { CategoryBadge, DraftStatusBadge } from "./Badges";

// Props:
//   email: EmailOut | null
//   onDraftUpdated: () => void
export function EmailCard({ email, onDraftUpdated }) {
  const [draft, setDraft] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [draftStatus, setDraftStatus] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(email?.draft_body || "");
    setDraftId(email?.draft_id || null);
    setDraftStatus(email?.draft_status || null);
    setError(null);
    setEditing(false);
  }, [email?.id]);

  if (!email) {
    return (
      <div className="card p-8 text-center text-slate-500">
        <p>Select an email to view details</p>
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
      onDraftUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove() {
    if (!draftId) return;
    setSending(true);
    setError(null);
    try {
      const result = await api.approveDraft(draftId, draft);
      setDraftStatus(result.status);
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

  const isSent = draftStatus === "sent";
  const isApproved = draftStatus === "approved";
  const isRejected = draftStatus === "rejected";

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CategoryBadge category={email.category} />
            <DraftStatusBadge status={draftStatus} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {email.subject || "(no subject)"}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            From{" "}
            <span className="font-medium">
              {email.contact_name || email.from_name || email.from_address}
            </span>
            {email.reply_to && (
              <span className="text-xs text-slate-400 ml-2">
                · reply-to: {email.reply_to}
              </span>
            )}
          </p>
        </div>
        <div className="text-xs text-slate-400">
          {new Date(email.received_at).toLocaleString()}
        </div>
      </div>

      <div className="bg-slate-50 rounded p-3 mb-4 text-sm text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
        {email.body_snippet || "(empty body)"}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Draft reply</h3>
        {!draft && !generating && (
          <button
            onClick={handleGenerate}
            className="btn-secondary"
            disabled={isSent || isApproved || isRejected}
          >
            ✨ Generate draft
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded p-3 mb-3 text-sm">
          {error}
        </div>
      )}

      {draft && (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!editing || isSent || isApproved}
            className="w-full h-40 p-3 border border-slate-200 rounded font-mono text-sm resize-y disabled:bg-slate-50"
            placeholder="Draft will appear here…"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {!isSent && !isRejected && (
              <>
                {!editing && !isApproved && (
                  <button
                    onClick={() => setEditing(true)}
                    className="btn-secondary"
                    disabled={generating || sending}
                  >
                    ✏️ Edit
                  </button>
                )}
                <button
                  onClick={handleApprove}
                  className="btn-primary"
                  disabled={generating || sending || (isApproved && !editing)}
                >
                  {sending ? "Queuing…" : isApproved ? "Re-approve" : "Approve & queue for send"}
                </button>
                <button
                  onClick={handleReject}
                  className="btn-ghost"
                  disabled={generating || sending}
                >
                  Dismiss
                </button>
              </>
            )}
            {isSent && (
              <div className="text-sm text-emerald-700">
                ✅ Sent {new Date().toLocaleString()}
              </div>
            )}
            {isRejected && (
              <div className="text-sm text-slate-500">Dismissed</div>
            )}
          </div>

          {isApproved && !isSent && (
            <div className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">
              Queued for send. Background loop will attempt SMTP delivery within ~60s.
              If you're offline, drafts auto-send when network returns.
            </div>
          )}
        </>
      )}

      {generating && (
        <div className="text-sm text-slate-500 bg-slate-50 rounded p-3 animate-pulse">
          Gemma 3 1B is drafting… (local inference, may take 10–20s on a 4GB laptop)
        </div>
      )}
    </div>
  );
}

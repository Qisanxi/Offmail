import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { DraftStatusBadge } from "./Badges";

// Outbox — the one distinctive element of Offmail.
// Collapsible. Airmail-striped edge animates while a draft is actively sending.
// Shows online/offline state. When offline with queued drafts: "X replies waiting for a connection".
//
// Props:
//   refreshKey: number — bump to trigger a reload
//   isOnline: boolean — from AppPage's online/offline detection
//   isSending: boolean — true when background loop is mid-send (animates the edge)
export function Outbox({ refreshKey, isOnline, isSending }) {
  const [drafts, setDrafts] = useState([]);
  const [flushing, setFlushing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function load() {
    try {
      const [approved, sending, sent, failed, dead] = await Promise.all([
        api.listDrafts("approved"),
        api.listDrafts("sending"),
        api.listDrafts("sent"),
        api.listDrafts("failed"),
        api.listDrafts("dead"),
      ]);
      // Sort: in-flight first, then approved (queued), then failed/dead, then sent
      const ordered = [
        ...sending,
        ...approved,
        ...failed,
        ...dead,
        ...sent,
      ].slice(0, 20);
      setDrafts(ordered);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function handleFlush() {
    setFlushing(true);
    try {
      await api.flushQueue();
      await load();
    } finally {
      setFlushing(false);
    }
  }

  async function handleRetry() {
    await api.retryFailed();
    await load();
  }

  const queuedCount = drafts.filter(
    (d) => d.status === "approved" || d.status === "sending"
  ).length;
  const failedCount = drafts.filter(
    (d) => d.status === "failed" || d.status === "dead"
  ).length;

  // Header label: shows what's happening right now
  let statusLabel = "Empty";
  if (isSending) statusLabel = "Sending…";
  else if (!isOnline && queuedCount > 0)
    statusLabel = `${queuedCount} waiting for a connection`;
  else if (queuedCount > 0) statusLabel = `${queuedCount} queued`;
  else if (failedCount > 0) statusLabel = `${failedCount} failed`;

  const edgeClass = isSending ? "airmail-edge-animating" : "";

  return (
    <div className={`card overflow-hidden ${edgeClass}`} style={{ borderTop: "none", borderBottom: "none" }}>
      {/* Airmail edge — visible top + bottom when sending, otherwise just left marker */}
      {isSending && (
        <>
          <div style={{ height: 4, background: "var(--airmail-stripe)", backgroundSize: "48px 100%" }} className="airmail-edge-animating" />
        </>
      )}

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity"
            aria-expanded={!collapsed}
            aria-controls="outbox-content"
          >
            <span className="text-xs" aria-hidden="true">
              {collapsed ? "▸" : "▾"}
            </span>
            <span>Outbox</span>
            <span className="label" style={{ background: "transparent", padding: 0 }}>
              {statusLabel}
            </span>
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={handleFlush}
              className="btn-ghost text-xs"
              disabled={flushing || queuedCount === 0}
              title="Flush queue now"
            >
              {flushing ? "Flushing…" : "Send now"}
            </button>
            {failedCount > 0 && (
              <button
                onClick={handleRetry}
                className="btn-ghost text-xs"
                title="Retry failed drafts"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Online/offline indicator */}
        {!isOnline && (
          <div className="alert-inline alert-info mb-2 text-xs">
            <span aria-hidden="true">●</span>
            <span>
              You&rsquo;re offline. Approved drafts will send automatically when your connection returns.
            </span>
          </div>
        )}

        {!collapsed && (
          <ul id="outbox-content" className="space-y-1.5">
            {drafts.length === 0 && (
              <li className="text-xs py-2 text-center" style={{ color: "var(--color-ink-faint)" }}>
                No drafts queued.
              </li>
            )}
            {drafts.map((d) => (
              <li
                key={d.id}
                className="border rounded p-2 text-xs"
                style={{ borderColor: "var(--color-border-soft)" }}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <DraftStatusBadge status={d.status} />
                  <span className="time-quiet">
                    {d.status === "sent" && d.sent_at
                      ? `sent ${formatRelative(d.sent_at)}`
                      : `queued ${formatRelative(d.created_at)}`}
                  </span>
                </div>
                <div
                  className="prose-text"
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-ink)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {d.body}
                </div>
                {d.error_message && (
                  <div className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                    {d.error_message}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isSending && (
        <div style={{ height: 4, background: "var(--airmail-stripe)", backgroundSize: "48px 100%" }} className="airmail-edge-animating" />
      )}
    </div>
  );
}

// Compact relative time formatter — "just now", "5m ago", "3h ago", "2d ago", else "MMM D"
function formatRelative(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (isNaN(then)) return "";
  const now = new Date();
  const diffMs = now - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

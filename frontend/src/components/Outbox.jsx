import { useEffect, useState } from "react";
import { api as realApi } from "../lib/api";
import * as demoApi from "../lib/demo-api";
import { DraftStatusBadge } from "./Badges";

const _resolveApi = (demo) => (demo ? demoApi.api : realApi);

// Outbox — the one distinctive element of Offmail. It sits at the bottom of the
// inbox rail. The airmail strip on its top edge is dim at rest and only moves
// while a reply is actually being sent.
//
// Props: refreshKey (bump to reload), isOnline, isSending, demo (use mock API)
export function Outbox({ refreshKey, isOnline, isSending, demo = false }) {
  const api = _resolveApi(demo);
  const [drafts, setDrafts] = useState([]);
  const [flushing, setFlushing] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    try {
      const [approved, sending, sent, failed, dead] = await Promise.all([
        api.listDrafts("approved"),
        api.listDrafts("sending"),
        api.listDrafts("sent"),
        api.listDrafts("failed"),
        api.listDrafts("dead"),
      ]);
      // In flight first, then queued, then problems, then sent
      setDrafts([...sending, ...approved, ...failed, ...dead, ...sent].slice(0, 20));
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

  const queued = drafts.filter((d) => d.status === "approved" || d.status === "sending").length;
  const failed = drafts.filter((d) => d.status === "failed" || d.status === "dead").length;

  let state = "Nothing waiting";
  if (isSending) state = "Sending";
  else if (!isOnline && queued > 0) state = `Offline, ${queued} waiting`;
  else if (queued > 0) state = `${queued} queued`;
  else if (failed > 0) state = `${failed} failed`;
  else if (!isOnline) state = "Offline";

  return (
    <section aria-label="Outbox">
      <div className={`airmail-strip ${isSending ? "airmail-strip-live" : ""}`} aria-hidden="true" />

      <div className="px-4 py-2.5 flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold min-w-0"
          aria-expanded={open}
          aria-controls="outbox-list"
        >
          <span aria-hidden="true" className="text-[10px]" style={{ color: "var(--color-ink-faint)" }}>
            {open ? "▾" : "▸"}
          </span>
          Outbox
          <span className="text-xs font-normal truncate" style={{ color: "var(--color-ink-muted)" }}>
            {state}
          </span>
        </button>
        <div className="flex gap-1 shrink-0">
          {queued > 0 && (
            <button onClick={handleFlush} className="btn-ghost text-xs" disabled={flushing || !isOnline}>
              {flushing ? "Sending…" : "Send now"}
            </button>
          )}
          {failed > 0 && (
            <button onClick={handleRetry} className="btn-ghost text-xs">
              Retry
            </button>
          )}
        </div>
      </div>

      {open && drafts.length > 0 && (
        <ul id="outbox-list" className="px-4 pb-3 space-y-2 max-h-52 overflow-y-auto">
          {drafts.map((d) => (
            <li key={d.id} className="text-xs">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <DraftStatusBadge status={d.status} />
                <span className="time-quiet">
                  {d.status === "sent" && d.sent_at ? formatRelative(d.sent_at) : formatRelative(d.created_at)}
                </span>
              </div>
              <p
                className="prose-text"
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--color-ink-muted)",
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {d.body}
              </p>
              {d.error_message && (
                <p className="mt-0.5" style={{ color: "var(--color-danger)" }}>
                  {d.error_message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// "just now", "5m ago", "3h ago", "2d ago", else "Oct 4"
function formatRelative(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (isNaN(then)) return "";
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

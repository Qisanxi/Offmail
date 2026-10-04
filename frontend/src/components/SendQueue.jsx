import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { DraftStatusBadge } from "./Badges";

// Props:
//   refreshKey: number  — increment to trigger a reload
export function SendQueue({ refreshKey }) {
  const [drafts, setDrafts] = useState([]);
  const [flushing, setFlushing] = useState(false);

  async function load() {
    try {
      const [approved, sent, failed] = await Promise.all([
        api.listDrafts("approved"),
        api.listDrafts("sent"),
        api.listDrafts("failed"),
      ]);
      setDrafts([...approved, ...failed, ...sent].slice(0, 30));
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

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Send queue</h3>
        <div className="flex gap-2">
          <button
            onClick={handleFlush}
            className="btn-secondary text-xs"
            disabled={flushing}
          >
            {flushing ? "Flushing…" : "Flush now"}
          </button>
          <button onClick={handleRetry} className="btn-ghost text-xs">
            Retry failed
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <p className="text-xs text-slate-500">Queue is empty.</p>
      ) : (
        <ul className="space-y-2">
          {drafts.map((d) => (
            <li key={d.id} className="border border-slate-100 rounded p-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <DraftStatusBadge status={d.status} />
                <span className="text-slate-400">
                  {new Date(d.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-slate-700 line-clamp-2">{d.body}</div>
              {d.error_message && (
                <div className="text-rose-600 mt-1">Error: {d.error_message}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

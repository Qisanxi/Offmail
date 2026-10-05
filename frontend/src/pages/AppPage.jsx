import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { EmailCard } from "../components/EmailCard";
import { InboxList } from "../components/InboxList";
import { SendQueue } from "../components/SendQueue";
import { HealthBar } from "../components/HealthBar";

const CATEGORY_LABELS = {
  all: "All",
  linkedin_accepted: "LinkedIn accepted",
  needs_reply: "Needs reply",
  fyi: "FYI",
  unknown: "Unknown",
};

export function AppPage() {
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // AbortController for in-flight email loads — prevents out-of-order responses
  const loadAbortRef = useRef(null);

  const loadEmails = useCallback(async () => {
    // Cancel any in-flight request
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    try {
      const list = await api.listEmails(filter === "all" ? undefined : filter, controller.signal);
      if (!controller.signal.aborted) {
        setEmails(list);
        // If we have a selected email, refresh it from the new list so its
        // draft state stays in sync (e.g. after a draft is generated elsewhere)
        setSelected((prev) => {
          if (!prev) return prev;
          const updated = list.find((e) => e.id === prev.id);
          return updated || prev;
        });
      }
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
    }
  }, [filter]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.stats());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  // Periodic refresh of stats + queue while drafts are pending (so user
  // sees when the background loop sends them)
  useEffect(() => {
    if (!stats || stats.approved_pending_send === 0 && stats.failed === 0 && stats.sending === 0) return;
    const t = setInterval(() => {
      loadStats();
      setRefreshKey((k) => k + 1);
    }, 15000);
    return () => clearInterval(t);
  }, [stats, loadStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshInbox();
      await loadEmails();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      alert(`Refresh failed: ${e.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelect = (email) => {
    setSelected(email);
  };

  const handleDraftUpdated = () => {
    loadEmails();
    loadStats();
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
              OM
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Offmail</h1>
              <p className="text-xs text-slate-500">
                Local-first email triage · built for Arpit
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="hidden md:flex items-center gap-4 text-xs text-slate-500">
                <span>{stats.emails} emails</span>
                <span className="text-emerald-600">{stats.sent} sent</span>
                <span className="text-blue-600">{stats.approved_pending_send} queued</span>
                {stats.sending > 0 && (
                  <span className="text-amber-600">{stats.sending} sending</span>
                )}
                {stats.failed > 0 && (
                  <span className="text-rose-600">{stats.failed} failed</span>
                )}
                {stats.dead > 0 && (
                  <span className="text-rose-700">{stats.dead} dead</span>
                )}
              </div>
            )}
            <Link to="/" className="btn-secondary">
              ← Home
            </Link>
            <button
              onClick={handleRefresh}
              className="btn-primary"
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "↻ Refresh inbox"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-4">
          <HealthBar />
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5">
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
              {Object.keys(CATEGORY_LABELS).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
                    filter === key
                      ? "bg-brand-600 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {CATEGORY_LABELS[key]}
                </button>
              ))}
            </div>
            <InboxList
              emails={emails}
              selectedId={selected?.id || null}
              onSelect={handleSelect}
            />
          </div>

          <div className="col-span-12 lg:col-span-5">
            <EmailCard email={selected} onDraftUpdated={handleDraftUpdated} />
          </div>

          <div className="col-span-12 lg:col-span-2">
            <SendQueue refreshKey={refreshKey} />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Built for Arpit · Hacktoberfest 2026 Weekend Challenge · Theme: Build for a Friend
          </span>
          <span>
            Powered by <span className="font-medium text-slate-700">Gemma 3 1B</span> via Ollama ·
            100% local-first
          </span>
        </div>
      </footer>
    </div>
  );
}

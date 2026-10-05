import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { EmailCard } from "../components/EmailCard";
import { InboxList } from "../components/InboxList";
import { Outbox } from "../components/Outbox";
import { HealthBar } from "../components/HealthBar";

const CATEGORY_LABELS = {
  all: "All",
  linkedin_accepted: "LinkedIn",
  needs_reply: "Needs reply",
  fyi: "FYI",
  unknown: "Other",
};

export function AppPage() {
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSending, setIsSending] = useState(false);

  // Track previous "sending" count to detect when we just started sending (animates outbox edge)
  const prevSendingRef = useRef(0);

  // AbortController for in-flight email loads
  const loadAbortRef = useRef(null);

  const loadEmails = useCallback(async () => {
    if (loadAbortRef.current) loadAbortRef.current.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    try {
      const list = await api.listEmails(
        filter === "all" ? undefined : filter,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setEmails(list);
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
      const s = await api.stats();
      // Detect transition into "sending" state
      if (s.sending > prevSendingRef.current) setIsSending(true);
      if (s.sending === 0) setIsSending(false);
      prevSendingRef.current = s.sending;
      setStats(s);
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

  // Online/offline detection — drives the outbox's "X replies waiting" copy
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Periodic refresh while drafts are pending — so user sees when the outbox sends them
  useEffect(() => {
    if (!stats) return;
    const hasPending =
      stats.approved_pending_send > 0 || stats.failed > 0 || stats.sending > 0;
    if (!hasPending) return;
    const t = setInterval(() => {
      loadStats();
      setRefreshKey((k) => k + 1);
    }, 15000);
    return () => clearInterval(t);
  }, [stats, loadStats]);

  // Keyboard shortcuts — j/k navigate, a approve, e edit, d dismiss
  useEffect(() => {
    function handleKey(e) {
      // Don't hijack typing
      const target = e.target;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) {
        return;
      }
      // Skip if modifier keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
      }
      // a / e / d are handled inside EmailCard via document-level listener below
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [emails, selected]);

  function moveSelection(delta) {
    if (emails.length === 0) return;
    const currentIndex = selected ? emails.findIndex((e) => e.id === selected.id) : -1;
    const nextIndex = (currentIndex + delta + emails.length) % emails.length;
    setSelected(emails[nextIndex]);
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await api.refreshInbox();
      await loadEmails();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setRefreshError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelect = (email) => setSelected(email);
  const handleDraftUpdated = () => {
    loadEmails();
    loadStats();
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-[var(--color-surface)] border-b" style={{ borderColor: "var(--color-border-soft)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div
              className="w-8 h-8 rounded flex items-center justify-center font-bold text-sm"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-contrast)" }}
              aria-hidden="true"
            >
              OM
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none" style={{ color: "var(--color-ink-strong)" }}>
                Offmail
              </h1>
              <p className="text-xs leading-tight mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
                Local-first email triage
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {stats && (
              <div className="hidden md:flex items-center gap-3 text-xs" style={{ color: "var(--color-ink-muted)" }}>
                <span>{stats.emails} emails</span>
                <span style={{ color: "var(--color-success)" }}>{stats.sent} sent</span>
                {stats.approved_pending_send > 0 && (
                  <span style={{ color: "var(--color-accent)" }}>{stats.approved_pending_send} queued</span>
                )}
                {stats.sending > 0 && (
                  <span style={{ color: "var(--color-warning)" }}>{stats.sending} sending</span>
                )}
                {stats.failed > 0 && (
                  <span style={{ color: "var(--color-danger)" }}>{stats.failed} failed</span>
                )}
                {stats.dead > 0 && (
                  <span style={{ color: "var(--color-danger)" }}>{stats.dead} dead</span>
                )}
              </div>
            )}
            <Link to="/" className="btn-secondary text-xs" aria-label="Back to homepage">
              Home
            </Link>
            <button
              onClick={handleRefresh}
              className="btn-primary text-xs"
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <HealthBar />

        {/* Inline refresh error (replaces alert()) */}
        {refreshError && (
          <div className="alert-inline alert-error mb-3" role="alert">
            <span aria-hidden="true">!</span>
            <span>Refresh failed: {refreshError}</span>
            <button
              onClick={() => setRefreshError(null)}
              className="ml-auto text-xs underline"
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
            >
              dismiss
            </button>
          </div>
        )}

        {/* Category filter chips */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
          {Object.keys(CATEGORY_LABELS).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors font-medium"
              style={{
                background: filter === key ? "var(--color-accent)" : "var(--color-surface)",
                color: filter === key ? "var(--color-accent-contrast)" : "var(--color-ink-muted)",
                border: `1px solid ${filter === key ? "var(--color-accent)" : "var(--color-border)"}`,
              }}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Desktop layout: 2-pane (inbox | email+draft) + outbox below */}
        {/* Mobile layout: list takes full screen; selecting an email pushes list off */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inbox pane — hidden on mobile when an email is selected (full-screen email view) */}
          <div className={selected ? "hidden lg:block" : "block"}>
            <InboxList
              emails={emails}
              selectedId={selected?.id || null}
              onSelect={handleSelect}
            />
            {/* Mobile: outbox appears below list */}
            <div className="lg:hidden mt-4">
              <Outbox
                refreshKey={refreshKey}
                isOnline={isOnline}
                isSending={isSending}
              />
            </div>
          </div>

          {/* Email + draft pane — full screen on mobile when selected */}
          <div className={selected ? "block" : "hidden lg:block"}>
            <EmailCard email={selected} onDraftUpdated={handleDraftUpdated} />
          </div>
        </div>

        {/* Desktop: outbox as a fixed column on the right */}
        <div className="hidden lg:block fixed right-4 top-32 w-72 max-h-[calc(100vh-9rem)] overflow-y-auto z-10">
          <Outbox
            refreshKey={refreshKey}
            isOnline={isOnline}
            isSending={isSending}
          />
        </div>
      </main>

      {/* Footer — minimal, no hackathon text */}
      <footer className="border-t mt-12" style={{ borderColor: "var(--color-border-soft)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs">
          <span style={{ color: "var(--color-ink-muted)" }}>
            Powered by <span className="font-medium" style={{ color: "var(--color-ink)" }}>Gemma 3 1B</span> via Ollama
          </span>
          <span style={{ color: "var(--color-ink-faint)" }}>
            Your inbox never leaves this machine.
          </span>
        </div>
      </footer>
    </div>
  );
}

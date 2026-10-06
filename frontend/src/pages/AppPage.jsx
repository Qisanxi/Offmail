import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api as realApi } from "../lib/api";
import * as demoApi from "../lib/demo-api";
import { EmailCard } from "../components/EmailCard";
import { InboxList } from "../components/InboxList";
import { Outbox } from "../components/Outbox";
import { HealthDots, HealthNotice, useHealth } from "../components/HealthBar";
import { DemoBanner } from "../components/DemoBanner";
import { AppUnreachable, AppLoading } from "../components/AppUnreachable";

const CATEGORY_LABELS = {
  all: "All",
  linkedin_accepted: "LinkedIn",
  needs_reply: "Reply",
  fyi: "FYI",
  unknown: "Other",
};

function useApi(demo) {
  return demo ? demoApi.api : realApi;
}

export function AppPage({ demo = false }) {
  const api = useApi(demo);
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [healthRetryKey, setHealthRetryKey] = useState(0);
  const [isOnline, setIsOnline] = useState(
    demo ? !demoApi.isOfflineNow() : (typeof navigator !== "undefined" ? navigator.onLine : true)
  );
  const [isSending, setIsSending] = useState(false);
  const healthState = useHealth(demo, healthRetryKey);

  // When user clicks "Retry connection" on the unreachable panel,
  // bump the key so useHealth re-runs its effect from scratch.
  const handleRetry = useCallback(() => {
    setHealthRetryKey((k) => k + 1);
  }, []);

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
    if (demo) {
      // In demo mode, subscribe to the mock API's offline state changes
      const unsub = demoApi.subscribe(() => {
        setIsOnline(!demoApi.isOfflineNow());
        loadStats();
        setRefreshKey((k) => k + 1);
      });
      return unsub;
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [demo, loadStats]);

  // Demo offline toggle handler
  const handleToggleOffline = useCallback(
    (newValue) => {
      if (demo) {
        demoApi.setOffline(newValue);
        setIsOnline(!newValue);
      }
    },
    [demo]
  );

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

  // Keyboard shortcuts — j/k move between emails. Nothing that sends mail is bound to a single key.
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
    <div className="app-shell">
      <header className="app-header theme-dark">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" aria-label="Offmail home">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-contrast)" }}
              aria-hidden="true"
            >
              OM
            </span>
            <span className="text-base font-semibold" style={{ color: "var(--color-ink-strong)" }}>
              Offmail
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <HealthDots {...healthState} />
            <button onClick={handleRefresh} className="btn-primary text-xs" disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <div className="theme-dark">
          <HealthNotice {...healthState} />
        </div>
      </header>

      {demo && (
        <DemoBanner isOffline={!isOnline} onToggleOffline={handleToggleOffline} />
      )}

      {refreshError && (
        <div className="alert-inline alert-error rounded-none px-4 sm:px-6" role="alert">
          <span>Refresh failed: {refreshError}</span>
          <button onClick={() => setRefreshError(null)} className="ml-auto text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Gate the body render based on backend reachability.
          - demo mode: always render (mock API never fails)
          - non-demo + loading: brief skeleton (≤2s)
          - non-demo + unreachable: install panel + retry + demo fallback
          - non-demo + ready: the actual inbox UI */}
      {demo ? (
        <AppBody
          emails={emails}
          selected={selected}
          filter={filter}
          setFilter={setFilter}
          handleSelect={handleSelect}
          refreshKey={refreshKey}
          isOnline={isOnline}
          isSending={isSending}
          handleDraftUpdated={handleDraftUpdated}
          handleRefresh={handleRefresh}
          refreshing={refreshing}
          demo={demo}
          categoryLabels={CATEGORY_LABELS}
        />
      ) : healthState.state === "loading" ? (
        <AppLoading />
      ) : healthState.state === "unreachable" ? (
        <AppUnreachable onRetry={handleRetry} />
      ) : (
        <AppBody
          emails={emails}
          selected={selected}
          filter={filter}
          setFilter={setFilter}
          handleSelect={handleSelect}
          refreshKey={refreshKey}
          isOnline={isOnline}
          isSending={isSending}
          handleDraftUpdated={handleDraftUpdated}
          handleRefresh={handleRefresh}
          refreshing={refreshing}
          demo={demo}
          categoryLabels={CATEGORY_LABELS}
        />
      )}
    </div>
  );
}

// AppBody — the actual inbox + email + outbox UI. Extracted so the
// loading/unreachable fallbacks can replace it cleanly.
function AppBody({
  emails,
  selected,
  filter,
  setFilter,
  handleSelect,
  refreshKey,
  isOnline,
  isSending,
  handleDraftUpdated,
  categoryLabels,
  demo,
}) {
  return (
    <div className="app-body">
      {/* Inbox rail: list on top, outbox docked underneath. On phones the rail is hidden while an email is open. */}
      <aside className={`app-rail theme-dark ${selected ? "hidden lg:flex" : "flex"}`}>
        <div role="tablist" aria-label="Filter emails" className="flex px-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
          {Object.keys(categoryLabels).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className="filter-tab"
            >
              {categoryLabels[key]}
            </button>
          ))}
        </div>
        <div className="rail-list">
          <InboxList emails={emails} selectedId={selected?.id || null} onSelect={handleSelect} />
        </div>
        <div className="rail-dock">
          <Outbox refreshKey={refreshKey} isOnline={isOnline} isSending={isSending} demo={demo} />
        </div>
      </aside>

      <main className={`app-pane ${selected ? "block" : "hidden lg:block"}`}>
        <EmailCard
          email={selected}
          onDraftUpdated={handleDraftUpdated}
          onBack={() => setSelected(null)}
          demo={demo}
        />
      </main>
    </div>
  );
}

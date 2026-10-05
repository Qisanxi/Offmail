import { useEffect, useState } from "react";
import { api } from "../lib/api";

// useHealth polls /api/health. The header shows <HealthDots>; <HealthNotice>
// only appears (with the fix) when something needs attention.
export function useHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const h = await api.health();
        if (!cancelled) {
          setHealth(h);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return { health, error };
}

function describe({ health, error }) {
  if (error) {
    return {
      items: [{ key: "backend", dot: "status-dot-error", label: "Backend offline" }],
      notice: { tone: "alert-error", body: <>Backend unreachable: {error}</> },
    };
  }
  if (!health) return { items: [], notice: null };

  const items = [];
  let notice = null;

  if (health.gmail_configured) {
    items.push({ key: "gmail", dot: "status-dot-ok", label: "Gmail" });
  } else {
    items.push({ key: "gmail", dot: "status-dot-warn", label: "Gmail not set up" });
    notice = {
      tone: "alert-warn",
      body: (
        <>
          Add <code>GMAIL_ADDRESS</code> and <code>GMAIL_APP_PASSWORD</code> to <code>.env</code>, then restart.
        </>
      ),
    };
  }

  const status = health.ollama.status;
  if (status === "ok") {
    items.push({ key: "llm", dot: "status-dot-ok", label: health.model });
  } else if (status === "model_not_pulled") {
    items.push({ key: "llm", dot: "status-dot-warn", label: "Model missing" });
    notice = notice || {
      tone: "alert-warn",
      body: (
        <>
          Run <code>ollama pull {health.ollama.needs_pull}</code>.
        </>
      ),
    };
  } else {
    items.push({ key: "llm", dot: "status-dot-error", label: "Ollama offline" });
    notice = notice || {
      tone: "alert-error",
      body: (
        <>
          Start Ollama with <code>ollama serve</code>.
        </>
      ),
    };
  }

  return { items, notice };
}

export function HealthDots({ health, error }) {
  const { items } = describe({ health, error });
  if (items.length === 0) return null;
  return (
    <ul className="flex items-center gap-3 text-xs" style={{ color: "var(--color-ink-muted)" }} aria-label="System status">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          <span className={i.dot} aria-hidden="true" />
          <span className="hidden sm:inline">{i.label}</span>
          <span className="sr-only sm:hidden">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function HealthNotice({ health, error }) {
  const { notice } = describe({ health, error });
  if (!notice) return null;
  return (
    <div className={`alert-inline ${notice.tone} rounded-none text-xs px-4 sm:px-6`} role="status">
      <span>{notice.body}</span>
    </div>
  );
}

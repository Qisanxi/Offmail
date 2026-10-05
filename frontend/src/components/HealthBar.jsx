import { useEffect, useState } from "react";
import { api } from "../lib/api";

// HealthBar — collapsed into small status dots when everything is fine.
// Expanded into a full banner ONLY when something is wrong.
export function HealthBar() {
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

  if (error) {
    return (
      <div className="alert-inline alert-error text-xs mb-3">
        <span aria-hidden="true">!</span>
        <span>Backend unreachable: {error}</span>
      </div>
    );
  }
  if (!health) return null;

  const gmailOk = health.gmail_configured;
  const ollamaOk = health.ollama.status === "ok";
  const ollamaNeedsPull = health.ollama.status === "model_not_pulled";
  const allOk = gmailOk && ollamaOk;

  // When everything is fine: small dots inline, no full-width banners.
  if (allOk) {
    return (
      <div
        className="flex items-center gap-3 text-xs mb-3"
        style={{ color: "var(--color-ink-muted)" }}
        aria-label="All systems ready"
      >
        <span className="flex items-center gap-1.5">
          <span className="status-dot-ok" aria-hidden="true" />
          Gmail
        </span>
        <span className="flex items-center gap-1.5">
          <span className="status-dot-ok" aria-hidden="true" />
          {health.model}
        </span>
      </div>
    );
  }

  // Something needs attention — expand into banners.
  return (
    <div className="mb-3 space-y-1.5">
      {!gmailOk && (
        <div className="alert-inline alert-info text-xs">
          <span className="status-dot-warn" aria-hidden="true" />
          <span>
            Gmail not configured &mdash; set <code>GMAIL_ADDRESS</code> + <code>GMAIL_APP_PASSWORD</code> in <code>.env</code>
          </span>
        </div>
      )}
      {ollamaNeedsPull && (
        <div className="alert-inline alert-info text-xs">
          <span className="status-dot-warn" aria-hidden="true" />
          <span>
            Run <code>ollama pull {health.ollama.needs_pull}</code> to download the model.
          </span>
        </div>
      )}
      {!ollamaOk && !ollamaNeedsPull && (
        <div className="alert-inline alert-error text-xs">
          <span className="status-dot-error" aria-hidden="true" />
          <span>
            Ollama unreachable &mdash; is <code>ollama serve</code> running?
          </span>
        </div>
      )}
    </div>
  );
}

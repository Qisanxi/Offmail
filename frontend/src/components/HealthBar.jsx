import { useEffect, useState } from "react";
import { api } from "../lib/api";

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
      <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded text-xs">
        Backend unreachable: {error}
      </div>
    );
  }
  if (!health) return null;

  const ollamaOk = health.ollama.status === "ok";
  const ollamaNeedsPull = health.ollama.status === "model_not_pulled";
  const ollamaUnreachable = health.ollama.status === "unreachable";

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div
        className={`px-3 py-2 rounded border ${
          health.gmail_configured
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}
      >
        {health.gmail_configured
          ? "✓ Gmail configured"
          : "⚠ Gmail not configured — set .env"}
      </div>
      <div
        className={`px-3 py-2 rounded border ${
          ollamaOk
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : ollamaNeedsPull
            ? "bg-amber-50 border-amber-200 text-amber-700"
            : "bg-rose-50 border-rose-200 text-rose-700"
        }`}
      >
        {ollamaOk
          ? `✓ ${health.model} ready`
          : ollamaNeedsPull
          ? `⚠ Run: ollama pull ${health.ollama.needs_pull}`
          : `✗ Ollama unreachable — is \`ollama serve\` running?`}
      </div>
    </div>
  );
}

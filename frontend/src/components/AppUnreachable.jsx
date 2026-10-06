// AppUnreachable — shown when /app is loaded but the backend isn't running
// on localhost:8000. Replaces the inbox + email card with an install panel
// that explains what to do + offers a demo fallback.
//
// This is the Option B fallback: instead of leaving the user on a broken
// page that just says "Backend unreachable: fetch failed", we give them
// a clear next step.
//
// Props:
//   onRetry: () => void — button to retry the health check
import { Link } from "react-router-dom";

export function AppUnreachable({ onRetry }) {
  return (
    <div className="app-unreachable">
      <div className="unreachable-card">
        <div className="unreachable-icon" aria-hidden="true">
          ⌁
        </div>
        <h2>The backend isn&rsquo;t running</h2>
        <p className="unreachable-lede">
          Offmail&rsquo;s local app needs FastAPI on{" "}
          <code>localhost:8000</code>. Start it from the project root with:
        </p>
        <pre>
          <code>make run</code>
        </pre>

        <p className="unreachable-note">
          First time here?{" "}
          <a href="#install" target="_blank" rel="noopener noreferrer">
            See the 5-minute setup
          </a>{" "}
          &mdash; clone the repo, install Ollama, pull Gemma 3 1B, then{" "}
          <code>make run</code>.
        </p>

        <div className="unreachable-actions">
          <button onClick={onRetry} className="btn-primary">
            Retry connection
          </button>
          <Link to="/demo" className="btn-secondary">
            Try the demo instead &rarr;
          </Link>
        </div>

        <p className="unreachable-hint">
          The demo runs in your browser &mdash; no install required.
        </p>
      </div>
    </div>
  );
}

// AppLoading — brief skeleton shown for ≤2s while we wait for the first
// /api/health response. Avoids the "blank page" flash.
export function AppLoading() {
  return (
    <div className="app-loading">
      <div className="loading-card">
        <div className="loading-spinner" aria-hidden="true" />
        <p className="loading-text">Connecting to localhost:8000&hellip;</p>
      </div>
    </div>
  );
}

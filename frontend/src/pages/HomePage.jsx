import { Link } from "react-router-dom";
import "../styles/landing.css";

const REPO = "https://github.com/Qisanxi/Offmail";

// The app needs the local backend, so "Open the app" only makes sense when this
// page is served from your own machine. On a hosted copy we point at the repo.
const IS_LOCAL =
  typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

export function HomePage() {
  return (
    <div className="lp theme-dark">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/" className="lp-brand">
            <span className="lp-mark" aria-hidden="true">OM</span>
            Offmail
          </Link>
          <nav className="lp-nav-links" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#run">Run it</a>
            <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            <div>
              <h1 className="lp-h1">Every new connection deserves a reply.</h1>
              <p className="lp-lede">
                Offmail finds the LinkedIn &ldquo;accepted your invitation&rdquo; emails in your Gmail,
                drafts a short thank-you on your own laptop, and sends it when you approve.
                It keeps working offline.
              </p>
              <div className="lp-cta">
                {IS_LOCAL ? (
                  <Link to="/app" className="btn-primary lp-btn">Open the app</Link>
                ) : (
                  <a href={REPO} target="_blank" rel="noopener noreferrer" className="btn-primary lp-btn">
                    Get it on GitHub
                  </a>
                )}
                <a href="#run" className="btn-secondary lp-btn">Run it yourself</a>
              </div>
            </div>
            <div>
              <AppPreview />
              <p className="lp-sample">Sample data.</p>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap">
            <div className="lp-trio">
              <div>
                <h3>Drafts stay on your machine</h3>
                <p>A small model, Gemma 3 1B, runs through Ollama here. No AI service sees your email.</p>
              </div>
              <div>
                <h3>The outbox waits for you</h3>
                <p>Approve replies on a plane. They go out from your own Gmail when you&rsquo;re back online.</p>
              </div>
              <div>
                <h3>You send every reply</h3>
                <p>Nothing leaves without your approval, and you see where each reply goes first.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="lp-section">
          <div className="lp-wrap">
            <h2 className="lp-h2">How it works</h2>
            <div className="lp-steps">
              <div className="lp-step">
                <div>
                  <h3>Refresh</h3>
                  <p>Offmail reads your Gmail Social tab and picks out connection and reply-worthy emails.</p>
                </div>
              </div>
              <div className="lp-step">
                <div>
                  <h3>Review</h3>
                  <p>Edit the draft, or rewrite it shorter, warmer, more formal or more casual.</p>
                </div>
              </div>
              <div className="lp-step">
                <div>
                  <h3>Approve</h3>
                  <p>The reply joins the outbox and sends from your Gmail, through the reply address on the email.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="run" className="lp-section">
          <div className="lp-wrap">
            <h2 className="lp-h2">Run it on your laptop</h2>
            <pre className="lp-code"><code>{`git clone ${REPO}.git && cd Offmail
cp .env.example .env     # add your Gmail address and app password
ollama pull gemma3:1b
make setup && make run`}</code></pre>
            <p className="lp-note">
              Needs Python 3.10+, Node 20.19+ or 22.12+, Ollama, and a Gmail{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">app password</a>.
              Full steps are in the{" "}
              <a href={`${REPO}#readme`} target="_blank" rel="noopener noreferrer">README</a>.
            </p>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <span>Offmail &middot; MIT license</span>
          <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  );
}

// A static picture of the real app, built from the same classes and tokens so it
// can't drift from the product. Not interactive, hidden from assistive tech.
function AppPreview() {
  return (
    <div
      className="lp-preview"
      role="img"
      aria-label="Preview of Offmail: an inbox list, a drafted reply to a LinkedIn connection, and the outbox with one reply queued"
    >
      <div aria-hidden="true">
        <div className="lp-preview-bar">
          <span className="status-dot-ok" /> Gmail
          <span className="status-dot-ok" style={{ marginLeft: 8 }} /> gemma3:1b
        </div>
        <div className="lp-preview-body">
          <div className="lp-preview-rail">
            <div className="lp-preview-row row-marker-linkedin" style={{ background: "var(--color-row-selected)" }}>
              Priya Patel <small>Technical recruiter at Northwind</small>
            </div>
            <div className="lp-preview-row row-marker-linkedin">
              Marcus Chen <small>Engineering manager at Lumen</small>
            </div>
            <div className="lp-preview-row row-marker-reply">
              Ana Silva <small>Question for you</small>
            </div>
            <div className="lp-preview-dock">
              <div className="airmail-strip airmail-strip-live" />
              <p><strong>Outbox</strong> 1 queued</p>
            </div>
          </div>
          <div className="lp-preview-pane theme-light">
            <h3 className="lp-preview-name">Priya Patel</h3>
            <p className="lp-preview-sub">Technical recruiter at Northwind</p>
            <p className="lp-preview-quote">You are now connected. Say hello and start a conversation.</p>
            <p className="alert-inline alert-info" style={{ marginBottom: 12 }}>
              <span>→</span><span><strong>Sends as a LinkedIn message</strong></span>
            </p>
            <div className="sheet lp-preview-draft">
              Hi Priya, thanks for connecting! I&rsquo;d love to hear more about the ML roles your
              team is hiring for. Happy to chat next week if that works.
            </div>
            <div className="lp-preview-actions">
              <span className="btn-primary text-sm">Approve &amp; queue</span>
              <span className="btn-ghost text-sm">Dismiss</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

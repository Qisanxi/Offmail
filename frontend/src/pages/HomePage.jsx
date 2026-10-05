import { Link } from "react-router-dom";
import "../styles/landing.css";

export function HomePage() {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand">
            <div className="brand-mark">OM</div>
            <span>Offmail</span>
          </Link>
          <nav>
            <a href="#why">Why</a>
            <a href="#how">How it works</a>
            <a href="#install">Install</a>
            <a href="https://github.com/Qisanxi/Offmail" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="badge">Built for Hacktoberfest 2026 — Weekend Challenge</div>
          <h1>
            Your inbox,<br />
            <span className="grad">your laptop,</span><br />
            your AI.
          </h1>
          <p className="lede">
            Offmail reads your Gmail locally, detects LinkedIn "connection accepted" emails,
            drafts warm replies with <strong>Gemma 3 1B</strong> running on your own machine,
            and you hit send. No central server. No cloud LLM. Just you.
          </p>
          <p className="attribution">
            Built for <strong>Arpit</strong> — a job seeker who sends 20+ LinkedIn connection
            requests a week and never managed to reply when recruiters accepted.
          </p>
          <div className="cta-row">
            <Link to="/app" className="btn btn-primary">Open the app →</Link>
            <a
              href="https://github.com/Qisanxi/Offmail"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              View source on GitHub
            </a>
          </div>
          <div className="hero-stats">
            <div><strong>0</strong><span>cloud servers we control</span></div>
            <div><strong>1B</strong><span>param open-weight model</span></div>
            <div><strong>$0</strong><span>cost to run, forever</span></div>
          </div>
        </div>
      </section>

      <section id="why" className="section">
        <div className="section-inner">
          <h2>Why this exists</h2>
          <p className="section-lede">
            Closed inbox-AI tools (Superhuman, Shortwave) read your emails on their servers.
            That means your recruiter conversations sit in someone else&apos;s database, you pay
            $20-30/month forever, and you can&apos;t audit how your data is used.
          </p>
          <p className="section-lede">
            Offmail flips that. The open pieces are what make the project work —
            and they answer every question in the Hacktoberfest prompt.
          </p>

          <div className="grid">
            <div className="card">
              <div className="card-icon">🔋</div>
              <h3>Runs offline</h3>
              <p>
                Drafting works with no internet. Ollama + Gemma 3 1B run entirely on your
                laptop. Draft replies on a flight, queue them up, hit send when you land.
              </p>
            </div>
            <div className="card">
              <div className="card-icon">🔒</div>
              <h3>Data stays on your machine</h3>
              <p>
                There is no Offmail server. Each user runs their own copy. Your Gmail
                credentials, emails, drafts — all stay in <code>.env</code> and local SQLite,
                never sent anywhere except your own Gmail IMAP/SMTP.
              </p>
            </div>
            <div className="card">
              <div className="card-icon">🔄</div>
              <h3>Swap models freely</h3>
              <p>
                Any Ollama model works. Change <code>OLLAMA_MODEL</code> env var to
                <code>phi3:mini</code>, <code>llama3.2:1b</code>, <code>mistral:7b</code> —
                no code changes, no API key, no subscription.
              </p>
            </div>
            <div className="card">
              <div className="card-icon">💸</div>
              <h3>Costs nothing</h3>
              <p>
                Ollama, Gemma 3 1B, SQLite, FastAPI, React — all free, all open source.
                No API costs, no per-seat licenses, no monthly bills. Yours forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="section section-alt">
        <div className="section-inner">
          <h2>How it works</h2>
          <div className="arch">
            <div className="arch-step">
              <div className="step-num">1</div>
              <div>
                <h3>Poll Gmail Social category</h3>
                <p>IMAP fetches via Gmail&apos;s X-GM-RAW search — where LinkedIn acceptance emails land.</p>
              </div>
            </div>
            <div className="arch-step">
              <div className="step-num">2</div>
              <div>
                <h3>Classify locally</h3>
                <p>Sender-restricted regex classifier tags emails: <em>LinkedIn accepted</em>, <em>needs reply</em>, <em>FYI</em>.</p>
              </div>
            </div>
            <div className="arch-step">
              <div className="step-num">3</div>
              <div>
                <h3>Draft with Gemma</h3>
                <p>Ollama + Gemma 3 1B draft a short, warm reply. ~10-20s on a 4GB RAM laptop. Local only.</p>
              </div>
            </div>
            <div className="arch-step">
              <div className="step-num">4</div>
              <div>
                <h3>You review &amp; approve</h3>
                <p>Edit the draft, approve it, queue it. Never auto-sends without your click.</p>
              </div>
            </div>
            <div className="arch-step">
              <div className="step-num">5</div>
              <div>
                <h3>Background sender</h3>
                <p>Queue flushes via your own Gmail SMTP every 60s. Atomic claim prevents double-send. Backoff retry on failure.</p>
              </div>
            </div>
            <div className="arch-step">
              <div className="step-num">6</div>
              <div>
                <h3>Lands as LinkedIn DM</h3>
                <p>The reply routes through LinkedIn&apos;s <code>reply-to</code> email address → arrives as a LinkedIn message. No API, no scraping.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="install" className="section">
        <div className="section-inner">
          <h2>Install Offmail</h2>
          <p className="section-lede">
            5-minute setup on any laptop with 4GB+ RAM. No server, no SaaS — you run your own copy.
          </p>

          <div className="install-block">
            <h3>1. Prerequisites</h3>
            <ul>
              <li>Python 3.10+</li>
              <li>Node.js 22.12+ (Vite 8 requires Node 20.19+ or 22.12+)</li>
              <li><a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">Ollama</a> installed</li>
              <li>A Gmail account with <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">app password</a></li>
            </ul>
          </div>

          <div className="install-block">
            <h3>2. Clone &amp; configure</h3>
            <pre><code>git clone https://github.com/Qisanxi/Offmail.git{"\n"}cd Offmail{"\n"}cp .env.example .env{"\n"}# Edit .env — add your Gmail address + 16-char app password</code></pre>
          </div>

          <div className="install-block">
            <h3>3. Pull the model</h3>
            <pre><code>ollama pull gemma3:1b</code></pre>
            <p className="note">~800MB download. One-time. After this, the model runs fully offline.</p>
          </div>

          <div className="install-block">
            <h3>4. Run</h3>
            <pre><code>make setup    # installs Python + Node deps{"\n"}make run      # starts FastAPI + React + Ollama check</code></pre>
            <p className="note">Open <a href="http://localhost:5173">http://localhost:5173</a> — you&apos;re on the homepage. Click <strong>Open the app</strong> to start triaging.</p>
          </div>

          <div className="install-block">
            <h3>5. Try it</h3>
            <ol>
              <li>Navigate to <Link to="/app">/app</Link> — the triage interface loads</li>
              <li>Click &quot;Refresh inbox&quot; — Gmail Social emails load</li>
              <li>Pick a LinkedIn acceptance email</li>
              <li>Click &quot;Generate draft&quot; — Gemma writes a reply (10-20s)</li>
              <li>Edit if you like, then &quot;Approve &amp; queue&quot;</li>
              <li>Background sender routes via Gmail SMTP → LinkedIn reply-to → lands as a DM</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section section-cta">
        <div className="section-inner">
          <h2>Built for Arpit. Open for everyone.</h2>
          <p>
            Arpit sends 20+ connection requests a week. When recruiters accept, he means to
            reply — but the friction kills the moment. Offmail removes the friction, and keeps
            his inbox on his laptop where it belongs.
          </p>
          <p className="section-lede">
            Fork it. Extend it. Swap models. Add Twitter follow-backs. Build for your own friend.
          </p>
          <div className="cta-row">
            <Link to="/app" className="btn btn-primary">Open the app →</Link>
            <a
              href="https://github.com/Qisanxi/Offmail"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              ★ on GitHub
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div>
            <strong>Offmail</strong> — local-first email triage for job seekers.
          </div>
          <div>
            Built for <strong>Arpit</strong> · Hacktoberfest 2026 Weekend Challenge · MIT License
          </div>
        </div>
      </footer>
    </>
  );
}

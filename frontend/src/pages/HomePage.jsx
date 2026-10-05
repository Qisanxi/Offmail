import { Link } from "react-router-dom";
import "../styles/landing.css";

export function HomePage() {
  return (
    <>
      {/* Top airmail ribbon — the brand's visual signature, appears on every page */}
      <div className="airmail-ribbon" aria-hidden="true" />

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
            <a
              href="https://github.com/Qisanxi/Offmail"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <Link to="/app" className="nav-cta">
              Open app
            </Link>
          </nav>
        </div>
      </header>

      {/* =================== HERO =================== */}
      {/* Split layout: copy on left, live product mockup on right.
          The mockup shows the actual UI — inbox + draft + outbox with the
          animated airmail stripe. This makes the value prop VISIBLE. */}
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="airmail-dot" aria-hidden="true" />
              Local-first · open-source AI
            </div>
            <h1>
              Reply to recruiters
              <br />
              <span className="grad">without handing them</span>
              <br />
              your inbox.
            </h1>
            <p className="lede">
              Offmail reads your Gmail locally, drafts warm replies with{" "}
              <strong>Gemma 3 1B</strong> on your laptop, and queues them in an{" "}
              <em>offline outbox</em> that sends the moment you reconnect. No
              cloud, no API keys, no $20/month forever.
            </p>

            <div className="cta-row">
              <Link to="/app" className="btn btn-primary">
                Try the live demo
                <span className="arrow" aria-hidden="true">→</span>
              </Link>
              <a
                href="https://github.com/Qisanxi/Offmail"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                View source
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <strong>0</strong>
                <span>cloud servers we control</span>
              </div>
              <div>
                <strong>1B</strong>
                <span>open-weight model</span>
              </div>
              <div>
                <strong>$0</strong>
                <span>cost, forever</span>
              </div>
            </div>
          </div>

          {/* Product mockup — what the user will actually see when they click "Open app" */}
          <div className="hero-mockup" aria-hidden="true">
            <ProductMockup />
          </div>
        </div>
      </section>

      {/* =================== WHY — closed vs open comparison =================== */}
      <section id="why" className="section">
        <div className="section-inner">
          <div className="section-eyebrow">Why this exists</div>
          <h2>Closed inbox AI reads your mail on their server. Offmail doesn&rsquo;t.</h2>
          <p className="section-lede">
            Superhuman, Shortwave, and friends all want $20&ndash;30 a month to read your recruiter
            conversations in their cloud. Offmail runs entirely on your laptop — no servers we
            control, no per-seat billing, no telemetry.
          </p>

          <div className="comparison">
            <div className="comparison-row comparison-header">
              <div>What you want</div>
              <div className="comparison-closed">Closed SaaS</div>
              <div className="comparison-open">Offmail</div>
            </div>
            <div className="comparison-row">
              <div>Your data lives&hellip;</div>
              <div className="comparison-closed">on their servers</div>
              <div className="comparison-open">on your laptop</div>
            </div>
            <div className="comparison-row">
              <div>Works offline</div>
              <div className="comparison-closed">no</div>
              <div className="comparison-open">yes</div>
            </div>
            <div className="comparison-row">
              <div>Swap models freely</div>
              <div className="comparison-closed">no — their model, their rules</div>
              <div className="comparison-open">yes — any Ollama model</div>
            </div>
            <div className="comparison-row">
              <div>Audit how your data is used</div>
              <div className="comparison-closed">no</div>
              <div className="comparison-open">yes — code&rsquo;s on GitHub</div>
            </div>
            <div className="comparison-row">
              <div>Monthly cost</div>
              <div className="comparison-closed">$20&ndash;30</div>
              <div className="comparison-open">$0</div>
            </div>
          </div>
        </div>
      </section>

      {/* =================== HOW — horizontal flow =================== */}
      <section id="how" className="section section-alt">
        <div className="section-inner">
          <div className="section-eyebrow">How it works</div>
          <h2>Six steps. All local. None of them ask you to trust a third party.</h2>

          <div className="flow">
            <FlowStep
              num="1"
              title="Poll Gmail"
              body="IMAP + Gmail's X-GM-RAW search grabs the Social category — where LinkedIn acceptance emails land."
            />
            <FlowStep
              num="2"
              title="Classify"
              body="Sender-restricted regex tags each email: LinkedIn accepted, needs reply, or FYI. No LLM tokens spent on this."
            />
            <FlowStep
              num="3"
              title="Draft"
              body="Gemma 3 1B via Ollama writes a short, warm reply. ~10&ndash;20s on a 4GB laptop. Fully offline."
            />
            <FlowStep
              num="4"
              title="You approve"
              body="Edit if you like. See where the reply will go before you hit approve — no surprises."
            />
            <FlowStep
              num="5"
              title="Queue"
              body="Atomic claim prevents double-send. Exponential backoff on failure. Offline? Sends when network returns."
            />
            <FlowStep
              num="6"
              title="Lands as DM"
              body="Reply routes via LinkedIn's reply-to email address — arrives as a LinkedIn message. No API, no scraping."
            />
          </div>
        </div>
      </section>

      {/* =================== INSTALL =================== */}
      <section id="install" className="section">
        <div className="section-inner">
          <div className="section-eyebrow">Install</div>
          <h2>5-minute setup. No server, no SaaS.</h2>
          <p className="section-lede">
            Runs on any laptop with 4GB+ RAM. Python 3.10+, Node 22.12+, and{" "}
            <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">
              Ollama
            </a>{" "}
            installed.
          </p>

          <div className="install-grid">
            <div className="install-block">
              <div className="install-step-label">01</div>
              <h3>Clone &amp; configure</h3>
              <pre><code>{`git clone https://github.com/Qisanxi/Offmail.git
cd Offmail
cp .env.example .env
# Edit .env — add your Gmail address + 16-char app password`}</code></pre>
            </div>

            <div className="install-block">
              <div className="install-step-label">02</div>
              <h3>Pull the model</h3>
              <pre><code>{`ollama pull gemma3:1b`}</code></pre>
              <p className="note">~800MB, one-time. After this, the model runs fully offline.</p>
            </div>

            <div className="install-block">
              <div className="install-step-label">03</div>
              <h3>Run</h3>
              <pre><code>{`make setup    # installs Python + Node deps
make run      # starts FastAPI + React + Ollama check`}</code></pre>
              <p className="note">
                Open{" "}
                <a href="http://localhost:5173">http://localhost:5173</a> — you&rsquo;re on this page.
                Click <strong>Open app</strong> to start triaging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =================== CTA =================== */}
      <section className="section section-cta">
        <div className="section-inner">
          <div className="airmail-divider" aria-hidden="true" />
          <h2>Open for everyone.</h2>
          <p>
            Offmail keeps your inbox on your laptop where it belongs — no third-party servers, no
            monthly bills, no API keys to manage. Fork it, swap models, extend it for your own
            workflow.
          </p>
          <div className="cta-row">
            <Link to="/app" className="btn btn-primary">
              Open the app
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
            <a
              href="https://github.com/Qisanxi/Offmail"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      <footer>
        <div className="airmail-ribbon footer-ribbon" aria-hidden="true" />
        <div className="footer-inner">
          <div>
            <strong>Offmail</strong> &mdash; local-first email triage.
          </div>
          <div>MIT License &middot; Powered by Gemma 3 1B via Ollama</div>
        </div>
      </footer>
    </>
  );
}

/* ============ Sub-components ============ */

function ProductMockup() {
  // A miniature, statically-rendered preview of the app interface.
  // Shows: inbox list (left), email + draft (center), outbox with airmail edge (right).
  return (
    <div className="mockup-window">
      <div className="mockup-titlebar">
        <span className="dot dot-red" />
        <span className="dot dot-yellow" />
        <span className="dot dot-green" />
        <span className="mockup-url">localhost:5173/app</span>
      </div>
      <div className="mockup-body">
        {/* Inbox list */}
        <div className="mockup-pane mockup-inbox">
          <div className="mockup-pane-label">Inbox</div>
          <div className="mockup-row mockup-row-selected">
            <span className="mockup-marker mockup-marker-linkedin" />
            <div>
              <div className="mockup-row-name">Priya Patel</div>
              <div className="mockup-row-sub">Recruiter at Stripe</div>
            </div>
            <span className="mockup-row-time">2h</span>
          </div>
          <div className="mockup-row">
            <span className="mockup-marker mockup-marker-linkedin" />
            <div>
              <div className="mockup-row-name">Marcus Chen</div>
              <div className="mockup-row-sub">Eng Manager at Linear</div>
            </div>
            <span className="mockup-row-time">5h</span>
          </div>
          <div className="mockup-row">
            <span className="mockup-marker mockup-marker-reply" />
            <div>
              <div className="mockup-row-name">Sarah Lee</div>
              <div className="mockup-row-sub">Re: interview prep</div>
            </div>
            <span className="mockup-row-time">1d</span>
          </div>
          <div className="mockup-row">
            <span className="mockup-marker mockup-marker-fyi" />
            <div>
              <div className="mockup-row-name">LinkedIn digest</div>
              <div className="mockup-row-sub">Weekly summary</div>
            </div>
            <span className="mockup-row-time">2d</span>
          </div>
        </div>

        {/* Email + draft */}
        <div className="mockup-pane mockup-email">
          <div className="mockup-pane-label">Draft reply</div>
          <div className="mockup-destination">
            → Sends as a LinkedIn message
          </div>
          <div className="mockup-draft">
            Hi Priya, thanks so much for connecting! Really enjoyed your post on
            building inclusive eng teams — would love to chat about opportunities
            at Stripe if anything fits my background.
          </div>
          <div className="mockup-draft-meta">
            <span className="mockup-badge">23 / 80 words</span>
            <span className="mockup-approve">Approve &amp; queue</span>
          </div>
        </div>

        {/* Outbox — with animated airmail edge */}
        <div className="mockup-pane mockup-outbox">
          <div className="mockup-airmail-top" />
          <div className="mockup-pane-label">Outbox</div>
          <div className="mockup-outbox-status">2 queued · sending</div>
          <div className="mockup-outbox-item">
            <div className="mockup-outbox-badge mockup-outbox-sending">Sending</div>
            <div className="mockup-outbox-body">
              Hi Marcus, thanks for connecting&hellip;
            </div>
          </div>
          <div className="mockup-outbox-item">
            <div className="mockup-outbox-badge mockup-outbox-queued">Queued</div>
            <div className="mockup-outbox-body">
              Hi Priya, thanks so much&hellip;
            </div>
          </div>
          <div className="mockup-airmail-bottom" />
        </div>
      </div>
    </div>
  );
}

function FlowStep({ num, title, body }) {
  return (
    <div className="flow-step">
      <div className="flow-num">{num}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

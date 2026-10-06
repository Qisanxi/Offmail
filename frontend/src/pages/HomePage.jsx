import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/landing.css";

const REPO = "https://github.com/Qisanxi/Offmail";

// The real app needs the local backend, so "Open the app" only makes sense when
// this page is served from your own machine. Everyone else gets the demo.
const IS_LOCAL =
  typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const SETUP = {
  mac: {
    label: "macOS",
    note: "Install Python, Node and Ollama first (Homebrew works for all three).",
    code: `git clone ${REPO}.git && cd Offmail
cp .env.example .env     # add your Gmail address and app password
ollama pull gemma3:1b
make setup && make run`,
  },
  linux: {
    label: "Linux",
    note: "The path the project is developed and tested on.",
    code: `git clone ${REPO}.git && cd Offmail
cp .env.example .env     # add your Gmail address and app password
ollama pull gemma3:1b
make setup && make run`,
  },
  windows: {
    label: "Windows",
    note: "No make needed: run the last two lines in separate terminals. Less tested than Linux.",
    code: `git clone ${REPO}.git
cd Offmail
copy .env.example .env
ollama pull gemma3:1b
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

uvicorn backend.main:app --host 127.0.0.1 --port 8000
cd frontend && npm run dev`,
  },
};

function detectDevice() {
  if (typeof navigator === "undefined") return { os: "mac", phone: false };
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return { os: "mac", phone: true };
  if (/Windows/i.test(ua)) return { os: "windows", phone: false };
  if (/Linux|X11/i.test(ua)) return { os: "linux", phone: false };
  return { os: "mac", phone: false };
}

const COMPARE = [
  ["Where drafting happens", "On the company\u2019s servers", "On your computer"],
  ["Who can read your email", "The service, and any AI provider it uses", "You and Gmail, which already has it"],
  ["With no internet", "Stops working", "Drafting keeps working. Approved replies wait in the outbox and send when you\u2019re back online"],
  ["Who sends the reply", "Often the service itself", "Your own Gmail, only after you approve"],
  ["Cost", "Usually a monthly subscription", "Free and open source (MIT). Uses your own hardware"],
  ["Setup", "Sign up and go", "A few commands, plus a model download"],
  ["Draft quality", "Largest models, polished", "A small model: plainer, so you edit or rewrite"],
];

const FAQ = [
  [
    "Is my email sent anywhere?",
    <>
      There is no Offmail server. Your computer talks to Gmail directly (read over IMAP, send over SMTP)
      and to a model running on the same machine. This website is static, and the demo uses sample emails.
    </>,
  ],
  [
    "Why a Gmail app password and not \u201cSign in with Google\u201d?",
    <>
      Reading Gmail with Google sign-in needs Google&rsquo;s app review for sensitive mail access, which
      Offmail hasn&rsquo;t been through. An app password keeps everything on your machine, and you can
      revoke it any time. Google sign-in is something we&rsquo;d like to add later.
    </>,
  ],
  [
    "Does it work offline?",
    <>
      Drafting does, because the model runs locally. Fetching new mail and sending need a connection.
      Replies you approve while offline wait in the outbox and go out when you&rsquo;re back online.
    </>,
  ],
  [
    "Can it send anything without my approval?",
    <>
      No. Every reply needs your Approve, and Offmail shows where it will go first. If a reply
      address can&rsquo;t be trusted, Approve is disabled and you copy the draft instead.
    </>,
  ],
  [
    "Will the reply really arrive as a LinkedIn message?",
    <>
      LinkedIn puts a reply address on these emails that is meant to route into LinkedIn messaging. Offmail
      only trusts linkedin.com addresses for that. We haven&rsquo;t verified every case, so check the
      destination line before you approve.
    </>,
  ],
  [
    "Why such a small model?",
    <>
      Gemma 3 1B runs on an ordinary laptop with about 4 GB of free memory. The drafts are plainer than a
      large hosted model&rsquo;s, which is why every one is editable and can be rewritten shorter, warmer,
      more formal or more casual. Any Ollama model works if you change one setting.
    </>,
  ],
  [
    "Is there a phone app?",
    <>
      Not yet. Offmail needs a model and a mail connection running on your own device, and phones make that
      hard today. A phone version is in progress. The demo works in any phone browser.
    </>,
  ],
  [
    "What does it cost?",
    <>Nothing. It&rsquo;s open source under the MIT license and runs on your own hardware and Gmail.</>,
  ],
  [
    "How do I remove it?",
    <>
      Delete the app password at{" "}
      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
        your Google account
      </a>
      , then delete the Offmail folder. Your data is the local database in that folder.
    </>,
  ],
];

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still selectable.
    }
  }
  return (
    <div className="lp-codewrap">
      <button type="button" className="lp-copy" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="lp-code" tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function HomePage() {
  const device = detectDevice();
  const [os, setOs] = useState(device.os);
  const [linkCopied, setLinkCopied] = useState(false);
  const pageUrl = typeof window !== "undefined" ? window.location.origin + "/" : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Falls back to the email link below.
    }
  }

  return (
    <div className="lp theme-dark">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/" className="lp-brand">
            <span className="lp-mark" aria-hidden="true">OM</span>
            Offmail
          </Link>
          <nav className="lp-nav-links" aria-label="Main">
            <Link to="/demo">Demo</Link>
            <a href="#compare" className="lp-hide-sm">Compare</a>
            <a href="#get">Get it</a>
            <a href="#faq" className="lp-hide-sm">FAQ</a>
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
                drafts a short thank-you on your own computer, and sends it when you approve.
                Drafting keeps working offline.
              </p>
              <div className="lp-cta">
                <Link to="/demo" className="btn-primary lp-btn">
                  Try the demo
                  <span aria-hidden="true"> →</span>
                </Link>
                {IS_LOCAL ? (
                  <Link to="/app" className="btn-secondary lp-btn">Open the local app</Link>
                ) : (
                  <a href="#get" className="btn-secondary lp-btn">Get it for your computer</a>
                )}
              </div>
              <p className="lp-cta-note">
                The demo runs in your browser — no install, no signup, no data sent. Works on mobile.
              </p>
              {IS_LOCAL && (
                <p className="lp-cta-note lp-cta-subtext">
                  First time running the local app?{" "}
                  <a href="#get">See the 5-minute setup</a> — clone, install Ollama, pull Gemma 3 1B, then{" "}
                  <code>make run</code>.
                </p>
              )}
            </div>
            <div>
              <AppPreview />
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

        <section id="compare" className="lp-section">
          <div className="lp-wrap">
            <h2 className="lp-h2">Running it yourself vs a hosted tool</h2>
            <table className="lp-compare">
              <thead>
                <tr>
                  <th scope="col"><span className="lp-sr">Question</span></th>
                  <th scope="col">Typical hosted tool</th>
                  <th scope="col" className="lp-us">Offmail</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([q, them, us]) => (
                  <tr key={q}>
                    <th scope="row">{q}</th>
                    <td data-label="Typical hosted tool">{them}</td>
                    <td data-label="Offmail" className="lp-us">{us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lp-note" style={{ marginTop: 16 }}>
              Hosted tools differ; this describes the common design. The trade-off is real: you set Offmail
              up yourself, and a small local model writes plainer drafts.
            </p>
          </div>
        </section>

        <section id="get" className="lp-section">
          <div className="lp-wrap">
            <h2 className="lp-h2">Get Offmail</h2>

            {device.phone && (
              <p className="lp-callout" role="note">
                You&rsquo;re on a phone. Offmail installs on a computer, so try the demo here and set it up
                later.
              </p>
            )}

            <div className="lp-get-grid">
              <div>
                <div role="tablist" aria-label="Operating system" className="lp-tabs">
                  {Object.entries(SETUP).map(([key, v]) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={os === key}
                      onClick={() => setOs(key)}
                      className="lp-tab"
                    >
                      {v.label}
                      {!device.phone && device.os === key && <span className="lp-tab-hint"> (this device)</span>}
                    </button>
                  ))}
                </div>
                <CodeBlock key={os} code={SETUP[os].code} />
                <p className="lp-note">{SETUP[os].note}</p>
              </div>

              <div>
                <h3 className="lp-h3">You&rsquo;ll need</h3>
                <ul className="lp-reqs">
                  <li>Python 3.10 or newer</li>
                  <li>Node 20.19+ or 22.12+</li>
                  <li><a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">Ollama</a>, plus about 1 GB for the model</li>
                  <li>About 4 GB of free memory</li>
                  <li>
                    A Gmail{" "}
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">app password</a>{" "}
                    (needs 2-step verification)
                  </li>
                </ul>
                <p className="lp-note">
                  Full steps are in the{" "}
                  <a href={`${REPO}#readme`} target="_blank" rel="noopener noreferrer">README</a>.
                </p>
              </div>
            </div>

            <div className="lp-phone">
              <div>
                <h3 className="lp-h3">
                  Phone <span className="lp-pill">In progress</span>
                </h3>
                <p className="lp-note">
                  Offmail needs a model and a mail connection running on your own device, and phones make
                  that hard today. A phone version is in progress. Until then, the demo works in any phone
                  browser, and you can send yourself this page to set it up on a computer.
                </p>
              </div>
              <div className="lp-phone-actions">
                <Link to="/demo" className="btn-secondary lp-btn">Open the demo</Link>
                <a
                  className="btn-ghost lp-btn"
                  href={`mailto:?subject=${encodeURIComponent("Set up Offmail on my computer")}&body=${encodeURIComponent(pageUrl + "#get")}`}
                >
                  Email me this page
                </a>
                <button type="button" className="btn-ghost lp-btn" onClick={copyLink}>
                  {linkCopied ? "Link copied" : "Copy link"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-section">
          <div className="lp-wrap lp-faq-wrap">
            <h2 className="lp-h2">Questions</h2>
            <div className="lp-faq">
              {FAQ.map(([q, a]) => (
                <details key={q} className="lp-qa">
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-grid">
          <div>
            <Link to="/" className="lp-brand">
              <span className="lp-mark" aria-hidden="true">OM</span>
              Offmail
            </Link>
            <p className="lp-footer-note">
              Local-first replies for LinkedIn connections. Built for the Hacktoberfest 2026 Weekend DEV Challenge.
            </p>
          </div>
          <nav aria-label="Product">
            <h4>Product</h4>
            <Link to="/demo">Demo</Link>
            <a href="#get">Get it</a>
            <a href="#compare">Compare</a>
            <a href="#faq">FAQ</a>
          </nav>
          <nav aria-label="Project">
            <h4>Project</h4>
            <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href={`${REPO}#readme`} target="_blank" rel="noopener noreferrer">README</a>
            <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">Report an issue</a>
            <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">MIT license</a>
          </nav>
        </div>
        <div className="lp-wrap lp-footer-base">
          This site is static: no sign-in, no forms, and your email never touches it.
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

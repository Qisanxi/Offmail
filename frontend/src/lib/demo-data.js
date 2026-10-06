// Sample data for the in-browser demo.
// All recruiter names, companies, and emails are FICTIONAL but realistic.
// Canned drafts read like real Gemma 3 1B output — short, warm, with a soft next-step.

// ============================================================
// Sample emails — the inbox
// ============================================================

export const SAMPLE_EMAILS = [
  {
    id: "email-1",
    message_id: "<linkedin-accept-priya-001@linkedin.com>",
    from_address: "invitations@linkedin.com",
    from_name: "LinkedIn",
    reply_to: "reply+abc123def456@linkedin.com",
    subject: "Priya Patel accepted your invitation",
    body_snippet:
      "Priya Patel is now a connection. Priya is a Senior Technical Recruiter at Stripe, previously at Airbnb. You can send a message to start the conversation.",
    body_full:
      "Priya Patel is now a connection. Priya is a Senior Technical Recruiter at Stripe, previously at Airbnb. She focuses on engineering hiring across payments and risk. You can send a message to start the conversation.",
    category: "linkedin_accepted",
    received_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
    contact_name: "Priya Patel",
    contact_headline: "Senior Technical Recruiter at Stripe",
    destination_label: "Sends as a LinkedIn message",
    safe_to_auto_send: true,
    draft_id: "draft-1",
    draft_body:
      "Hi Priya, thanks so much for connecting! I really enjoyed your recent post about reducing bias in technical interviews — it's something I've been thinking about a lot. Would love to chat if any Stripe engineering roles feel like a fit for my background.",
    draft_status: "pending",
  },
  {
    id: "email-2",
    message_id: "<linkedin-accept-marcus-002@linkedin.com>",
    from_address: "invitations@linkedin.com",
    from_name: "LinkedIn",
    reply_to: "reply+marcus-789xyz@linkedin.com",
    subject: "Marcus Chen accepted your invitation",
    body_snippet:
      "Marcus Chen is now a connection. Marcus is an Engineering Manager at Linear, previously at Figma. He's hiring for the editor team.",
    body_full:
      "Marcus Chen is now a connection. Marcus is an Engineering Manager at Linear, previously at Figma. He's currently hiring senior frontend engineers for the editor team and is open to chatting with folks who care deeply about craft.",
    category: "linkedin_accepted",
    received_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5h ago
    contact_name: "Marcus Chen",
    contact_headline: "Engineering Manager at Linear",
    destination_label: "Sends as a LinkedIn message",
    safe_to_auto_send: true,
    draft_id: "draft-2",
    draft_body:
      "Hi Marcus, thanks for connecting! I've been a Linear user since the early days and really admire the editor's performance work — the canvas implementation is genuinely inspiring. Would love to learn more about what the senior FE role looks like.",
    draft_status: "approved",
  },
  {
    id: "email-3",
    message_id: "<linkedin-accept-sarah-003@linkedin.com>",
    from_address: "invitations@linkedin.com",
    from_name: "LinkedIn",
    reply_to: "reply+sarah-aaa111@linkedin.com",
    subject: "Sarah Lee accepted your invitation",
    body_snippet:
      "Sarah Lee is now a connection. Sarah is a Staff Engineer at Notion, previously at Slack. She wrote about async collaboration patterns.",
    body_full:
      "Sarah Lee is now a connection. Sarah is a Staff Engineer at Notion, previously at Slack. She's the author of the widely-shared post on async collaboration patterns in distributed teams.",
    category: "linkedin_accepted",
    received_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // ~1d ago
    contact_name: "Sarah Lee",
    contact_headline: "Staff Engineer at Notion",
    destination_label: "Sends as a LinkedIn message",
    safe_to_auto_send: true,
    draft_id: "draft-3",
    draft_body:
      "Hi Sarah, thanks for connecting! Your post on async collaboration patterns landed at exactly the right time for me — I'm working through similar challenges on my current project. Would be happy to swap notes sometime if you're open to it.",
    draft_status: "sent",
  },
  {
    id: "email-4",
    message_id: "<linkedin-accept-diego-004@linkedin.com>",
    from_address: "invitations@linkedin.com",
    from_name: "LinkedIn",
    reply_to: "reply+diego-bbb222@linkedin.com",
    subject: "Diego Ramirez accepted your invitation",
    body_snippet:
      "Diego Ramirez is now a connection. Diego is a Founder at a stealth AI startup, previously Staff Engineer at Anthropic.",
    body_full:
      "Diego Ramirez is now a connection. Diego is a Founder at a stealth AI startup, previously Staff Engineer at Anthropic. He's exploring agent architecture for code review.",
    category: "linkedin_accepted",
    received_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2d ago
    contact_name: "Diego Ramirez",
    contact_headline: "Founder at stealth AI startup",
    destination_label: "Sends as a LinkedIn message",
    safe_to_auto_send: true,
    draft_id: null,
    draft_body: null,
    draft_status: null,
  },
  {
    id: "email-5",
    message_id: "<recruiter-email-005@stripe.com>",
    from_address: "priya.patel@stripe.com",
    from_name: "Priya Patel",
    reply_to: "priya.patel@stripe.com",
    subject: "Re: Your application for Senior Frontend Engineer",
    body_snippet:
      "Hi! Thanks so much for applying — your portfolio looks great. Can we hop on a call next week to chat about the role and your background?",
    body_full:
      "Hi! Thanks so much for applying — your portfolio looks great. Can we hop on a call next week to chat about the role and your background? Let me know what days work for you, I'm flexible Tue–Thu afternoon PST.",
    category: "needs_reply",
    received_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30m ago
    contact_name: "Priya Patel",
    contact_headline: "Senior Technical Recruiter at Stripe",
    destination_label: "Reply to priya.patel@stripe.com",
    safe_to_auto_send: true,
    draft_id: null,
    draft_body: null,
    draft_status: null,
  },
  {
    id: "email-6",
    message_id: "<linkedin-digest-006@linkedin.com>",
    from_address: "notifications@linkedin.com",
    from_name: "LinkedIn",
    reply_to: null,
    subject: "Your weekly digest: 12 posts from your network",
    body_snippet:
      "People you may know this week, trending posts, and 3 jobs that match your profile.",
    body_full:
      "People you may know this week, trending posts, and 3 jobs that match your profile.",
    category: "fyi",
    received_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3d ago
    contact_name: "LinkedIn",
    contact_headline: "Weekly digest",
    destination_label: "No reply expected — this is a digest",
    safe_to_auto_send: false,
    draft_id: null,
    draft_body: null,
    draft_status: null,
  },
];

// ============================================================
// Canned drafts — keyed by email_id
// One default draft per email; variants for regenerate()
// ============================================================

export const CANNED_DRAFTS = {
  "email-1": {
    default:
      "Hi Priya, thanks so much for connecting! I really enjoyed your recent post about reducing bias in technical interviews — it's something I've been thinking about a lot. Would love to chat if any Stripe engineering roles feel like a fit for my background.",
    shorter:
      "Hi Priya, thanks for connecting! Loved your post on reducing bias in interviews. Would love to chat if any Stripe eng roles fit my background.",
    warmer:
      "Hi Priya! Thanks so much for connecting — your post on reducing bias in tech interviews genuinely made my week. It's something I keep coming back to. Would be lovely to chat if any Stripe roles feel right — happy to share my portfolio whenever's convenient for you.",
    more_formal:
      "Hello Ms. Patel, thank you for connecting. I appreciated your recent post on reducing bias in technical interviews; it resonated with my own observations. I would welcome the opportunity to discuss any engineering openings at Stripe that align with my background. Please let me know a convenient time to connect.",
    more_casual:
      "Hey Priya, thanks for connecting! Your post on reducing bias in interviews really landed for me — been thinking about it a lot. Would love to chat if any Stripe roles feel like a fit, no rush at all.",
  },
  "email-2": {
    default:
      "Hi Marcus, thanks for connecting! I've been a Linear user since the early days and really admire the editor's performance work — the canvas implementation is genuinely inspiring. Would love to learn more about what the senior FE role looks like.",
    shorter:
      "Hi Marcus, thanks for connecting! Big Linear fan — the editor's perf work is genuinely inspiring. Would love to learn more about the senior FE role.",
    warmer:
      "Hi Marcus! Thanks so much for connecting — I've been a Linear user since the very early days, and the editor's performance work genuinely inspired me to dig into canvas rendering myself. Would absolutely love to chat about the senior FE role whenever you have time.",
    more_formal:
      "Hello Mr. Chen, thank you for connecting. I have used Linear since its early releases and have considerable respect for the editor's performance engineering, particularly the canvas implementation. I would appreciate the opportunity to learn more about the senior frontend role.",
    more_casual:
      "Hey Marcus, thanks for connecting! Long-time Linear fan here — the canvas perf work in the editor is genuinely next-level. Would love to learn more about the senior FE role whenever works.",
  },
  "email-3": {
    default:
      "Hi Sarah, thanks for connecting! Your post on async collaboration patterns landed at exactly the right time for me — I'm working through similar challenges on my current project. Would be happy to swap notes sometime if you're open to it.",
    shorter:
      "Hi Sarah, thanks for connecting! Your async collaboration post hit at exactly the right time for me. Would love to swap notes sometime.",
    warmer:
      "Hi Sarah! Thanks so much for connecting. Your post on async collaboration patterns landed at exactly the right moment for me — I'm wrestling with the same challenges on my current project and your framing really clarified things. Would be so happy to swap notes sometime if you're ever open to it.",
    more_formal:
      "Hello Ms. Lee, thank you for connecting. Your recent post on asynchronous collaboration patterns was both timely and instructive — I am currently navigating similar challenges. I would welcome an opportunity to exchange perspectives at your convenience.",
    more_casual:
      "Hey Sarah, thanks for connecting! Your async collab post hit at exactly the right time for me — wrestling with the same stuff on my current project. Would love to swap notes sometime if you're open.",
  },
  "email-4": {
    default:
      "Hi Diego, thanks for connecting! Would love to hear more about what you're building — agent architecture for code review is a space I've been watching closely. Happy to share thoughts or compare notes whenever you're ready to talk about it.",
    shorter:
      "Hi Diego, thanks for connecting! Would love to hear more about the code review agent work — been watching the space closely. Happy to compare notes whenever.",
    warmer:
      "Hi Diego! Thanks so much for connecting. Agent architecture for code review is a space I've been following really closely — would absolutely love to hear what you're building whenever you're able to share. Happy to swap thoughts in the meantime too.",
    more_formal:
      "Hello Mr. Ramirez, thank you for connecting. The application of agent architecture to code review is an area of considerable interest to me. I would welcome the opportunity to learn more about your work when convenient.",
    more_casual:
      "Hey Diego, thanks for connecting! Code review agents are something I've been watching closely — would love to hear what you're building whenever you can share. Happy to compare notes too.",
  },
  "email-5": {
    default:
      "Hi Priya, thanks so much for getting back to me so quickly! Tuesday or Wednesday afternoon PST both work great on my end — let me know which fits better and I'll send a calendar invite. Looking forward to chatting about the role.",
    shorter:
      "Hi Priya, thanks for the quick reply! Tue or Wed afternoon PST both work for me — let me know which fits and I'll send a calendar invite.",
    warmer:
      "Hi Priya! Thanks so much for getting back to me so quickly — really appreciate it. Tuesday or Wednesday afternoon PST both work beautifully on my end. Just let me know which day suits you better and I'll fire over a calendar invite right away. Really looking forward to chatting about the role!",
    more_formal:
      "Hello Ms. Patel, thank you for your prompt response. Tuesday or Wednesday afternoon PST would both be suitable on my end. Please advise which is preferable and I will send a calendar invitation accordingly. I look forward to discussing the role.",
    more_casual:
      "Hey Priya, thanks for the quick reply! Tue or Wed afternoon PST both work for me — let me know which fits and I'll send over a calendar invite. Looking forward to it.",
  },
};

// ============================================================
// Sample drafts (already in the queue — to show off the outbox)
// ============================================================

export const SAMPLE_DRAFTS_INITIAL = [
  // email-2: Marcus — already approved, sitting in queue
  {
    id: "draft-2",
    email_id: "email-2",
    body: CANNED_DRAFTS["email-2"].default,
    status: "approved",
    error_message: null,
    attempts: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    approved_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    sent_at: null,
  },
  // email-3: Sarah — already sent (historical)
  {
    id: "draft-3",
    email_id: "email-3",
    body: CANNED_DRAFTS["email-3"].default,
    status: "sent",
    error_message: null,
    attempts: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
    approved_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    sent_at: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
  },
  // email-1: Priya — pending (user hasn't approved yet)
  {
    id: "draft-1",
    email_id: "email-1",
    body: CANNED_DRAFTS["email-1"].default,
    status: "pending",
    error_message: null,
    attempts: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
    approved_at: null,
    sent_at: null,
  },
];

// ============================================================
// Health-check response (so HealthBar shows green in demo mode)
// ============================================================

export const DEMO_HEALTH = {
  gmail_configured: true,
  ollama: {
    status: "ok",
    url: "(in-browser demo)",
    configured_model: "gemma3:1b",
    available_models: ["gemma3:1b"],
    needs_pull: null,
  },
  model: "gemma3:1b",
};

// ============================================================
// Per-install token — in demo mode, just a placeholder.
// The demo-api doesn't validate it.
// ============================================================

export const DEMO_TOKEN = "demo-mode-no-auth-required";

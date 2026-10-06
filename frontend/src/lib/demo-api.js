// In-browser demo API — same interface as lib/api.js but with no backend.
// All data lives in memory. Simulates:
//   - LLM latency (1.2-1.8s for generate, like real Gemma on 4GB)
//   - Offline state (when isOffline is true, flush does nothing)
//   - Background send loop (every 4s when online + drafts queued)
//
// State is module-level so it persists across route changes within a session.

import {
  SAMPLE_EMAILS,
  SAMPLE_DRAFTS_INITIAL,
  CANNED_DRAFTS,
  DEMO_HEALTH,
  DEMO_TOKEN,
} from "./demo-data";

// ============================================================
// In-memory state
// ============================================================

let _emails = SAMPLE_EMAILS.map((e) => ({ ...e }));
let _drafts = SAMPLE_DRAFTS_INITIAL.map((d) => ({ ...d }));
let _isOffline = false;
let _loopStarted = false;
let _loopListeners = new Set(); // notify subscribers on state change

// ============================================================
// Helpers
// ============================================================

function _delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _notify() {
  // Snapshot the current state and send to all subscribers
  const snapshot = { emails: _emails, drafts: _drafts, isOffline: _isOffline };
  _loopListeners.forEach((cb) => cb(snapshot));
}

export function subscribe(cb) {
  _loopListeners.add(cb);
  return () => _loopListeners.delete(cb);
}

export function getState() {
  return { emails: _emails, drafts: _drafts, isOffline: _isOffline };
}

export function setOffline(value) {
  _isOffline = !!value;
  _notify();
}

export function isOfflineNow() {
  return _isOffline;
}

// ============================================================
// Background "send loop" — runs every 4s when online + has queued drafts
// Faster than the real 60s so demo viewers see it happen
// ============================================================

function _startLoop() {
  if (_loopStarted) return;
  _loopStarted = true;
  setInterval(() => {
    if (_isOffline) return; // do nothing when offline
    const queued = _drafts.filter((d) => d.status === "approved");
    if (queued.length === 0) return;

    // Send the oldest one (simulates SMTP delivery)
    const toSend = queued.sort((a, b) => {
      const aTime = new Date(a.approved_at).getTime();
      const bTime = new Date(b.approved_at).getTime();
      return aTime - bTime;
    })[0];

    // Mark as sending → wait briefly → mark as sent
    toSend.status = "sending";
    toSend.last_attempt_at = new Date().toISOString();
    _notify();

    setTimeout(() => {
      toSend.status = "sent";
      toSend.sent_at = new Date().toISOString();
      toSend.attempts = (toSend.attempts || 0) + 1;
      _notify();
    }, 1200); // 1.2s in "sending" state — long enough to see the airmail stripe animate
  }, 4000); // check every 4s
}

// Start the loop on first import
if (typeof window !== "undefined") {
  _startLoop();
}

// ============================================================
// Simulated API — same interface as lib/api.js
// ============================================================

function _emailWithDraft(emailId) {
  const email = _emails.find((e) => e.id === emailId);
  if (!email) return null;
  // Find latest draft for this email
  const emailDrafts = _drafts
    .filter((d) => d.email_id === emailId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestDraft = emailDrafts[0] || null;
  return {
    ...email,
    draft_id: latestDraft?.id || null,
    draft_body: latestDraft?.body || null,
    draft_status: latestDraft?.status || null,
  };
}

function _draftToOut(draft) {
  return {
    id: draft.id,
    email_id: draft.email_id,
    body: draft.body,
    status: draft.status,
    error_message: draft.error_message || null,
    attempts: draft.attempts || 0,
    created_at: draft.created_at,
    approved_at: draft.approved_at || null,
    sent_at: draft.sent_at || null,
  };
}

export const api = {
  // ===== Read-only =====

  health: async () => {
    await _delay(80);
    return DEMO_HEALTH;
  },

  listEmails: async (category, signal) => {
    await _delay(150);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const list = category
      ? _emails.filter((e) => e.category === category)
      : _emails;
    // Return emails with their latest draft state
    return list.map((e) => _emailWithDraft(e.id));
  },

  listDrafts: async (status) => {
    await _delay(100);
    const list = status ? _drafts.filter((d) => d.status === status) : _drafts;
    return list
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(_draftToOut);
  },

  stats: async () => {
    await _delay(80);
    const count = (status) => _drafts.filter((d) => d.status === status).length;
    return {
      emails: _emails.length,
      drafts: _drafts.length,
      approved_pending_send: count("approved"),
      sending: count("sending"),
      sent: count("sent"),
      failed: count("failed"),
      dead: count("dead"),
    };
  },

  // ===== Token (no-op in demo) =====
  // Override the real fetchJSON — the demo doesn't need a token

  // ===== Mutating =====

  refreshInbox: async () => {
    // Simulate IMAP fetch latency
    await _delay(900);
    // Return current emails (already in memory) — in a real app this would
    // fetch fresh from Gmail. In demo, we just return what we have.
    return _emails.map((e) => _emailWithDraft(e.id));
  },

  generateDraft: async (emailId) => {
    // Simulate Gemma 3 1B inference time on a 4GB laptop
    // 1.2-1.8s feels realistic — long enough to see the loading state
    const delay = 1200 + Math.random() * 600;
    await _delay(delay);

    const email = _emails.find((e) => e.id === emailId);
    if (!email) throw new Error("Email not found");

    const cannedSet = CANNED_DRAFTS[emailId];
    if (!cannedSet) throw new Error("No canned draft available for this email");

    const newDraft = {
      id: `draft-${Date.now()}`,
      email_id: emailId,
      body: cannedSet.default,
      status: "pending",
      error_message: null,
      attempts: 0,
      created_at: new Date().toISOString(),
      approved_at: null,
      sent_at: null,
    };
    _drafts.push(newDraft);
    _notify();
    return _draftToOut(newDraft);
  },

  regenerateDraft: async (emailId, variant, _existingBody) => {
    await _delay(800 + Math.random() * 500);
    const cannedSet = CANNED_DRAFTS[emailId];
    if (!cannedSet) throw new Error("No canned drafts available for this email");
    const variantBody = cannedSet[variant] || cannedSet.default;

    const newDraft = {
      id: `draft-${Date.now()}`,
      email_id: emailId,
      body: variantBody,
      status: "pending",
      error_message: null,
      attempts: 0,
      created_at: new Date().toISOString(),
      approved_at: null,
      sent_at: null,
    };
    _drafts.push(newDraft);
    _notify();
    return _draftToOut(newDraft);
  },

  approveDraft: async (draftId, body) => {
    await _delay(120);
    const draft = _drafts.find((d) => d.id === draftId);
    if (!draft) throw new Error("Draft not found");
    if (body !== undefined && body !== null && body.length > 0) {
      draft.body = body;
    }
    draft.status = "approved";
    draft.approved_at = new Date().toISOString();
    _notify();
    return _draftToOut(draft);
  },

  rejectDraft: async (draftId) => {
    await _delay(120);
    const draft = _drafts.find((d) => d.id === draftId);
    if (!draft) throw new Error("Draft not found");
    draft.status = "rejected";
    _notify();
    return _draftToOut(draft);
  },

  flushQueue: async () => {
    await _delay(200);
    if (_isOffline) {
      // When offline: nothing sends. This is the demo's "watch replies wait" moment.
      const remaining = _drafts.filter(
        (d) => d.status === "approved" || d.status === "failed"
      ).length;
      return { sent: 0, failed: 0, claimed: 0, queue_remaining: remaining };
    }
    // When online: trigger the loop's send path immediately (instead of waiting up to 4s)
    const queued = _drafts
      .filter((d) => d.status === "approved")
      .sort((a, b) => new Date(a.approved_at).getTime() - new Date(b.approved_at).getTime());

    if (queued.length === 0) {
      return { sent: 0, failed: 0, claimed: 0, queue_remaining: 0 };
    }

    const toSend = queued[0];
    toSend.status = "sending";
    toSend.last_attempt_at = new Date().toISOString();
    _notify();

    // After 1.2s, mark as sent
    await _delay(1200);
    toSend.status = "sent";
    toSend.sent_at = new Date().toISOString();
    toSend.attempts = (toSend.attempts || 0) + 1;
    _notify();

    return {
      sent: 1,
      failed: 0,
      claimed: 1,
      queue_remaining: _drafts.filter((d) => d.status === "approved").length,
    };
  },

  retryFailed: async () => {
    await _delay(120);
    let count = 0;
    _drafts.forEach((d) => {
      if (d.status === "failed") {
        d.status = "approved";
        d.last_attempt_at = new Date(Date.now() - 1000 * 3600).toISOString();
        count++;
      }
    });
    _notify();
    return { reset_count: count, max_attempts: 5 };
  },
};

// Demo doesn't validate tokens — return a dummy so the api.js's _getToken() resolves
export async function _getToken() {
  return DEMO_TOKEN;
}

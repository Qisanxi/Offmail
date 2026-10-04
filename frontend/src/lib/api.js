// API client for the Offmail backend

const BASE = "/api";

// Types are documented here as JSDoc for editor hinting, but no runtime types.

/**
 * @typedef {Object} EmailOut
 * @property {string} id
 * @property {string} message_id
 * @property {string} from_address
 * @property {string|null} from_name
 * @property {string|null} reply_to
 * @property {string|null} subject
 * @property {string|null} body_snippet
 * @property {string} category  // "linkedin_accepted" | "needs_reply" | "fyi" | "unknown"
 * @property {string} received_at
 * @property {string|null} contact_name
 * @property {string|null} draft_id
 * @property {string|null} draft_body
 * @property {string|null} draft_status  // "pending" | "approved" | "sent" | "failed" | "rejected"
 */

/**
 * @typedef {Object} DraftOut
 * @property {string} id
 * @property {string} email_id
 * @property {string} body
 * @property {string} status
 * @property {string|null} error_message
 * @property {number} attempts
 * @property {string} created_at
 * @property {string|null} approved_at
 * @property {string|null} sent_at
 */

/**
 * @typedef {Object} HealthResponse
 * @property {boolean} gmail_configured
 * @property {Object} ollama
 * @property {string} ollama.status
 * @property {string} ollama.url
 * @property {string} ollama.configured_model
 * @property {string[]} ollama.available_models
 * @property {string|null} ollama.needs_pull
 * @property {string} [ollama.error]
 * @property {string} db_url
 * @property {string} model
 */

/**
 * @typedef {Object} Stats
 * @property {number} emails
 * @property {number} drafts
 * @property {number} approved_pending_send
 * @property {number} sent
 * @property {number} failed
 */

async function fetchJSON(url, init) {
  const resp = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!resp.ok) {
    let msg = `${resp.status}`;
    try {
      const body = await resp.json();
      msg = body.detail || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return resp.json();
}

export const api = {
  health: () => fetchJSON(`${BASE}/health`),

  refreshInbox: () =>
    fetchJSON(`${BASE}/inbox/refresh`, { method: "POST" }),

  listEmails: (category) =>
    fetchJSON(`${BASE}/emails${category ? `?category=${category}` : ""}`),

  generateDraft: (emailId) =>
    fetchJSON(`${BASE}/emails/${emailId}/draft`, { method: "POST" }),

  approveDraft: (draftId, body) =>
    fetchJSON(`${BASE}/drafts/${draftId}/approve`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  rejectDraft: (draftId) =>
    fetchJSON(`${BASE}/drafts/${draftId}/reject`, { method: "POST" }),

  listDrafts: (status) =>
    fetchJSON(`${BASE}/drafts${status ? `?status=${status}` : ""}`),

  flushQueue: () =>
    fetchJSON(`${BASE}/queue/flush`, { method: "POST" }),

  retryFailed: () =>
    fetchJSON(`${BASE}/queue/retry-failed`, { method: "POST" }),

  stats: () => fetchJSON(`${BASE}/stats`),
};

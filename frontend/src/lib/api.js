// API client for the Offmail backend

const BASE = "/api";

/**
 * @typedef {Object} EmailOut
 * @property {string} id
 * @property {string} message_id
 * @property {string} from_address
 * @property {string|null} from_name
 * @property {string|null} reply_to
 * @property {string|null} subject
 * @property {string|null} body_snippet
 * @property {string} category
 * @property {string} received_at
 * @property {string|null} contact_name
 * @property {string|null} contact_headline  // e.g. "Recruiter at Stripe"
 * @property {string|null} destination_label  // e.g. "Sends as a LinkedIn message"
 * @property {boolean} safe_to_auto_send      // false when reply-to is unsafe
 * @property {string|null} draft_id
 * @property {string|null} draft_body
 * @property {string|null} draft_status
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
 * @property {string} model
 */

/**
 * @typedef {Object} Stats
 * @property {number} emails
 * @property {number} drafts
 * @property {number} approved_pending_send
 * @property {number} sending
 * @property {number} sent
 * @property {number} failed
 * @property {number} dead
 */

// Auth: the Vite dev proxy adds the X-Offmail-Token header to every /api
// request (see vite.config.js), so the token never reaches browser JavaScript.

function _normalizeError(status, body) {
  // FastAPI 422 returns detail as an array of validation errors
  if (Array.isArray(body?.detail)) {
    return body.detail.map((e) => e.msg || JSON.stringify(e)).join("; ");
  }
  if (typeof body?.detail === "string") return body.detail;
  return `Request failed (HTTP ${status})`;
}

async function fetchJSON(url, init) {
  const headers = { "Content-Type": "application/json", ...(init?.headers || {}) };
  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok) {
    let body = null;
    try {
      body = await resp.json();
    } catch {
      // ignore
    }
    throw new Error(_normalizeError(resp.status, body));
  }
  // Handle 204 No Content
  if (resp.status === 204) return null;
  return resp.json();
}

export const api = {
  health: () => fetchJSON(`${BASE}/health`),

  listEmails: (category, signal) =>
    fetchJSON(`${BASE}/emails${category ? `?category=${category}` : ""}`, { signal }),

  listDrafts: (status) =>
    fetchJSON(`${BASE}/drafts${status ? `?status=${status}` : ""}`),

  stats: () => fetchJSON(`${BASE}/stats`),

  refreshInbox: () =>
    fetchJSON(`${BASE}/inbox/refresh`, { method: "POST" }),

  generateDraft: (emailId) =>
    fetchJSON(
      `${BASE}/emails/${emailId}/draft`,
      { method: "POST" }
    ),

  regenerateDraft: (emailId, variant, existingBody) =>
    fetchJSON(
      `${BASE}/emails/${emailId}/regenerate`,
      {
        method: "POST",
        body: JSON.stringify({ variant, existing_body: existingBody }),
      }
    ),

  approveDraft: (draftId, body) =>
    fetchJSON(
      `${BASE}/drafts/${draftId}/approve`,
      { method: "POST", body: JSON.stringify({ body }) }
    ),

  rejectDraft: (draftId) =>
    fetchJSON(
      `${BASE}/drafts/${draftId}/reject`,
      { method: "POST" }
    ),

  flushQueue: () =>
    fetchJSON(`${BASE}/queue/flush`, { method: "POST" }),

  retryFailed: () =>
    fetchJSON(`${BASE}/queue/retry-failed`, { method: "POST" }),
};

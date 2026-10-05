// InboxList — clean rows showing name + role/headline.
// No category badge (the filter chips above already say which category is shown).
// Color marker on the left edge indicates the row's status at a glance.

const MARKER_BY_CATEGORY = {
  linkedin_accepted: "row-marker-linkedin",
  needs_reply: "row-marker-reply",
  fyi: "row-marker-fyi",
  unknown: "row-marker",
};

const STATUS_DOT_BY_DRAFT = {
  sent: "status-dot-ok",
  approved: "status-dot-ok",
  sending: "status-dot-warn",
  failed: "status-dot-error",
  dead: "status-dot-error",
  rejected: "status-dot-error",
};

// Props:
//   emails: EmailOut[]
//   selectedId: string | null
//   onSelect: (email) => void
export function InboxList({ emails, selectedId, onSelect }) {
  if (emails.length === 0) {
    return (
      <div className="card p-8 text-center" style={{ color: "var(--color-ink-muted)" }}>
        <p className="mb-1 text-sm">Inbox is empty.</p>
        <p className="text-xs" style={{ color: "var(--color-ink-faint)" }}>
          Click &ldquo;Refresh&rdquo; to fetch latest from Gmail.
        </p>
      </div>
    );
  }

  return (
    <ul className="card divide-y" style={{ borderColor: "var(--color-border-soft)" }}>
      {emails.map((email) => {
        const markerClass = MARKER_BY_CATEGORY[email.category] || "row-marker";
        const dotClass = email.draft_status
          ? STATUS_DOT_BY_DRAFT[email.draft_status] || ""
          : "";
        const isSelected = selectedId === email.id;

        return (
          <li key={email.id}>
            <button
              onClick={() => onSelect(email)}
              className={`w-full text-left py-3 pr-3 transition-colors ${markerClass} ${
                isSelected ? "bg-[var(--color-accent-soft)]" : "hover:bg-[var(--color-bg-soft)]"
              }`}
              style={{ paddingTop: "0.75rem", paddingBottom: "0.75rem" }}
              aria-current={isSelected ? "true" : undefined}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate" style={{ color: "var(--color-ink)" }}>
                      {email.contact_name || email.from_name || email.from_address}
                    </span>
                    {dotClass && (
                      <span className={dotClass} aria-hidden="true" style={{ width: 6, height: 6 }} />
                    )}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--color-ink-muted)" }}>
                    {email.contact_headline || trimSubject(email.subject) || "(no subject)"}
                  </div>
                </div>
                <div className="time-quiet shrink-0">
                  {formatRelative(email.received_at)}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function trimSubject(subject) {
  if (!subject) return "";
  // LinkedIn acceptance subjects often say "X accepted your invitation" — redundant with the name shown.
  // Replace with a softer hint.
  if (/accepted your (?:invitation|connection request|request to connect)/i.test(subject)) {
    return "Accepted your invitation";
  }
  return subject;
}

function formatRelative(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (isNaN(then)) return "";
  const now = new Date();
  const diffMs = now - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

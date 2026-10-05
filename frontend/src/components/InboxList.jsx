// InboxList — name, one quiet line, time. A coloured left edge marks the category
// and a dot marks the draft state; no badges, no labels.

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
};

// Props: emails, selectedId, onSelect(email)
export function InboxList({ emails, selectedId, onSelect }) {
  if (emails.length === 0) {
    return (
      <p className="px-4 py-10 text-sm text-center" style={{ color: "var(--color-ink-muted)" }}>
        Nothing here yet. Press Refresh.
      </p>
    );
  }

  return (
    <ul>
      {emails.map((email) => {
        const markerClass = MARKER_BY_CATEGORY[email.category] || "row-marker";
        const dotClass = email.draft_status ? STATUS_DOT_BY_DRAFT[email.draft_status] : "";
        const isSelected = selectedId === email.id;

        return (
          <li key={email.id} style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
            <button
              onClick={() => onSelect(email)}
              className={`w-full text-left py-3 pr-4 transition-colors ${markerClass}`}
              style={{ background: isSelected ? "var(--color-row-selected)" : undefined }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = "var(--color-row-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isSelected ? "var(--color-row-selected)" : "";
              }}
              aria-current={isSelected ? "true" : undefined}
            >
              <div className="flex items-baseline gap-2">
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-medium text-sm truncate" style={{ color: "var(--color-ink)" }}>
                    {email.contact_name || email.from_name || email.from_address}
                  </span>
                  {dotClass && (
                    <span className={dotClass} aria-hidden="true" style={{ width: 6, height: 6 }} />
                  )}
                </span>
                <span className="time-quiet shrink-0">{formatRelative(email.received_at)}</span>
              </div>
              <div className="text-xs truncate mt-0.5" style={{ color: "var(--color-ink-muted)" }}>
                {email.contact_headline || trimSubject(email.subject) || "(no subject)"}
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
  // "Priya accepted your invitation" repeats the name shown above it.
  if (/accepted your (?:invitation|connection request|request to connect)/i.test(subject)) {
    return "Accepted your invitation";
  }
  return subject;
}

function formatRelative(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  if (isNaN(then)) return "";
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

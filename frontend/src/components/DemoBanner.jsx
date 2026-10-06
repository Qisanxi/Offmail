// DemoBanner — shown at top of every demo-mode page.
// "Demo with sample data · Nothing is sent" + Offline toggle (the demo's signature feature).
//
// Props:
//   isOffline: boolean — current offline state
//   onToggleOffline: (newValue: boolean) => void
export function DemoBanner({ isOffline, onToggleOffline }) {
  return (
    <div
      className="alert-inline"
      style={{
        background: isOffline ? "var(--color-warning-soft)" : "var(--color-accent-soft)",
        color: isOffline ? "var(--color-warning)" : "var(--color-accent)",
        border: `1px solid ${isOffline ? "var(--color-warning)" : "var(--color-accent)"}`,
        marginBottom: 12,
        padding: "10px 14px",
        borderRadius: 6,
        fontSize: "0.8125rem",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>
          {isOffline ? "Demo · You're offline" : "Demo with sample data"}
        </strong>
        {" — "}
        <span>
          {isOffline
            ? "approved drafts will queue in the outbox. Toggle back online to send them."
            : "this is an in-browser demo. Nothing is sent, no real Gmail or LinkedIn is involved."}
        </span>
      </div>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          userSelect: "none",
          fontWeight: 500,
        }}
      >
        <input
          type="checkbox"
          checked={isOffline}
          onChange={(e) => onToggleOffline(e.target.checked)}
          style={{ cursor: "pointer" }}
          aria-label="Toggle offline mode"
        />
        Offline mode
      </label>
    </div>
  );
}

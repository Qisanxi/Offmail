// Compact status indicators. Emojis removed — plain text + color.

export function DraftStatusBadge({ status }) {
  if (!status) return null;
  const map = {
    pending: { label: "Draft", cls: "badge-gray" },
    approved: { label: "Queued", cls: "badge-blue" },
    sending: { label: "Sending", cls: "badge-yellow" },
    sent: { label: "Sent", cls: "badge-green" },
    failed: { label: "Failed", cls: "badge-red" },
    dead: { label: "Dead", cls: "badge-red" },
    rejected: { label: "Dismissed", cls: "badge-gray" },
  };
  const m = map[status];
  if (!m) return null;
  return <span className={m.cls}>{m.label}</span>;
}

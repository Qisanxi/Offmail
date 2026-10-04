import { CategoryBadge, DraftStatusBadge } from "./Badges";

// Props:
//   emails: EmailOut[]
//   selectedId: string | null
//   onSelect: (email: EmailOut) => void
export function InboxList({ emails, selectedId, onSelect }) {
  if (emails.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">
        <p className="mb-2">No emails yet.</p>
        <p className="text-sm">Click "Refresh inbox" to fetch latest from Gmail.</p>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-slate-100">
      {emails.map((email) => (
        <button
          key={email.id}
          onClick={() => onSelect(email)}
          className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
            selectedId === email.id ? "bg-brand-50" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CategoryBadge category={email.category} />
                <DraftStatusBadge status={email.draft_status} />
              </div>
              <div className="font-medium text-slate-900 truncate">
                {email.contact_name || email.from_name || email.from_address}
              </div>
              <div className="text-sm text-slate-600 truncate">
                {email.subject || "(no subject)"}
              </div>
              <div className="text-xs text-slate-400 truncate mt-1">
                {email.body_snippet || "—"}
              </div>
            </div>
            <div className="text-xs text-slate-400 shrink-0">
              {new Date(email.received_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// Category + status badges for the inbox list

export function CategoryBadge({ category }) {
  switch (category) {
    case "linkedin_accepted":
      return <span className="badge-blue">LinkedIn accepted</span>;
    case "needs_reply":
      return <span className="badge-yellow">Needs reply</span>;
    case "fyi":
      return <span className="badge-gray">FYI</span>;
    default:
      return <span className="badge-gray">Unknown</span>;
  }
}

export function DraftStatusBadge({ status }) {
  if (!status) return null;
  switch (status) {
    case "sent":
      return <span className="badge-green">Sent</span>;
    case "approved":
      return <span className="badge-blue">Queued</span>;
    case "failed":
      return <span className="badge-red">Failed</span>;
    case "rejected":
      return <span className="badge-gray">Rejected</span>;
    default:
      return <span className="badge-gray">Draft</span>;
  }
}

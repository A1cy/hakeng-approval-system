// Status pill — the hue is carried by a dot + ring + faint tint (all from theme
// tokens), while the label stays `text-foreground` so contrast holds in light
// AND dark mode. No hardcoded colors.

type Variant = { dot: string; chip: string; pulse?: boolean }

const STATUS: Record<string, Variant> = {
  Draft: { dot: 'bg-muted-foreground/60', chip: 'bg-muted/50 ring-border' },
  'Pending Approval': { dot: 'bg-warning', chip: 'bg-warning/10 ring-warning/40', pulse: true },
  Pending: { dot: 'bg-warning', chip: 'bg-warning/10 ring-warning/40', pulse: true },
  Approved: { dot: 'bg-primary', chip: 'bg-primary/10 ring-primary/40' },
  Rejected: { dot: 'bg-destructive', chip: 'bg-destructive/10 ring-destructive/40' },
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const v = STATUS[status] ?? STATUS.Draft
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-foreground ring-1 ${v.chip} ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {v.pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${v.dot}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${v.dot}`} />
      </span>
      {status}
    </span>
  )
}

export function PriorityTag({ priority }: { priority: string }) {
  // Priority weight shown via icon weight, not new colors.
  const bars = priority === 'High' ? 3 : priority === 'Medium' ? 2 : 1
  const tone =
    priority === 'High'
      ? 'text-destructive'
      : priority === 'Medium'
        ? 'text-warning'
        : 'text-muted-foreground'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span className={`inline-flex items-end gap-0.5 ${tone}`} aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-0.5 rounded-full bg-current"
            style={{ height: `${4 + i * 2}px`, opacity: i <= bars ? 1 : 0.25 }}
          />
        ))}
      </span>
      {priority}
    </span>
  )
}

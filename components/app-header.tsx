import Link from 'next/link'

// Sticky glass header with the HAK wordmark. Pure theme tokens.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 glass border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/requests" className="group flex items-center gap-3">
          {/* angular HAK mark, drawn from the primary token */}
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/12 ring-1 ring-primary/30 transition group-hover:ring-primary/50">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-primary" fill="none" aria-hidden>
              <path d="M5 4 L12 12 L5 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13 4 L20 12 L13 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight text-foreground">HAK Engineering</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Approval Workflow
            </span>
          </span>
        </Link>

        <Link
          href="/requests/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition hover:brightness-110 hover:shadow-md active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          New Request
        </Link>
      </div>
    </header>
  )
}

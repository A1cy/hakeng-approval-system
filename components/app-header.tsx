import Link from 'next/link'

// Sticky glass header with the real HAK Engineering logo. Pure theme tokens.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 glass border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/requests" className="group flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hak-logo.png" alt="HAK Engineering" className="h-9 w-auto transition group-hover:opacity-80" />
          <span className="hidden h-7 w-px bg-border sm:block" aria-hidden />
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
            Approval Workflow
          </span>
        </Link>

        <Link
          href="/requests/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition hover:brightness-110 hover:shadow-md active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">New Request</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>
    </header>
  )
}

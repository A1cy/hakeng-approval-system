# Design Decisions

A concise explanation of the **why** behind the key architectural choices. (For
the broader list of requirement interpretations and constraints, see
[ASSUMPTIONS.md](./ASSUMPTIONS.md).)

---

## 1. Why Next.js full-stack (not a separate backend)?

A single Next.js App Router codebase hosts both the React UI and the REST API
(via route handlers under `app/api/`).

- **Shared types end-to-end.** The `lib/workflows.ts` types (`ApproverStatus`,
  `RequestStatus`, etc.) are imported by both the API routes and the React pages.
  No drift between client and server contracts.
- **One deploy target, zero CORS.** Same-origin requests, one Vercel project.
- **Right-sized for the brief.** A 4–6 hour prototype does not benefit from the
  operational overhead of a separately deployed API service.

**Trade-off:** tighter coupling than a microservice split. For scale, the API
layer could later be lifted out — and because the business logic is already
isolated in `lib/workflows.ts`, that move would not touch the rules themselves.

## 2. Why isolate the workflow in `lib/workflows.ts`?

The single most important design decision. The sequential-approval rules — the
part the brief explicitly flags as where candidates fail — live in **pure,
dependency-free functions**:

- `canActOnApproval()` — the sequential guard (only the lowest-sequence Pending
  approver may act).
- `computeRequestStatus()` — resolves Approved / Rejected / still-Pending.
- `validateSubmission()` / `validateRequestFields()` — all submit + create rules.
- `getCurrentPendingApprover()` / `calculateAgingDays()` — list-view derivations.

**Why this matters:**
1. The `/approve` and `/reject` routes share the exact same guard — impossible
   for them to diverge.
2. The list view's "Current Pending Approver" column uses the *same* function
   the API uses to decide whose turn it is — UI and enforcement can't disagree.
3. The rules are unit-testable with **no database and no HTTP server** — 39 tests
   run in ~11 ms, covering every branch of the state machine.

## 3. Why PostgreSQL (not MySQL/MongoDB/SQLite)?

The prototype began on SQLite for zero-setup local dev, then moved to **PostgreSQL**
so it could run on Vercel's serverless platform (SQLite needs a writable file the
serverless filesystem doesn't provide). Prisma made this a one-line `datasource`
change — the query code and business logic were untouched.

- **Relational fit.** The data is inherently relational (Request 1—N Approvers
  with a unique `(requestId, sequence)` constraint). A document store (MongoDB)
  would make the sequence-integrity constraint harder to enforce.
- **Serverless-ready.** Postgres (Neon / Vercel Postgres) is connection-poolable
  and works from Vercel functions; SQLite does not.
- **Schema sync via `prisma db push`** keeps the prototype simple — no migration
  files to maintain — while still giving a typed, enforced schema.

**Why not Prisma 7?** Prisma 7's "client" engine requires a driver adapter, which
added configuration friction with no payoff for a prototype. Pinned to the stable
**Prisma 5.22** to keep the focus on business logic.

## 4. Why sequential (not parallel) approvals?

The brief describes an ordered chain (Reviewer → Approver → Signatory) and calls
out sequential correctness as the differentiator. Sequential is modelled by:

- An integer `sequence` per approver, unique within a request.
- The guard rejects any actor who has an earlier-sequence approver still Pending.
- A single rejection short-circuits the whole request (`computeRequestStatus`
  returns `Rejected` if **any** approver is Rejected).

Parallel approval was considered and rejected: it contradicts the spec and would
make the "Current Pending Approver" column (a hard requirement) meaningless.

## 5. Why two endpoints (`/approve` and `/reject`)?

The spec's feature checklist lists `POST /api/requests/:id/approve` and
`POST /api/requests/:id/reject` as **separate** endpoints, so they are. Both
delegate to the same `canActOnApproval` guard, then set the approver's status to
`Approved` / `Rejected` respectively and recompute the request status. The split
keeps each route's intent obvious and matches the spec exactly.

## 6. Why Vercel Blob for uploads (not local disk / S3)?

User-uploaded PDFs go to **Vercel Blob**, a managed object store, because Vercel's
serverless filesystem is read-only — writing to `public/uploads/` works locally but
fails in production. `/api/upload` validates the PDF (mime/extension + 10 MB cap),
calls `put()` with a random suffix, and stores the returned public URL on `pdfPath`.

The seeded demo requests instead reference a **committed static sample**
(`public/uploads/sample-contract.pdf`), so their attachment links resolve in both
local dev and the live deploy without anyone uploading anything.

Because `pdfPath` is just a URL string, the system is storage-agnostic — Blob, a
static asset, or a future S3/R2 signed URL all work without touching the rest of
the app. **Tradeoff:** Blob is Vercel-specific; on another host the upload handler
would swap to that platform's blob/S3 equivalent.

## 7. Why no authentication (email-based actor)?

Auth is out of scope for the time box. The approver identity is supplied as
`approverEmail` on the approve/reject call — which also mirrors how a real
"click the link in your approval email" flow would identify the actor.

**Production path:** NextAuth.js (or Microsoft Entra ID for an engineering firm),
deriving the acting approver from the session instead of the request body. The
guard logic in `lib/workflows.ts` would not change — only where the email comes
from.

## 8. Database schema design

- **`Approver` as a separate table** (not embedded JSON) so we can query "all
  requests where X is the pending approver" and enforce the
  `@@unique([documentRequestId, sequence])` constraint at the DB level.
- **String enums** (`"Pending Approval"` etc.) over integer codes — self-
  documenting in raw queries, and the allowed values are centralised as
  constants in `lib/workflows.ts`.
- **`onDelete: Cascade`** on the approver relation so deleting a Draft request
  cleans up its approvers.

## 9. Features cut due to the time constraint

| Cut | Reason | Production approach |
|-----|--------|---------------------|
| Email notifications | Out of scope | Resend/SendGrid + Frappe-style scheduler |
| Authentication | Out of scope | NextAuth.js / Entra ID |
| Pagination on list | Low value at prototype scale | `?page&limit` + indexed `createdAt` |
| Drag-and-drop approver reorder | Up/down arrows suffice | `dnd-kit` |
| Real-time status updates | Polling-free refetch is enough | Pusher / WebSocket |

None of these touch the core approval correctness, which is fully implemented
and tested.

## 10. Demo seed data

`prisma/seed.ts` seeds 3 users **and** 4 Document Requests covering every status
(Draft, Pending Approval mid-flow, Approved, Rejected) with realistic approver
chains. This makes the list/report view and the approval timeline populated the
moment a reviewer runs `npm run db:seed` — no manual data entry needed to
evaluate the workflow — and is what the README screenshots are captured from. The
seed is idempotent (it clears existing requests first) and approver emails reuse
the seeded users' emails so a reviewer can immediately act as the current pending
approver. A small valid placeholder PDF ships at
`public/uploads/sample-contract.pdf` so the attachment link resolves.

---

## Summary

The architecture optimises for **correctness of the approval state machine** and
**testability**, by isolating all business rules into one pure module that the
API, the UI, and the test suite all consume. Everything else (storage, auth, DB
engine) is deliberately the simplest thing that works for a prototype, chosen so
it can be swapped for a production equivalent without rewriting the rules.

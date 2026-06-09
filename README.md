# HAK Engineering — Document Approval Workflow

A document request and approval system with a strict sequential approver workflow, PDF attachments, and a filterable request report.

## Overview

Employees raise a document request, attach a PDF, assign an ordered list of approvers, and submit it. Approvers then act one at a time in sequence — only the current pending approver can approve or reject. Any rejection rejects the whole request; once every approver has approved, the request is approved.

- Document request with 11 fields; approver child records with 8 fields
- Strict sequential approval — only the lowest-sequence pending approver may act
- PDF upload and attachment per request
- Request types: Internal Approval, Client Submission, Contract Review, Signature Request
- Priorities: Low, Medium, High
- States: Draft, Pending Approval, Approved, Rejected
- Request report with filters, current pending approver, and aging

## Live demo

**https://hakeng-approval-system.vercel.app** — deployed on Vercel with a Neon Postgres database, pre-seeded with demo data (3 users + 4 requests, one per status). To try the workflow:

1. Open a Pending Approval request (e.g. *Q3 Vendor Contract Review*).
2. Approve as the wrong approver → blocked ("not your turn").
3. Approve as the current approver → the chain advances; approve to the end → Approved.

Demo approver emails: `abdullah.alqahtani@hakeng.sa`, `mohammed.alotaibi@hakeng.sa`, `khalid.alharbi@hakeng.sa`.

> Neon's free tier auto-suspends when idle, so the first request after a pause may take ~1s to wake.

## Screenshots

**Request report** — all seven required columns, status counts, and filters:

![Requests list](./screenshots/01-requests-list.png)

**Request detail, mid-approval** — sequential timeline (Mohammed approved, Khalid is current, Abdullah waiting); only the current approver can act:

![Request detail, pending approval](./screenshots/02-detail-pending-approval.png)

**Rejected request** — one rejection rejects the whole request, with the approver's comment recorded:

![Rejected request](./screenshots/04-detail-rejected.png)

**Create request** — all fields, PDF upload, and the sequential approver builder:

![Create request](./screenshots/03-create-request.png)

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript, Prisma 5 ORM over PostgreSQL (Neon / Vercel Postgres), Vercel Blob for PDF storage, Tailwind CSS 4.

A single Next.js codebase hosts both the React UI and the REST API (route handlers under `app/api/`). All approval rules live in one pure, dependency-free module (`lib/workflows.ts`) that the API routes, the UI, and the test suite all import — so enforcement and display can never disagree.

```
app/
  api/
    requests/            # request CRUD
      route.ts           # GET (list), POST (create)
      [id]/
        route.ts         # GET, PATCH, DELETE
        submit/          # POST — submit for approval
        approve/         # POST — approve
        reject/          # POST — reject
        approvers/       # POST, DELETE — manage approvers
    upload/              # PDF upload (Vercel Blob)
    users/               # user listing
  requests/              # pages: list, new, [id] detail
prisma/
  schema.prisma          # data model
  seed.ts                # demo data seeder
lib/
  workflows.ts           # approval state machine (pure, unit-tested)
  prisma.ts              # Prisma client singleton
```

## Data model

**DocumentRequest** — `title`, `requestType`, `requestedBy` (→ User), `department`, `priority`, `dueDate`, `externalPartyName`, `externalPartyContact` (email or WhatsApp), `pdfPath`, `status`, `remarks`, timestamps.

**Approver** — `documentRequest` (→ DocumentRequest, cascade delete), `approverName`, `approverEmail`, `role` (Reviewer / Approver / Signatory), `sequence`, `status` (Pending / Approved / Rejected), `comments`, `actionDate`. A unique constraint on `(documentRequestId, sequence)` prevents duplicate positions.

## Setup

Requires Node.js 20+.

```bash
git clone <repository-url>
cd hakeng-approval-system
npm install
```

Set `DATABASE_URL` in `.env` (copy from `.env.example`) to any PostgreSQL instance — a free Neon database works:

```
DATABASE_URL="postgresql://user:password@host:5432/hakeng?schema=public"
# Optional, only to test live PDF upload:
# BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

Create the tables, seed demo data, and run:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Then open http://localhost:3000.

### Seeded users

| Name | Email | Department |
|------|-------|------------|
| Abdullah Al-Qahtani | abdullah.alqahtani@hakeng.sa | Engineering |
| Mohammed Al-Otaibi | mohammed.alotaibi@hakeng.sa | Finance |
| Khalid Al-Harbi | khalid.alharbi@hakeng.sa | Management |

## How the core pieces work

### Sequential approval

The guard is a pure function in `lib/workflows.ts` (`canActOnApproval`), applied by the approve/reject routes. An approver may act only if the request is pending, they are an approver who hasn't acted yet, and no earlier-sequence approver is still pending:

```typescript
const priorPending = approvers.find(
  (a) => a.sequence < approver.sequence && a.status === 'Pending'
)
if (priorPending) {
  return {
    allowed: false,
    code: 403,
    error: `It is not your turn to approve. ${priorPending.approverName} (sequence ${priorPending.sequence}) must act first.`,
  }
}
```

The detail page surfaces the current "Next Approver" and renders the chain as a status timeline. `computeRequestStatus` resolves the request: any rejection → Rejected; all approved → Approved; otherwise still Pending Approval.

### Submission validation

`POST /api/requests/[id]/submit` checks, server-side, that the request is a Draft, a PDF is attached, at least one approver exists, roles are valid, and the sequence is contiguous from 1 with no gaps or duplicate emails.

### PDF upload

`POST /api/upload` validates type (PDF only) and size (10 MB), stores the file in Vercel Blob, and returns a public URL saved on the request. The seeded demo requests reference a committed static sample at `/uploads/sample-contract.pdf` so links resolve without uploading.

### Approver management

While a request is Draft, approvers can be added or removed (`POST` / `DELETE /api/requests/[id]/approvers`), with automatic resequencing. After submission the approver list is locked.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/requests` | List requests (supports status / type / priority / department filters) |
| POST | `/api/requests` | Create a request (Draft) |
| GET | `/api/requests/[id]` | Get a request |
| PATCH | `/api/requests/[id]` | Update a Draft request |
| DELETE | `/api/requests/[id]` | Delete a Draft/Rejected request |
| POST | `/api/requests/[id]/submit` | Submit for approval |
| POST | `/api/requests/[id]/approve` | Approve (current approver) |
| POST | `/api/requests/[id]/reject` | Reject (current approver) |
| POST | `/api/requests/[id]/approvers` | Add approver (Draft only) |
| DELETE | `/api/requests/[id]/approvers?approverId=…` | Remove approver (Draft only) |
| POST | `/api/upload` | Upload a PDF |
| GET | `/api/users` | List users |

## Request report

The list view shows the seven columns the brief asks for — Title, Requested By, Department, Status, Current Pending Approver, Due Date, Aging in Days — plus overdue highlighting and filters by status, type, priority, and department. The current pending approver and aging are derived at read time from the same helpers the API uses.

## Tests

The approval state machine in `lib/workflows.ts` has a 39-case unit suite covering sequential enforcement, the rejection cascade, status resolution, submission validation, and the list-view derivations. The rules are pure functions, so the suite runs with no database or server.

```bash
npm test       # run once
npm run build  # production build
```

## Known limitations (prototype scope)

- No authentication — the acting approver is identified by email (mirrors a "click the link in your approval email" flow). Production would derive identity from a session (NextAuth / Entra ID); the guard logic in `lib/workflows.ts` would not change.
- No email notifications — production would send them (e.g. Resend) when an approver's turn arrives.
- Single tenant; no real-time updates (the list refetches on navigation).

## Further reading

- [PART1_REQUIREMENTS_THINKING.md](./PART1_REQUIREMENTS_THINKING.md) — Part 1: clarification questions and assumptions
- [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) — the reasoning behind each technical choice
- [PART3_ERP_ANSWERS.md](./PART3_ERP_ANSWERS.md) — Part 3: ERP / Frappe mapping

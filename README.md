# HAK Engineering - Document Approval Workflow System

A full-stack document request and approval system with sequential approver workflow, PDF attachments, and comprehensive reporting.

## 🎯 Project Overview

This system implements a **sequential approval workflow** for document requests within HAK Engineering. Key features:

- ✅ **11-field Document Request** entity (as per requirements)
- ✅ **8-field Approver** entity with sequential processing
- ✅ **Sequential approval enforcement** (approvers must act in order)
- ✅ **PDF upload** and attachment management
- ✅ **4 request types**: Internal Approval, Client Submission, Contract Review, Signature Request
- ✅ **3 priority levels**: Low, Medium, High
- ✅ **4 workflow states**: Draft, Pending Approval, Approved, Rejected
- ✅ **Comprehensive reporting** with filters and status tracking

## 📸 Screenshots

> Captured from the running app against the demo seed data (`npm run db:seed`).

**Document Requests — list / report view** (all 7 PDF columns: Title, Requested By, Department, Status, Current Pending Approver, Due Date, Aging; plus filters):

![List view](./screenshots/01-list-view.png)

**Request detail — mid-approval** (sequential timeline: approver 1 Approved, approver 2 is the current "Next Approver"; rejection/approval actions gated to the current approver):

![Detail view, pending approval](./screenshots/02-detail-pending-approval.png)

**Create request form** (all fields, PDF upload, sequential approver builder):

![Create request form](./screenshots/03-create-request-form.png)

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- **Next.js 16.2.7** (App Router) - React-based full-stack framework
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling with custom green theme

**Backend:**
- **Next.js API Routes** - RESTful API endpoints
- **Prisma 5.22** - Type-safe ORM
- **PostgreSQL** - relational database (Neon / Vercel Postgres in production)
- **Vercel Blob** - object storage for PDF uploads (serverless-friendly)

### Project Structure

```
hakeng-approval-system/
├── app/
│   ├── api/                      # API routes
│   │   ├── requests/             # Document request CRUD
│   │   │   ├── route.ts          # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET, PATCH, DELETE (by ID)
│   │   │       ├── submit/       # POST - Submit for approval
│   │   │       ├── approve/      # POST - Approve/Reject
│   │   │       └── approvers/    # POST, DELETE - Manage approvers
│   │   ├── upload/               # PDF file upload
│   │   └── users/                # User listing
│   ├── requests/                 # Frontend pages
│   │   ├── page.tsx              # List view (7 columns + filters)
│   │   ├── new/                  # Create request form
│   │   └── [id]/                 # Detail view + approval actions
│   ├── layout.tsx                # Root layout (custom fonts)
│   └── globals.css               # Custom green theme
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── seed.ts                   # Test data seeder
│   └── migrations/               # Database migrations
├── lib/
│   └── prisma.ts                 # Prisma client singleton
└── public/
    └── uploads/                  # PDF storage
```

## 📊 Database Schema

### User
- `id` (cuid), `email` (unique), `name`, `department`, `createdAt`

### DocumentRequest (11 fields)
- `id` (cuid)
- `title` - Request title
- `requestType` - Enum: "Internal Approval", "Client Submission", "Contract Review", "Signature Request"
- `requestedById` - FK to User
- `department` - Department name
- `priority` - Enum: "Low", "Medium", "High"
- `dueDate` - Target completion date
- `externalPartyName` - Optional: external company/person
- `externalPartyContact` - Optional: email or WhatsApp
- `pdfPath` - Uploaded PDF file path
- `status` - Enum: "Draft", "Pending Approval", "Approved", "Rejected"
- `remarks` - Optional notes
- `createdAt`, `updatedAt`

### Approver (8 fields) - Child of DocumentRequest
- `id` (cuid)
- `documentRequestId` - FK to DocumentRequest (cascade delete)
- `approverName` - Approver full name
- `approverEmail` - Approver email address
- `role` - Enum: "Reviewer", "Approver", "Signatory"
- `sequence` - Order in approval chain (1, 2, 3, ...)
- `status` - Enum: "Pending", "Approved", "Rejected"
- `comments` - Optional feedback
- `actionDate` - Timestamp of approval/rejection
- `createdAt`

**Unique constraint:** (documentRequestId, sequence) - ensures no duplicate sequences

## 🚀 Setup Instructions

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** or **pnpm**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hakeng-approval-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (copy `.env.example` → `.env`)
   ```bash
   # Point at any PostgreSQL instance (a free Neon database or local Docker):
   DATABASE_URL="postgresql://user:password@host:5432/hakeng?schema=public"
   # Optional locally (only needed to test PDF upload): a Vercel Blob token.
   # BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
   ```

4. **Initialize database**
   ```bash
   # Generate Prisma client
   npx prisma generate

   # Create the tables from the schema
   npx prisma db push

   # Seed 3 users + 4 demo requests (one per status)
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

### Test Users

The seed script creates 3 test users:

| Name | Email | Department |
|------|-------|------------|
| Abdullah Al-Qahtani | abdullah.alqahtani@hakeng.sa | Engineering |
| Mohammed Al-Otaibi | mohammed.alotaibi@hakeng.sa | Finance |
| Khalid Al-Harbi | khalid.alharbi@hakeng.sa | Management |

## 🎨 Custom Theme

The application uses a **custom green theme** based on oklch color space:

- **Primary green**: `oklch(0.5234 0.1347 144.1672)` (#3f8f5d)
- **Monospace fonts**: Montserrat (sans), Merriweather (serif), Source Code Pro (mono)
- **Dark mode support**: Automatic system preference detection

Theme is defined in `app/globals.css` and applied via Tailwind CSS.

## 🔑 Key Features & Implementation

### 1. Sequential Approval Logic (CRITICAL)

**Requirement:** Approvers must approve in sequence (1 → 2 → 3). Out-of-sequence approvals are blocked.

**Implementation:**

**Backend** — the guard is a pure, unit-tested function in `lib/workflows.ts` (`canActOnApproval`), applied by `app/api/requests/[id]/approve/route.ts`:
```typescript
// lib/workflows.ts — only the lowest-sequence Pending approver may act
const priorPending = approvers.find(
  (a) => a.sequence < approver.sequence && a.status === 'Pending'
)

if (priorPending) {
  return {
    allowed: false,
    code: 403, // forbidden — not this approver's turn
    error: `It is not your turn to approve. ${priorPending.approverName} (sequence ${priorPending.sequence}) must act first.`,
  }
}

// app/api/requests/[id]/approve/route.ts — the route applies the guard
const guard = canActOnApproval(documentRequest.approvers, approverEmail, documentRequest.status)
if (!guard.allowed) {
  return NextResponse.json({ success: false, error: guard.error }, { status: guard.code ?? 400 })
}
```

**Frontend** (`app/requests/[id]/page.tsx`):
- Displays "Next Approver" indicator
- Shows sequential timeline with status badges
- Approvers can only act when their turn arrives

### 2. Request Submission Validations

Before a request can be submitted (`POST /api/requests/[id]/submit`):
- ✅ Status must be "Draft"
- ✅ PDF must be uploaded
- ✅ At least one approver assigned
- ✅ Approver roles must be valid (Reviewer, Approver, Signatory)
- ✅ Sequence must be sequential (1, 2, 3, ...) with no gaps

### 3. PDF Upload

**Endpoint:** `POST /api/upload`

**Features:**
- File type validation (PDF only)
- Size limit: 10MB
- Unique object key (random suffix to avoid collisions)
- Storage: **Vercel Blob** (serverless-friendly object store) — returns a public URL saved on the request
- The seeded demo requests reference a committed static sample at `/uploads/sample-contract.pdf`, so attachment links resolve without any upload

### 4. Dynamic Approver Management

**While in Draft:**
- Add approvers: `POST /api/requests/[id]/approvers`
- Remove approvers: `DELETE /api/requests/[id]/approvers?approverId=xxx`
- Automatic resequencing after removal

**After Submission:** Approver list is locked

### 5. Status Transitions

```
Draft ──→ [Submit] ──→ Pending Approval
                              ↓
                       [All Approve]
                              ↓
                          Approved

Pending Approval ──→ [Any Reject] ──→ Rejected
```

### 6. Filtering & Reporting

**List view filters:**
- Status (Draft, Pending Approval, Approved, Rejected)
- Request Type (4 types)
- Priority (Low, Medium, High)
- Department (text search)

**7 columns (per PDF Feature 10), plus an Actions link:**
1. Title (request type shown beneath)
2. Requested By
3. Department
4. Status (color-coded badge)
5. Current Pending Approver (lowest-sequence approver still "Pending"; shows "N/A" once the request is terminal)
6. Due Date (overdue dates highlighted in red)
7. Aging in Days (whole calendar days since creation)

## 📡 API Endpoints

### Document Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/requests` | List all requests (with filters) |
| POST | `/api/requests` | Create new request (Draft) |
| GET | `/api/requests/[id]` | Get single request |
| PATCH | `/api/requests/[id]` | Update request (Draft only) |
| DELETE | `/api/requests/[id]` | Delete request (Draft/Rejected only) |
| POST | `/api/requests/[id]/submit` | Submit request for approval |
| POST | `/api/requests/[id]/approve` | Approve or reject request |

### Approvers

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests/[id]/approvers` | Add approver to request (Draft only) |
| DELETE | `/api/requests/[id]/approvers?approverId=xxx` | Remove approver (Draft only) |

### File Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload PDF file |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |

## 🧪 Testing

### Automated Tests (Vitest)

The core approval state machine in `lib/workflows.ts` is covered by a unit suite
(**39 tests**) spanning every milestone's exit criteria — sequential enforcement,
rejection cascade, status resolution, submit validations, and the list-view aging
/ current-approver derivations.

```bash
npm test          # run once
npm run test:watch  # watch mode
```

### Build Verification

```bash
npm run build
```

### Manual Testing Checklist

1. ✅ Create a draft request with all 11 fields
2. ✅ Upload a PDF document
3. ✅ Add 3 approvers with different roles
4. ✅ Submit request (triggers validation)
5. ✅ Attempt out-of-sequence approval (should fail)
6. ✅ Approve in sequence (1 → 2 → 3)
7. ✅ Verify status changes to "Approved"
8. ✅ Create another request and reject it
9. ✅ Test filters on list view
10. ✅ Test all CRUD operations

## 📚 Case Study Documents

- [PART1_REQUIREMENTS_THINKING.md](./PART1_REQUIREMENTS_THINKING.md) — **Part 1**: clarification questions + assumptions.
- [PART3_ERP_ANSWERS.md](./PART3_ERP_ANSWERS.md) — **Part 3**: Frappe/ERPNext conceptual answers.
- [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) — the **why** behind each architectural choice.
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) — requirement interpretations, tradeoffs, and constraints.

## 📝 Design Decisions & Assumptions

- [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) — the **why** behind each architectural choice.
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) — requirement interpretations, tradeoffs, and constraints.

## 🔗 ERP / Frappe Thinking (Part 3)

See [PART3_ERP_ANSWERS.md](./PART3_ERP_ANSWERS.md) — answers to all six conceptual questions in Frappe/ERPNext terms (module mapping, admin configuration, permissions matrix, server-side validations, audit trail, and DocType/workflow/hook code samples).

## ⏱️ Development Timeline

**Time spent:** ~4.5 hours

- **M1 - Setup & Schema** (45 min): Next.js setup, Prisma schema, migrations, seed
- **M2 - API Layer** (60 min): 8 RESTful endpoints with validations
- **M3 - Sequential Logic** (45 min): Core approval enforcement logic
- **M4 - Frontend Core** (60 min): List view, create form, approver management
- **M5 - Frontend Approvals** (45 min): Detail view, approve/reject UI
- **M6 - Documentation** (45 min): ERP answers, README, assumptions

## 🚧 Known Limitations (Prototype Scope)

1. **No Authentication**: Simplified user model (email-based identification)
2. **No Email Notifications**: Would use Resend or SendGrid in production
3. **Single Tenant**: Multi-company support designed but not implemented
4. **No Real-time Updates**: Would use WebSockets or polling in production

## 🎯 Production Readiness Checklist

To make this production-ready:

- [ ] Implement authentication (NextAuth.js or Clerk)
- [ ] Add email notifications (Resend/SendGrid)
- [ ] Migrate to PostgreSQL/MySQL
- [ ] Use S3/R2 for file storage
- [ ] Add comprehensive test suite (Jest + Playwright)
- [ ] Implement audit logging
- [ ] Add rate limiting
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Add search functionality (Algolia/Meilisearch)
- [ ] Implement real-time updates (Pusher/Socket.io)
- [ ] Add multi-company support
- [ ] Deploy to Vercel/AWS

## 📄 License

Proprietary - HAK Engineering Case Study

## 👤 Author

**Candidate Submission** for HAK Engineering Full Stack Developer Position

---

**Thank you for reviewing this submission!** 🙏

For questions or clarifications, please refer to:
- [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) - Architectural rationale
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) - Requirement interpretations & tradeoffs
- [PART3_ERP_ANSWERS.md](./PART3_ERP_ANSWERS.md) - Frappe/ERPNext conceptual answers

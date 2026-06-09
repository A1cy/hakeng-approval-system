# Part 3 — ERP / Frappe Thinking

Answers to the six conceptual questions, written in Frappe/ERPNext terminology.

---

## Q1. How would you map this into an ERP system?

### Module structure

A dedicated **Document Approval** module (a Frappe *app*, e.g. `hakeng_approvals`),
sitting alongside HR, Projects, and Buying.

```
hakeng_approvals/                  # custom Frappe app
└── hakeng_approvals/
    └── doctype/
        ├── document_request/      # transactional master
        ├── approval_step/         # child table of Document Request
        └── approval_template/     # reusable approver sequences (config)
```

### Master vs. transactional data

| Kind | Entity | Notes |
|------|--------|-------|
| **Master data** | `User`, `Department`, `Company` | Reused from Frappe core / HR — not re-created. |
| **Master data** | `Approval Template` | Admin-defined reusable approver sequences. |
| **Transactional** | `Document Request` | The submittable record; one per request. |
| **Transactional (child)** | `Approval Step` | Rows inside a Document Request — the approvers. |

### How our entities map to Frappe concepts

- **Document Request → a submittable DocType** (`is_submittable: 1`). Frappe's
  built-in `docstatus` (0 = Draft, 1 = Submitted, 2 = Cancelled) combines with a
  **Workflow** to express Draft → Pending Approval → Approved / Rejected.
- **Approver → an `Approval Step` child table** embedded in Document Request
  (Frappe child tables are the idiomatic "1—N owned rows" pattern, exactly our
  Request 1—N Approvers relationship).
- **`sequence`, `status`, `comments`, `action_date`** become child-table fields;
  the `idx` column Frappe maintains on child rows naturally encodes order.

### Integration with other modules

- **HR**: `Department` and `Employee`/`User` come from HR; approvers are picked
  from the employee directory.
- **Buying/Selling**: a Purchase Order over a threshold can auto-create a
  Document Request via a `on_submit` hook, linking back through a
  `Dynamic Link` (`reference_doctype` + `reference_name`).
- **Projects**: milestone sign-offs create requests the same way.
- **Frappe Workflow engine**: drives the state transitions + who can trigger them.
- **Frappe File / Attachments**: the PDF uses the native `Attach` field, stored
  in the File DocType (local or S3 via `frappe.conf`).

---

## Q2. Which parts should be configurable by admin users?

### Should be configurable (via DocType "Settings" + master data)

1. **Request Types** — a `Document Request Type` DocType (or a Select managed by
   admins) so new types are added without code.
2. **Departments** — synced from HR; admins manage there.
3. **Approval Templates** — pre-defined approver sequences (e.g. "Contract
   Review = Legal → Finance → MD"). Admins build them; users apply one to
   auto-populate `Approval Step` rows.
4. **Email / Notification templates** — Frappe **Notification** DocType: subject,
   body, recipients, trigger event.
5. **Due-date / SLA rules** — default lead time per request type, escalation
   windows.
6. **Escalation rules** — "if pending > N days, notify the next-level manager."
7. **Priority auto-assignment** — e.g. amount-based priority for linked POs.
8. **Field-level requiredness** — which optional fields are mandatory per type.

These live in a single **`Document Approval Settings`** (a Single DocType) plus
the `Approval Template` master.

### Should NOT be configurable (core business invariants — code, not config)

- **Sequential enforcement** — "only the lowest-sequence Pending approver may
  act." This is the integrity of the whole system.
- **Status transition graph** — Draft → Pending → Approved/Rejected, one-way.
- **One rejection = whole request rejected.**
- **Submit pre-conditions** — PDF present + ≥1 approver.

Letting admins toggle these would let them create states the rest of the system
can't reason about. They are enforced in server-side controller code
(mirroring our `lib/workflows.ts`).

---

## Q3. What permissions would you apply?

### Roles

| Role | Who |
|------|-----|
| **Employee** | Any staff member who raises requests. |
| **Approver** | Anyone named on an `Approval Step`. |
| **Document Manager** | Department/admin overseer. |
| **Auditor** | Read-only compliance access. |
| **System Manager** | Configures the module (Q2 items). |

### Permission matrix (Role × Action)

| Action | Employee | Approver | Doc Manager | Auditor | System Mgr |
|--------|:--------:|:--------:|:-----------:|:-------:|:----------:|
| Create Request | ✅ | ✅ | ✅ | ❌ | ✅ |
| View **own** request | ✅ | ✅ | ✅ | ✅ | ✅ |
| View **department** requests | ❌ | — | ✅ | ✅ | ✅ |
| View **all** requests | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit Draft | ✅ (own) | ❌ | ✅ | ❌ | ✅ |
| Delete Draft | ✅ (own) | ❌ | ✅ | ❌ | ✅ |
| Submit | ✅ (own) | ❌ | ✅ | ❌ | ✅ |
| Approve / Reject | ❌ | ✅ (if current step) | ❌ | ❌ | ❌ |
| Override approval | ❌ | ❌ | ✅ (logged) | ❌ | ✅ |
| Configure system | ❌ | ❌ | ❌ | ❌ | ✅ |

### Row-level security (who sees which requests)

Implemented with Frappe **User Permissions** + a `permission_query_conditions`
hook:

```python
# hooks.py
permission_query_conditions = {
    "Document Request": "hakeng_approvals.permissions.doc_request_query"
}

# permissions.py
def doc_request_query(user):
    roles = frappe.get_roles(user)
    if "Auditor" in roles or "System Manager" in roles:
        return ""  # see everything
    # Owner, or an approver on the request, or same-department manager
    return f"""(`tabDocument Request`.owner = {frappe.db.escape(user)}
        or exists (select 1 from `tabApproval Step` s
                   where s.parent = `tabDocument Request`.name
                   and s.approver_email = {frappe.db.escape(user)}))"""
```

### Field-level permissions

- After submit, all request fields become read-only (Frappe enforces this once
  `docstatus = 1`, except fields explicitly `allow_on_submit`).
- `Approval Step.status`, `comments`, `action_date` are writable **only** through
  the approve/reject server methods, never via the form, using `permlevel` and a
  `before_update_after_submit` guard.

---

## Q4. What validations should happen server-side (and why)?

**Why server-side:** the client can be bypassed (curl, Postman, a tampered
browser). Every integrity rule must be re-checked on the server — the UI checks
are only for fast feedback. In our prototype these all live in `lib/workflows.ts`;
in Frappe they live in the DocType controller (`validate`, `before_submit`,
`on_update_after_submit`).

### On Create / Update (Draft)
1. **Title** required, non-empty.
2. **Request Type** ∈ allowed set.
3. **Priority** ∈ {Low, Medium, High}.
4. **Due Date** is today or future.
5. **External contact**, if it looks like an email, is a valid email.
6. **Approver emails** are valid email format.
7. **No duplicate approver emails** on one request.

### On Submit
8. **PDF attachment exists** (non-empty `pdf_attachment`).
9. **At least one approver** exists.
10. **Approver sequence is contiguous** starting at 1 (no gaps/dupes) — enforced
    also by the `unique(document_request, sequence)` DB constraint.
11. Request is currently **Draft** (can't re-submit).

### On Approve / Reject
12. Request is in **Pending Approval**.
13. Actor **is** an approver on the request.
14. Actor's step is still **Pending** (can't act twice).
15. **No earlier-sequence approver is still Pending** (the sequential rule).

In Frappe these raise via `frappe.throw(_("It is not your turn to approve"))`,
which rolls back the transaction.

---

## Q5. What audit trail would you keep?

### Document Request events (≥5)
1. Request **Created**
2. Request **Edited** (field-level diff)
3. **PDF Uploaded / Replaced**
4. Request **Submitted**
5. Request **Approved** (final)
6. Request **Rejected** (final)
7. *(optional)* Request **Viewed** (for sensitive contracts)

### Approver / step events (≥3)
1. Approver **Added / Removed** (Draft only)
2. Approver **Approved** (with comment + timestamp)
3. Approver **Rejected** (with comment + timestamp)
4. Approval **Overridden** by a manager

### What Frappe gives for free
- **`track_changes: 1`** on the DocType writes a **Version** record for every
  field change — an automatic field-level diff log.
- **Submittable docs** record submit/cancel with user + timestamp.
- Each `Approval Step` already stores `action_date` and `comments`.

### A dedicated immutable audit table

For compliance we add an **insert-only** `Approval Audit Log` DocType:

```
Approval Audit Log
  reference_request   Link → Document Request
  event_type          Select (Created, Submitted, Approved, Rejected, ...)
  actor               Link → User
  sequence            Int           # which step, if applicable
  details             Long Text     # JSON snapshot / comment
  timestamp           Datetime      # set server-side, never editable
```

**Immutable principle:** the DocType has **no write/delete permission for any
role** — only an `insert`. Rows are appended by server hooks
(`on_submit`, the approve/reject methods). This guarantees the trail can't be
edited after the fact. **Retention:** keep online for 7 years (engineering
contract norm), then archive to cold storage; never hard-delete.

---

## Q6. Frappe / ERPNext implementation concepts

### DocTypes
- **Document Request** — submittable master.
- **Approval Step** — child table (`istable: 1`) of Document Request.
- **Approval Template** — config master.
- **Approval Audit Log** — immutable trail.

### Child tables
`Approval Step` is referenced as a `Table` field on Document Request. Frappe
stores child rows in `tabApproval Step` with `parent`, `parenttype`,
`parentfield`, and an `idx` ordering column — a perfect fit for our ordered
approver list.

### Workflow states & transitions

A Frappe **Workflow** on Document Request:

| State | docstatus | Allowed action → next state | Allowed role |
|-------|:---------:|------------------------------|--------------|
| Draft | 0 | Submit → Pending Approval | Employee (owner) |
| Pending Approval | 1 | Approve → Pending/Approved | Approver (current) |
| Pending Approval | 1 | Reject → Rejected | Approver (current) |
| Approved | 1 | — (terminal) | — |
| Rejected | 1 | — (terminal) | — |

The per-step advance (which approver is "current") is handled in server code,
because Frappe's stock Workflow is document-level, not row-sequential.

### Sample server script (Python controller)

```python
# document_request.py
import frappe
from frappe.model.document import Document

class DocumentRequest(Document):
    def before_submit(self):
        if not self.pdf_attachment:
            frappe.throw(_("PDF attachment is required"))
        if not self.approval_steps:
            frappe.throw(_("At least one approver is required"))

    def on_submit(self):
        self.status = "Pending Approval"
        log_audit(self.name, "Submitted", frappe.session.user)


@frappe.whitelist()
def act_on_request(request_name, action, comments=None):
    """action: 'Approved' | 'Rejected'."""
    doc = frappe.get_doc("Document Request", request_name)
    user = frappe.session.user

    if doc.status != "Pending Approval":
        frappe.throw(_("Request is not awaiting approval"))

    step = next((s for s in doc.approval_steps if s.approver_email == user), None)
    if not step:
        frappe.throw(_("You are not an approver for this request"))
    if step.status != "Pending":
        frappe.throw(_("You have already acted on this request"))

    # Sequential guard
    prior = [s for s in doc.approval_steps
             if s.sequence < step.sequence and s.status == "Pending"]
    if prior:
        frappe.throw(_("It is not your turn. {0} must act first.")
                     .format(prior[0].approver_name))

    step.status = action
    step.comments = comments
    step.action_date = frappe.utils.now()

    if action == "Rejected":
        doc.status = "Rejected"
    elif all(s.status == "Approved" for s in doc.approval_steps):
        doc.status = "Approved"

    doc.save()
    log_audit(doc.name, action, user, step.sequence, comments)
    return doc.status
```

### Sample client script (JavaScript)

```javascript
// document_request.js
frappe.ui.form.on('Document Request', {
    refresh(frm) {
        if (frm.doc.status === 'Pending Approval') {
            frm.add_custom_button(__('Approve'), () => act(frm, 'Approved'));
            frm.add_custom_button(__('Reject'),  () => act(frm, 'Rejected'));
        }
    },
    validate(frm) {
        if (frm.doc.due_date && frm.doc.due_date < frappe.datetime.get_today()) {
            frappe.throw(__('Due date must be today or in the future'));
        }
    }
});

function act(frm, action) {
    frappe.prompt({ fieldname: 'comments', fieldtype: 'Small Text', label: 'Comments' },
        ({ comments }) => frappe.call({
            method: 'hakeng_approvals.document_request.act_on_request',
            args: { request_name: frm.doc.name, action, comments },
            callback: () => frm.reload_doc()
        }), __(action));
}
```

### Hooks (`hooks.py`)

```python
doc_events = {
    "Purchase Order": {
        "on_submit": "hakeng_approvals.integrations.maybe_create_request"
    }
}
permission_query_conditions = {
    "Document Request": "hakeng_approvals.permissions.doc_request_query"
}
scheduler_events = {
    "daily": ["hakeng_approvals.tasks.send_pending_approval_reminders"]
}
```

### API endpoints
Server methods decorated with **`@frappe.whitelist()`** (above) are exposed at
`/api/method/hakeng_approvals.document_request.act_on_request`. Standard CRUD is
already available via Frappe's REST layer at `/api/resource/Document Request`.

### Sample Query Report — "Pending Approvals"

```python
# pending_approvals.py  (uses frappe.db.sql)
def execute(filters=None):
    columns = [
        {"label": "Request", "fieldname": "name", "fieldtype": "Link",
         "options": "Document Request", "width": 160},
        {"label": "Title", "fieldname": "title", "fieldtype": "Data", "width": 220},
        {"label": "Current Approver", "fieldname": "current_approver",
         "fieldtype": "Data", "width": 180},
        {"label": "Aging (days)", "fieldname": "aging", "fieldtype": "Int", "width": 110},
    ]
    data = frappe.db.sql("""
        SELECT dr.name, dr.title,
            (SELECT s.approver_name FROM `tabApproval Step` s
             WHERE s.parent = dr.name AND s.status = 'Pending'
             ORDER BY s.sequence ASC LIMIT 1) AS current_approver,
            DATEDIFF(CURDATE(), dr.creation) AS aging
        FROM `tabDocument Request` dr
        WHERE dr.status = 'Pending Approval'
        ORDER BY dr.due_date ASC
    """, as_dict=True)
    return columns, data
```

### Key Frappe primitives used
- `frappe.db.sql()` — the report query above.
- `frappe.throw()` — validation failures that roll back the transaction.
- **Workflow actions** — Submit / Approve / Reject state transitions.
- **Permission levels** (`permlevel`) + `permission_query_conditions` —
  field- and row-level security.
- **Server events** — `before_submit`, `on_submit`, `on_update_after_submit`.
- **Client events** — `refresh`, `validate`, `before_submit`.
- **Scheduler events** — `daily` reminder emails for stale pending requests.

---

## Mapping back to the prototype

The prototype's `lib/workflows.ts` is a direct analogue of the Frappe controller
above — `canActOnApproval` ≙ the sequential guard in `act_on_request`,
`computeRequestStatus` ≙ the status resolution, `validateSubmission` ≙
`before_submit`. Porting to Frappe is mostly a translation of these pure
functions into the DocType controller, with Frappe supplying auth, permissions,
the audit Version log, and the report builder out of the box.

# Part 1 — Requirements Thinking

Before building, here are the clarification questions I would ask the business
user, followed by the assumptions I made to proceed within the time box.

---

## Clarification Questions

**Authentication & access**
1. Will this integrate with HAK Engineering's existing identity provider (Active
   Directory / Microsoft Entra ID), or should it manage its own logins? Should
   employees self-register or be pre-provisioned by an admin?

**Approval workflow**
2. After a request is submitted, can the approver list still be changed? What
   happens when an assigned approver is on leave — is delegation or a backup
   approver expected?
3. Is approval always strictly sequential, or are there cases that need parallel
   approval (several approvers at the same step)?

**Notifications**
4. How should approvers be notified it's their turn — email, in-app, WhatsApp?
   Should there be escalation/reminders if an approver doesn't act by the due date?

**External party**
5. Do external parties (clients) need login access to view or download the
   document, or are their name/contact stored purely for reference? The field is
   labelled "Email / WhatsApp" — should both be accepted, and is either format valid?

**PDF handling**
6. What's the maximum PDF size? Only one PDF per request, or several? Should the
   PDF be versioned if the draft is edited, and does it need virus scanning?

**Request lifecycle**
7. Can a rejected request be edited and resubmitted, or must a new request be
   created? Can an approved request be revoked/cancelled? What is the retention /
   archival policy?

**Configuration**
8. Is the list of Departments (and Request Types) fixed, or admin-configurable?
   Who sets Priority — the requester, or rules in the system?

**Reporting**
9. Beyond the basic list, what reports matter — aging analysis, approval
   turnaround time, bottlenecks by department? Is a dashboard expected?

**Audit & compliance**
10. What audit depth is required (who viewed/downloaded, IP addresses)? Are there
    compliance obligations (ISO 9001, ZATCA for contracts) or a need for a true
    digital signature at the Signatory step?

---

## Assumptions

Because this is a time-boxed prototype, I proceeded on the following assumptions.
(The reasoning behind the technical choices is in [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md).)

**Authentication**
- No real auth in the prototype; the acting approver is identified by email
  (mirrors a real "click the link in your approval email" flow). Roles
  (Requester / Approver / Admin) are assumed but not enforced via login.

**Workflow behaviour**
- Approvers act **strictly in sequence** (1 → 2 → 3).
- Once submitted, the approver list is immutable.
- **Any** single rejection rejects the whole request.
- A rejected request is terminal (a new request would be raised); drafts can be
  edited/deleted by the creator.

**File handling**
- One PDF per request, max 10 MB, uploaded to object storage (Vercel Blob) with
  the returned URL saved on the record. No versioning or virus scanning in the prototype.

**Notifications**
- Out of scope for the prototype (would be email in production). The "Current
  Pending Approver" column makes the next actor visible in the meantime.

**Request types & priority**
- Request Type and Priority are **informational** — they do not alter the
  approval sequence.
- Due Date is advisory (no automatic escalation), but must be today or later at
  creation time.

**External party**
- External party fields are informational only; no external login in the
  prototype. The single contact field accepts an email **or** a WhatsApp number.

**Departments**
- Treated as free text / a small known set; not admin-configurable in the prototype.

**Reporting**
- A single filterable list view. **Aging = today − created date** (calendar days,
  not business days). **Current Pending Approver** = the lowest-sequence approver
  whose status is still "Pending".

**Stack**
- Next.js (App Router) full-stack + Prisma over PostgreSQL (Neon), with PDFs in
  Vercel Blob — deployed on Vercel. See [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)
  for the reasoning behind each choice.

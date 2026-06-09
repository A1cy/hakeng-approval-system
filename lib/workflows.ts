/**
 * Sequential Approval Workflow — Pure State Machine
 *
 * This module holds the CORE business logic of the system, kept free of any
 * database or framework dependency so it can be unit-tested in isolation.
 *
 * Business rules (from the PDF spec):
 *  - Approvers act in strict sequence (1 → 2 → 3 ...). Only the lowest-sequence
 *    approver still "Pending" may act.
 *  - One rejection rejects the whole request; no later approver may then act.
 *  - When the last approver approves, the request becomes "Approved".
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApproverStatus = 'Pending' | 'Approved' | 'Rejected'
export type RequestStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected'
export type ApproverRole = 'Reviewer' | 'Approver' | 'Signatory'
export type ApprovalAction = 'Approved' | 'Rejected'

export interface ApproverLike {
  approverName: string
  approverEmail: string
  role: string
  sequence: number
  status: string
}

export interface SubmissionInput {
  status: string
  pdfPath: string | null | undefined
  approvers: ApproverLike[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface ActionGuardResult {
  allowed: boolean
  /** Present only when allowed === false */
  error?: string
  /** HTTP-style code to help the route layer respond consistently */
  code?: number
}

// ---------------------------------------------------------------------------
// Constants (single source of truth for the enums)
// ---------------------------------------------------------------------------

export const REQUEST_TYPES = [
  'Internal Approval',
  'Client Submission',
  'Contract Review',
  'Signature Request',
] as const

export const PRIORITIES = ['Low', 'Medium', 'High'] as const

export const APPROVER_ROLES: ApproverRole[] = ['Reviewer', 'Approver', 'Signatory']

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

/**
 * The single approver eligible to act right now: lowest sequence that is still
 * Pending. Returns null when none are pending (request finished or no approvers).
 */
export function getCurrentPendingApprover<T extends ApproverLike>(
  approvers: T[]
): T | null {
  const pending = approvers
    .filter((a) => a.status === 'Pending')
    .sort((a, b) => a.sequence - b.sequence)
  return pending[0] ?? null
}

/**
 * Aging in whole days since creation. `now` is injectable for deterministic tests.
 */
export function calculateAgingDays(createdAt: Date | string, now: Date): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  const ms = now.getTime() - created.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * Guard for whether `approverEmail` may approve/reject the request right now.
 * Enforces: request is in flight, approver exists, hasn't already acted, and is
 * the current pending approver (no earlier-sequence approver still Pending).
 */
export function canActOnApproval(
  approvers: ApproverLike[],
  approverEmail: string,
  requestStatus: string
): ActionGuardResult {
  if (requestStatus !== 'Pending Approval') {
    return {
      allowed: false,
      code: 400,
      error: `Cannot approve/reject request with status: ${requestStatus}`,
    }
  }

  const approver = approvers.find(
    (a) => a.approverEmail.toLowerCase() === approverEmail.trim().toLowerCase()
  )

  if (!approver) {
    return { allowed: false, code: 403, error: 'You are not an approver for this request' }
  }

  if (approver.status !== 'Pending') {
    return {
      allowed: false,
      code: 400,
      error: `This approver has already taken action: ${approver.status}`,
    }
  }

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

  return { allowed: true }
}

/**
 * Given the approver set AFTER the acting approver's status has been updated,
 * compute the resulting Document Request status.
 *  - Any rejection → Rejected
 *  - All approved → Approved
 *  - Otherwise → still Pending Approval
 */
export function computeRequestStatus(approversAfterAction: ApproverLike[]): RequestStatus {
  if (approversAfterAction.some((a) => a.status === 'Rejected')) {
    return 'Rejected'
  }
  if (
    approversAfterAction.length > 0 &&
    approversAfterAction.every((a) => a.status === 'Approved')
  ) {
    return 'Approved'
  }
  return 'Pending Approval'
}

/**
 * Validates a request is eligible to be submitted for approval.
 * Mirrors Required Feature 5 (PDF must exist, ≥1 approver) plus integrity checks.
 */
export function validateSubmission(input: SubmissionInput): ValidationResult {
  const errors: string[] = []

  if (input.status !== 'Draft') {
    errors.push(`Only Draft requests can be submitted (current: ${input.status})`)
  }

  if (!input.pdfPath || input.pdfPath.trim() === '') {
    errors.push('PDF attachment is required')
  }

  if (!input.approvers || input.approvers.length === 0) {
    errors.push('At least one approver is required')
  } else {
    // Roles valid
    const badRoles = input.approvers.filter((a) => !APPROVER_ROLES.includes(a.role as ApproverRole))
    if (badRoles.length > 0) {
      errors.push(`Invalid approver role(s). Must be one of: ${APPROVER_ROLES.join(', ')}`)
    }

    // Emails valid
    const badEmails = input.approvers.filter((a) => !isValidEmail(a.approverEmail))
    if (badEmails.length > 0) {
      errors.push(`Invalid approver email(s): ${badEmails.map((a) => a.approverEmail).join(', ')}`)
    }

    // No duplicate emails
    const seen = new Set<string>()
    const dupes = new Set<string>()
    for (const a of input.approvers) {
      const key = a.approverEmail.trim().toLowerCase()
      if (seen.has(key)) dupes.add(a.approverEmail)
      seen.add(key)
    }
    if (dupes.size > 0) {
      errors.push(`Duplicate approver email(s): ${Array.from(dupes).join(', ')}`)
    }

    // Sequence is contiguous 1..N
    const sequences = input.approvers.map((a) => a.sequence).sort((a, b) => a - b)
    for (let i = 0; i < sequences.length; i++) {
      if (sequences[i] !== i + 1) {
        errors.push(`Approver sequence must be contiguous starting at 1 (gap at position ${i + 1})`)
        break
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates the core Document Request fields on create. `now` is injectable so
 * the "due date must be in the future" rule is testable.
 */
export function validateRequestFields(
  fields: {
    title?: string
    requestType?: string
    priority?: string
    dueDate?: string | Date
    externalPartyContact?: string | null
  },
  now: Date
): ValidationResult {
  const errors: string[] = []

  if (!fields.title || fields.title.trim() === '') {
    errors.push('Title is required')
  }

  if (!fields.requestType || !REQUEST_TYPES.includes(fields.requestType as (typeof REQUEST_TYPES)[number])) {
    errors.push(`Invalid requestType. Must be one of: ${REQUEST_TYPES.join(', ')}`)
  }

  if (!fields.priority || !PRIORITIES.includes(fields.priority as (typeof PRIORITIES)[number])) {
    errors.push(`Invalid priority. Must be one of: ${PRIORITIES.join(', ')}`)
  }

  if (!fields.dueDate) {
    errors.push('Due date is required')
  } else {
    const due = typeof fields.dueDate === 'string' ? new Date(fields.dueDate) : fields.dueDate
    if (isNaN(due.getTime())) {
      errors.push('Due date is invalid')
    } else {
      // Compare on date boundary so "today" is allowed but past dates are not.
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (dueDay < today) {
        errors.push('Due date must be today or in the future')
      }
    }
  }

  // External contact, if provided, may be an email OR a phone/WhatsApp number.
  // Only validate when it looks like an email (contains "@").
  if (fields.externalPartyContact && fields.externalPartyContact.includes('@')) {
    if (!isValidEmail(fields.externalPartyContact)) {
      errors.push('External party contact email is invalid')
    }
  }

  return { valid: errors.length === 0, errors }
}

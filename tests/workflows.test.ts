import { describe, it, expect } from 'vitest'
import {
  canActOnApproval,
  computeRequestStatus,
  getCurrentPendingApprover,
  calculateAgingDays,
  validateSubmission,
  validateRequestFields,
  isValidEmail,
  type ApproverLike,
} from '@/lib/workflows'

// Helper: build an approver set for a request with N approvers.
function makeApprovers(statuses: string[]): ApproverLike[] {
  return statuses.map((status, i) => ({
    approverName: `Approver ${i + 1}`,
    approverEmail: `approver${i + 1}@hakeng.com`,
    role: 'Approver',
    sequence: i + 1,
    status,
  }))
}

// ===========================================================================
// M3 — Sequential Approval Logic (CRITICAL milestone)
// Maps to Required Features 6 & 7
// ===========================================================================
describe('M3: Sequential approval enforcement (Feature 6 & 7)', () => {
  it('A1 (sequence 1) CAN act when the request is freshly submitted', () => {
    const approvers = makeApprovers(['Pending', 'Pending', 'Pending'])
    const guard = canActOnApproval(approvers, 'approver1@hakeng.com', 'Pending Approval')
    expect(guard.allowed).toBe(true)
  })

  it('A2 CANNOT act before A1 (out-of-sequence blocked with 403)', () => {
    const approvers = makeApprovers(['Pending', 'Pending', 'Pending'])
    const guard = canActOnApproval(approvers, 'approver2@hakeng.com', 'Pending Approval')
    expect(guard.allowed).toBe(false)
    expect(guard.code).toBe(403)
    expect(guard.error).toMatch(/not your turn/i)
  })

  it('After A1 approves, A2 CAN act', () => {
    const approvers = makeApprovers(['Approved', 'Pending', 'Pending'])
    const guard = canActOnApproval(approvers, 'approver2@hakeng.com', 'Pending Approval')
    expect(guard.allowed).toBe(true)
  })

  it('A3 CANNOT act before A2 even after A1 approved', () => {
    const approvers = makeApprovers(['Approved', 'Pending', 'Pending'])
    const guard = canActOnApproval(approvers, 'approver3@hakeng.com', 'Pending Approval')
    expect(guard.allowed).toBe(false)
    expect(guard.code).toBe(403)
  })

  it('An approver who already approved cannot act again', () => {
    const approvers = makeApprovers(['Approved', 'Pending', 'Pending'])
    const guard = canActOnApproval(approvers, 'approver1@hakeng.com', 'Pending Approval')
    expect(guard.allowed).toBe(false)
    expect(guard.error).toMatch(/already taken action/i)
  })

  it('A non-approver gets a 403', () => {
    const approvers = makeApprovers(['Pending', 'Pending'])
    const guard = canActOnApproval(approvers, 'stranger@hakeng.com', 'Pending Approval')
    expect(guard.allowed).toBe(false)
    expect(guard.code).toBe(403)
    expect(guard.error).toMatch(/not an approver/i)
  })

  it('Cannot act on a request that is not "Pending Approval"', () => {
    const approvers = makeApprovers(['Pending'])
    expect(canActOnApproval(approvers, 'approver1@hakeng.com', 'Draft').allowed).toBe(false)
    expect(canActOnApproval(approvers, 'approver1@hakeng.com', 'Approved').allowed).toBe(false)
    expect(canActOnApproval(approvers, 'approver1@hakeng.com', 'Rejected').allowed).toBe(false)
  })

  it('Email matching is case-insensitive and trimmed', () => {
    const approvers = makeApprovers(['Pending'])
    const guard = canActOnApproval(approvers, '  Approver1@HAKENG.com ', 'Pending Approval')
    expect(guard.allowed).toBe(true)
  })
})

// ===========================================================================
// M5 — Status resolution (Features 8 & 9)
// ===========================================================================
describe('M5: Request status resolution (Feature 8 & 9)', () => {
  it('Single approver approves → Approved', () => {
    const after = makeApprovers(['Approved'])
    expect(computeRequestStatus(after)).toBe('Approved')
  })

  it('3 approvers, only A1 approved → still Pending Approval', () => {
    const after = makeApprovers(['Approved', 'Pending', 'Pending'])
    expect(computeRequestStatus(after)).toBe('Pending Approval')
  })

  it('3 approvers, A1+A2 approved → still Pending Approval', () => {
    const after = makeApprovers(['Approved', 'Approved', 'Pending'])
    expect(computeRequestStatus(after)).toBe('Pending Approval')
  })

  it('3 approvers, all approved → Approved', () => {
    const after = makeApprovers(['Approved', 'Approved', 'Approved'])
    expect(computeRequestStatus(after)).toBe('Approved')
  })

  it('Any rejection → Rejected (Feature 8: one reject = whole request rejected)', () => {
    expect(computeRequestStatus(makeApprovers(['Rejected', 'Pending', 'Pending']))).toBe('Rejected')
    expect(computeRequestStatus(makeApprovers(['Approved', 'Rejected', 'Pending']))).toBe('Rejected')
  })

  it('Rejection takes precedence over a full set of approvals', () => {
    expect(computeRequestStatus(makeApprovers(['Approved', 'Approved', 'Rejected']))).toBe('Rejected')
  })
})

// ===========================================================================
// M4 — List-view derived data (Feature 10e, 10g)
// ===========================================================================
describe('M4: List-view helpers (Feature 10)', () => {
  it('getCurrentPendingApprover returns lowest-sequence Pending approver', () => {
    const approvers = makeApprovers(['Approved', 'Pending', 'Pending'])
    const current = getCurrentPendingApprover(approvers)
    expect(current?.sequence).toBe(2)
    expect(current?.approverName).toBe('Approver 2')
  })

  it('getCurrentPendingApprover returns null when none pending', () => {
    expect(getCurrentPendingApprover(makeApprovers(['Approved', 'Approved']))).toBeNull()
    expect(getCurrentPendingApprover([])).toBeNull()
  })

  it('getCurrentPendingApprover ignores sequence ordering of input array', () => {
    const approvers: ApproverLike[] = [
      { approverName: 'C', approverEmail: 'c@x.com', role: 'Approver', sequence: 3, status: 'Pending' },
      { approverName: 'A', approverEmail: 'a@x.com', role: 'Approver', sequence: 1, status: 'Approved' },
      { approverName: 'B', approverEmail: 'b@x.com', role: 'Approver', sequence: 2, status: 'Pending' },
    ]
    expect(getCurrentPendingApprover(approvers)?.approverName).toBe('B')
  })

  it('calculateAgingDays computes whole days since creation', () => {
    const now = new Date('2026-06-10T12:00:00Z')
    expect(calculateAgingDays(new Date('2026-06-10T00:00:00Z'), now)).toBe(0)
    expect(calculateAgingDays(new Date('2026-06-09T00:00:00Z'), now)).toBe(1)
    expect(calculateAgingDays(new Date('2026-05-29T12:00:00Z'), now)).toBe(12)
  })

  it('calculateAgingDays never returns negative for future-dated creation', () => {
    const now = new Date('2026-06-10T12:00:00Z')
    expect(calculateAgingDays(new Date('2026-06-11T00:00:00Z'), now)).toBe(0)
  })

  it('calculateAgingDays accepts ISO string input', () => {
    const now = new Date('2026-06-10T12:00:00Z')
    expect(calculateAgingDays('2026-06-05T12:00:00Z', now)).toBe(5)
  })
})

// ===========================================================================
// M2 — Submit validations (Feature 5)
// ===========================================================================
describe('M2: Submission validation (Feature 5)', () => {
  const validApprovers = makeApprovers(['Pending', 'Pending'])

  it('Valid Draft with PDF + approvers passes', () => {
    const r = validateSubmission({ status: 'Draft', pdfPath: '/uploads/x.pdf', approvers: validApprovers })
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('Fails when no PDF attached (Feature 5a)', () => {
    const r = validateSubmission({ status: 'Draft', pdfPath: '', approvers: validApprovers })
    expect(r.valid).toBe(false)
    expect(r.errors).toContain('PDF attachment is required')
  })

  it('Fails when no approvers (Feature 5b)', () => {
    const r = validateSubmission({ status: 'Draft', pdfPath: '/uploads/x.pdf', approvers: [] })
    expect(r.valid).toBe(false)
    expect(r.errors).toContain('At least one approver is required')
  })

  it('Fails when BOTH no PDF and no approvers (collects both errors)', () => {
    const r = validateSubmission({ status: 'Draft', pdfPath: null, approvers: [] })
    expect(r.valid).toBe(false)
    expect(r.errors).toContain('PDF attachment is required')
    expect(r.errors).toContain('At least one approver is required')
  })

  it('Fails when request is not in Draft status', () => {
    const r = validateSubmission({ status: 'Pending Approval', pdfPath: '/uploads/x.pdf', approvers: validApprovers })
    expect(r.valid).toBe(false)
  })

  it('Fails on duplicate approver emails', () => {
    const dupes: ApproverLike[] = [
      { approverName: 'A', approverEmail: 'dup@x.com', role: 'Approver', sequence: 1, status: 'Pending' },
      { approverName: 'B', approverEmail: 'DUP@x.com', role: 'Approver', sequence: 2, status: 'Pending' },
    ]
    const r = validateSubmission({ status: 'Draft', pdfPath: '/uploads/x.pdf', approvers: dupes })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => /duplicate/i.test(e))).toBe(true)
  })

  it('Fails on non-contiguous sequence (gap)', () => {
    const gapped: ApproverLike[] = [
      { approverName: 'A', approverEmail: 'a@x.com', role: 'Approver', sequence: 1, status: 'Pending' },
      { approverName: 'B', approverEmail: 'b@x.com', role: 'Approver', sequence: 3, status: 'Pending' },
    ]
    const r = validateSubmission({ status: 'Draft', pdfPath: '/uploads/x.pdf', approvers: gapped })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => /contiguous/i.test(e))).toBe(true)
  })

  it('Fails on invalid approver role', () => {
    const badRole: ApproverLike[] = [
      { approverName: 'A', approverEmail: 'a@x.com', role: 'Boss', sequence: 1, status: 'Pending' },
    ]
    const r = validateSubmission({ status: 'Draft', pdfPath: '/uploads/x.pdf', approvers: badRole })
    expect(r.valid).toBe(false)
  })
})

// ===========================================================================
// M2 — Field validations on create
// ===========================================================================
describe('M2: Field validation on create', () => {
  const now = new Date('2026-06-09T12:00:00Z')

  it('Valid fields pass', () => {
    const r = validateRequestFields(
      { title: 'Contract X', requestType: 'Contract Review', priority: 'High', dueDate: '2026-06-20' },
      now
    )
    expect(r.valid).toBe(true)
  })

  it('Rejects past due date', () => {
    const r = validateRequestFields(
      { title: 'X', requestType: 'Contract Review', priority: 'High', dueDate: '2026-06-01' },
      now
    )
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => /future/i.test(e))).toBe(true)
  })

  it('Allows today as due date', () => {
    const r = validateRequestFields(
      { title: 'X', requestType: 'Contract Review', priority: 'High', dueDate: '2026-06-09' },
      now
    )
    expect(r.valid).toBe(true)
  })

  it('Rejects invalid request type', () => {
    const r = validateRequestFields(
      { title: 'X', requestType: 'Bogus', priority: 'High', dueDate: '2026-06-20' },
      now
    )
    expect(r.valid).toBe(false)
  })

  it('Rejects invalid priority', () => {
    const r = validateRequestFields(
      { title: 'X', requestType: 'Contract Review', priority: 'Urgent', dueDate: '2026-06-20' },
      now
    )
    expect(r.valid).toBe(false)
  })

  it('Rejects missing title', () => {
    const r = validateRequestFields(
      { title: '', requestType: 'Contract Review', priority: 'High', dueDate: '2026-06-20' },
      now
    )
    expect(r.valid).toBe(false)
  })

  it('Validates external contact email only when it looks like an email', () => {
    const bad = validateRequestFields(
      { title: 'X', requestType: 'Contract Review', priority: 'High', dueDate: '2026-06-20', externalPartyContact: 'not@anemail' },
      now
    )
    expect(bad.valid).toBe(false)

    // WhatsApp number (no @) should NOT be email-validated
    const phone = validateRequestFields(
      { title: 'X', requestType: 'Contract Review', priority: 'High', dueDate: '2026-06-20', externalPartyContact: '+966500000000' },
      now
    )
    expect(phone.valid).toBe(true)
  })
})

// ===========================================================================
// Email helper
// ===========================================================================
describe('isValidEmail', () => {
  it('accepts well-formed emails', () => {
    expect(isValidEmail('john.doe@hakeng.com')).toBe(true)
    expect(isValidEmail('a@b.co')).toBe(true)
  })
  it('rejects malformed emails', () => {
    expect(isValidEmail('plainaddress')).toBe(false)
    expect(isValidEmail('no@domain')).toBe(false)
    expect(isValidEmail('@nodomain.com')).toBe(false)
    expect(isValidEmail('spaces in@email.com')).toBe(false)
  })
})

// ===========================================================================
// Full lifecycle simulation — end-to-end sequential walk without a DB
// Maps to the plan's verification protocol (lines 120-126)
// ===========================================================================
describe('End-to-end lifecycle simulation', () => {
  it('Happy path: 3 approvers approve in sequence → Approved', () => {
    let approvers = makeApprovers(['Pending', 'Pending', 'Pending'])
    let status = 'Pending Approval'

    // A1 approves
    expect(canActOnApproval(approvers, 'approver1@hakeng.com', status).allowed).toBe(true)
    approvers = approvers.map((a) => (a.sequence === 1 ? { ...a, status: 'Approved' } : a))
    status = computeRequestStatus(approvers)
    expect(status).toBe('Pending Approval')

    // A2 approves
    expect(canActOnApproval(approvers, 'approver2@hakeng.com', status).allowed).toBe(true)
    approvers = approvers.map((a) => (a.sequence === 2 ? { ...a, status: 'Approved' } : a))
    status = computeRequestStatus(approvers)
    expect(status).toBe('Pending Approval')

    // A3 approves → final
    expect(canActOnApproval(approvers, 'approver3@hakeng.com', status).allowed).toBe(true)
    approvers = approvers.map((a) => (a.sequence === 3 ? { ...a, status: 'Approved' } : a))
    status = computeRequestStatus(approvers)
    expect(status).toBe('Approved')
  })

  it('Rejection path: A2 rejects after A1 approves → Rejected, A3 cannot act', () => {
    let approvers = makeApprovers(['Pending', 'Pending', 'Pending'])
    let status = 'Pending Approval'

    // A1 approves
    approvers = approvers.map((a) => (a.sequence === 1 ? { ...a, status: 'Approved' } : a))
    status = computeRequestStatus(approvers)

    // A2 rejects
    expect(canActOnApproval(approvers, 'approver2@hakeng.com', status).allowed).toBe(true)
    approvers = approvers.map((a) => (a.sequence === 2 ? { ...a, status: 'Rejected' } : a))
    status = computeRequestStatus(approvers)
    expect(status).toBe('Rejected')

    // A3 can no longer act (request not Pending Approval anymore)
    expect(canActOnApproval(approvers, 'approver3@hakeng.com', status).allowed).toBe(false)
  })
})

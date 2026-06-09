import { prisma } from '../lib/prisma'

/**
 * Seeds the demo dataset:
 *  - 3 users (requesters + approvers)
 *  - 4 Document Requests covering EVERY status (Draft, Pending Approval,
 *    Approved, Rejected) so the list/report view and the approval timeline are
 *    populated out-of-the-box for review and screenshots.
 *
 * Approver emails reuse the seeded users' emails so a reviewer can act as the
 * current pending approver immediately. The seed is idempotent: it clears
 * existing demo requests first, then recreates them.
 */
async function main() {
  // --- Reset for idempotency: clear requests (FK) then ALL users, so stale
  //     identities from previous seeds never linger -------------------------
  await prisma.documentRequest.deleteMany({})
  await prisma.user.deleteMany({})

  // --- Users (Saudi identities) ------------------------------------------
  const [abdullah, mohammed, khalid] = await Promise.all([
    prisma.user.create({
      data: { email: 'abdullah.alqahtani@hakeng.sa', name: 'Abdullah Al-Qahtani', department: 'Engineering' },
    }),
    prisma.user.create({
      data: { email: 'mohammed.alotaibi@hakeng.sa', name: 'Mohammed Al-Otaibi', department: 'Finance' },
    }),
    prisma.user.create({
      data: { email: 'khalid.alharbi@hakeng.sa', name: 'Khalid Al-Harbi', department: 'Management' },
    }),
  ])

  const SAMPLE_PDF = '/uploads/sample-contract.pdf'
  const day = (offset: number) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000)

  // (A) Pending Approval, mid-flow: A1 approved, A2 is the current approver.
  //     Drives the detail-page timeline + "Next Approver" banner + the
  //     list view's "Current Pending Approver" / "Aging" columns.
  await prisma.documentRequest.create({
    data: {
      title: 'Q3 Vendor Contract Review',
      requestType: 'Contract Review',
      requestedById: abdullah.id,
      department: 'Engineering',
      priority: 'High',
      dueDate: day(5),
      externalPartyName: 'Al-Rajhi Construction Co.',
      externalPartyContact: '+966500000000',
      pdfPath: SAMPLE_PDF,
      status: 'Pending Approval',
      remarks: 'Annual supply agreement — legal + finance sign-off required before signature.',
      approvers: {
        create: [
          { approverName: 'Mohammed Al-Otaibi', approverEmail: 'mohammed.alotaibi@hakeng.sa', role: 'Reviewer', sequence: 1, status: 'Approved', comments: 'Figures reconcile with the FY budget.', actionDate: day(-1) },
          { approverName: 'Khalid Al-Harbi', approverEmail: 'khalid.alharbi@hakeng.sa', role: 'Approver', sequence: 2, status: 'Pending' },
          { approverName: 'Abdullah Al-Qahtani', approverEmail: 'abdullah.alqahtani@hakeng.sa', role: 'Signatory', sequence: 3, status: 'Pending' },
        ],
      },
    },
  })

  // (B) Approved: both approvers approved in sequence.
  await prisma.documentRequest.create({
    data: {
      title: 'Office Lease — Jeddah HQ Signature',
      requestType: 'Signature Request',
      requestedById: khalid.id,
      department: 'Management',
      priority: 'Medium',
      dueDate: day(-2),
      externalPartyName: 'Jeddah Properties LLC',
      externalPartyContact: 'leasing@jeddahproperties.sa',
      pdfPath: SAMPLE_PDF,
      status: 'Approved',
      remarks: 'Three-year lease renewal.',
      approvers: {
        create: [
          { approverName: 'Mohammed Al-Otaibi', approverEmail: 'mohammed.alotaibi@hakeng.sa', role: 'Approver', sequence: 1, status: 'Approved', comments: 'Within approved budget.', actionDate: day(-4) },
          { approverName: 'Abdullah Al-Qahtani', approverEmail: 'abdullah.alqahtani@hakeng.sa', role: 'Signatory', sequence: 2, status: 'Approved', comments: 'Signed.', actionDate: day(-3) },
        ],
      },
    },
  })

  // (C) Rejected: A1 approved, A2 rejected → whole request rejected.
  await prisma.documentRequest.create({
    data: {
      title: 'Marketing Brochure — Client Submission',
      requestType: 'Client Submission',
      requestedById: mohammed.id,
      department: 'Finance',
      priority: 'Low',
      dueDate: day(3),
      externalPartyName: 'Gulf Media Group',
      externalPartyContact: '+966555555555',
      pdfPath: SAMPLE_PDF,
      status: 'Rejected',
      remarks: 'Pricing table needs correction before resubmission.',
      approvers: {
        create: [
          { approverName: 'Khalid Al-Harbi', approverEmail: 'khalid.alharbi@hakeng.sa', role: 'Reviewer', sequence: 1, status: 'Approved', comments: 'Copy looks good.', actionDate: day(-2) },
          { approverName: 'Abdullah Al-Qahtani', approverEmail: 'abdullah.alqahtani@hakeng.sa', role: 'Approver', sequence: 2, status: 'Rejected', comments: 'Pricing table is out of date — please correct and raise a new request.', actionDate: day(-1) },
        ],
      },
    },
  })

  // (D) Draft: not yet submitted; shows the Submit/Delete draft actions.
  await prisma.documentRequest.create({
    data: {
      title: 'Internal Remote-Work Policy Update',
      requestType: 'Internal Approval',
      requestedById: abdullah.id,
      department: 'Engineering',
      priority: 'Medium',
      dueDate: day(10),
      pdfPath: SAMPLE_PDF,
      status: 'Draft',
      remarks: 'Draft for HR review.',
      approvers: {
        create: [
          { approverName: 'Khalid Al-Harbi', approverEmail: 'khalid.alharbi@hakeng.sa', role: 'Approver', sequence: 1, status: 'Pending' },
        ],
      },
    },
  })

  const count = await prisma.documentRequest.count()
  console.log(`✅ Seeded 3 users and ${count} document requests (Draft, Pending Approval, Approved, Rejected).`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

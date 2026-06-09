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
  // --- Users (upserted; safe to re-run) ----------------------------------
  const [john, jane, bob] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'john.doe@hakeng.com' },
      update: {},
      create: { email: 'john.doe@hakeng.com', name: 'John Doe', department: 'Engineering' },
    }),
    prisma.user.upsert({
      where: { email: 'jane.smith@hakeng.com' },
      update: {},
      create: { email: 'jane.smith@hakeng.com', name: 'Jane Smith', department: 'Finance' },
    }),
    prisma.user.upsert({
      where: { email: 'bob.manager@hakeng.com' },
      update: {},
      create: { email: 'bob.manager@hakeng.com', name: 'Bob Manager', department: 'Management' },
    }),
  ])

  // --- Reset demo requests for idempotency (cascade deletes approvers) ----
  await prisma.documentRequest.deleteMany({})

  const SAMPLE_PDF = '/uploads/sample-contract.pdf'
  const day = (offset: number) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000)

  // (A) Pending Approval, mid-flow: A1 approved, A2 is the current approver.
  //     Drives the detail-page timeline + "Next Approver" banner + the
  //     list view's "Current Pending Approver" / "Aging" columns.
  await prisma.documentRequest.create({
    data: {
      title: 'Q3 Vendor Contract Review',
      requestType: 'Contract Review',
      requestedById: john.id,
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
          { approverName: 'Jane Smith', approverEmail: 'jane.smith@hakeng.com', role: 'Reviewer', sequence: 1, status: 'Approved', comments: 'Figures reconcile with the FY budget.', actionDate: day(-1) },
          { approverName: 'Bob Manager', approverEmail: 'bob.manager@hakeng.com', role: 'Approver', sequence: 2, status: 'Pending' },
          { approverName: 'John Doe', approverEmail: 'john.doe@hakeng.com', role: 'Signatory', sequence: 3, status: 'Pending' },
        ],
      },
    },
  })

  // (B) Approved: both approvers approved in sequence.
  await prisma.documentRequest.create({
    data: {
      title: 'Office Lease — Jeddah HQ Signature',
      requestType: 'Signature Request',
      requestedById: bob.id,
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
          { approverName: 'Jane Smith', approverEmail: 'jane.smith@hakeng.com', role: 'Approver', sequence: 1, status: 'Approved', comments: 'Within approved budget.', actionDate: day(-4) },
          { approverName: 'John Doe', approverEmail: 'john.doe@hakeng.com', role: 'Signatory', sequence: 2, status: 'Approved', comments: 'Signed.', actionDate: day(-3) },
        ],
      },
    },
  })

  // (C) Rejected: A1 approved, A2 rejected → whole request rejected.
  await prisma.documentRequest.create({
    data: {
      title: 'Marketing Brochure — Client Submission',
      requestType: 'Client Submission',
      requestedById: jane.id,
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
          { approverName: 'Bob Manager', approverEmail: 'bob.manager@hakeng.com', role: 'Reviewer', sequence: 1, status: 'Approved', comments: 'Copy looks good.', actionDate: day(-2) },
          { approverName: 'John Doe', approverEmail: 'john.doe@hakeng.com', role: 'Approver', sequence: 2, status: 'Rejected', comments: 'Pricing table is out of date — please correct and raise a new request.', actionDate: day(-1) },
        ],
      },
    },
  })

  // (D) Draft: not yet submitted; shows the Submit/Delete draft actions.
  await prisma.documentRequest.create({
    data: {
      title: 'Internal Remote-Work Policy Update',
      requestType: 'Internal Approval',
      requestedById: john.id,
      department: 'Engineering',
      priority: 'Medium',
      dueDate: day(10),
      pdfPath: SAMPLE_PDF,
      status: 'Draft',
      remarks: 'Draft for HR review.',
      approvers: {
        create: [
          { approverName: 'Bob Manager', approverEmail: 'bob.manager@hakeng.com', role: 'Approver', sequence: 1, status: 'Pending' },
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

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canActOnApproval, computeRequestStatus } from '@/lib/workflows'

// POST /api/requests/[id]/approve - Current pending approver approves the request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { approverEmail, comments } = body

    if (!approverEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: approverEmail' },
        { status: 400 }
      )
    }

    const documentRequest = await prisma.documentRequest.findUnique({
      where: { id },
      include: { approvers: { orderBy: { sequence: 'asc' } } },
    })

    if (!documentRequest) {
      return NextResponse.json(
        { success: false, error: 'Document request not found' },
        { status: 404 }
      )
    }

    // Sequential-approval guard (pure logic, fully unit-tested in lib/workflows)
    const guard = canActOnApproval(
      documentRequest.approvers,
      approverEmail,
      documentRequest.status
    )
    if (!guard.allowed) {
      return NextResponse.json(
        { success: false, error: guard.error },
        { status: guard.code ?? 400 }
      )
    }

    const approver = documentRequest.approvers.find(
      (a) => a.approverEmail.toLowerCase() === approverEmail.trim().toLowerCase()
    )!

    // Persist the approver's action
    await prisma.approver.update({
      where: { id: approver.id },
      data: { status: 'Approved', comments: comments || null, actionDate: new Date() },
    })

    // Recompute the document status from the post-action approver set
    const approversAfter = documentRequest.approvers.map((a) =>
      a.id === approver.id ? { ...a, status: 'Approved' } : a
    )
    const newStatus = computeRequestStatus(approversAfter)

    const updatedRequest = await prisma.documentRequest.update({
      where: { id },
      data: { status: newStatus, updatedAt: new Date() },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, department: true } },
        approvers: { orderBy: { sequence: 'asc' } },
      },
    })

    return NextResponse.json({
      success: true,
      message:
        newStatus === 'Approved'
          ? 'Request fully approved'
          : 'Approval recorded; awaiting next approver',
      data: updatedRequest,
    })
  } catch (error) {
    console.error('Error processing approval:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process approval' },
      { status: 500 }
    )
  }
}

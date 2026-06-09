import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canActOnApproval, computeRequestStatus } from '@/lib/workflows'

// POST /api/requests/[id]/reject - Current pending approver rejects the request.
// One rejection rejects the entire request (no later approver may act).
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

    // Same sequential guard as approve — only the current pending approver may reject
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

    await prisma.approver.update({
      where: { id: approver.id },
      data: { status: 'Rejected', comments: comments || null, actionDate: new Date() },
    })

    // One rejection → whole request Rejected
    const approversAfter = documentRequest.approvers.map((a) =>
      a.id === approver.id ? { ...a, status: 'Rejected' } : a
    )
    const newStatus = computeRequestStatus(approversAfter) // resolves to 'Rejected'

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
      message: 'Request rejected',
      data: updatedRequest,
    })
  } catch (error) {
    console.error('Error processing rejection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process rejection' },
      { status: 500 }
    )
  }
}

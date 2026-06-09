import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSubmission } from '@/lib/workflows'

// POST /api/requests/[id]/submit - Submit request for approval
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // All submission rules live in the pure, unit-tested workflow module
    const result = validateSubmission({
      status: documentRequest.status,
      pdfPath: documentRequest.pdfPath,
      approvers: documentRequest.approvers,
    })

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: result.errors.join('; '), errors: result.errors },
        { status: 400 }
      )
    }

    // Transition Draft → Pending Approval. The first approver (sequence 1) is
    // already status "Pending" by default, making it the current pending approver.
    const updatedRequest = await prisma.documentRequest.update({
      where: { id },
      data: { status: 'Pending Approval', updatedAt: new Date() },
      include: {
        requestedBy: { select: { id: true, name: true, email: true, department: true } },
        approvers: { orderBy: { sequence: 'asc' } },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Document request submitted for approval',
      data: updatedRequest,
    })
  } catch (error) {
    console.error('Error submitting request:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit document request' },
      { status: 500 }
    )
  }
}

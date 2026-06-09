import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/requests/[id]/approvers - Add approver to request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { approverName, approverEmail, role } = body

    // Validation
    if (!approverName || !approverEmail || !role) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: approverName, approverEmail, role',
        },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['Reviewer', 'Approver', 'Signatory']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Fetch the document request
    const documentRequest = await prisma.documentRequest.findUnique({
      where: { id },
      include: {
        approvers: true,
      },
    })

    if (!documentRequest) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document request not found',
        },
        { status: 404 }
      )
    }

    // Can only add approvers if status is Draft
    if (documentRequest.status !== 'Draft') {
      return NextResponse.json(
        {
          success: false,
          error: 'Can only add approvers to requests in Draft status',
        },
        { status: 400 }
      )
    }

    // Calculate next sequence number
    const maxSequence = documentRequest.approvers.reduce(
      (max, approver) => Math.max(max, approver.sequence),
      0
    )
    const nextSequence = maxSequence + 1

    // Create the approver
    const approver = await prisma.approver.create({
      data: {
        documentRequestId: id,
        approverName,
        approverEmail,
        role,
        sequence: nextSequence,
        status: 'Pending',
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Approver added successfully',
        data: approver,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error adding approver:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add approver',
      },
      { status: 500 }
    )
  }
}

// DELETE /api/requests/[id]/approvers?approverId=xxx - Remove approver from request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const approverId = searchParams.get('approverId')

    if (!approverId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: approverId',
        },
        { status: 400 }
      )
    }

    // Fetch the approver
    const approver = await prisma.approver.findUnique({
      where: { id: approverId },
      include: {
        documentRequest: true,
      },
    })

    if (!approver) {
      return NextResponse.json(
        {
          success: false,
          error: 'Approver not found',
        },
        { status: 404 }
      )
    }

    // Verify approver belongs to this request
    if (approver.documentRequestId !== id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Approver does not belong to this request',
        },
        { status: 400 }
      )
    }

    // Can only remove approvers if status is Draft
    if (approver.documentRequest.status !== 'Draft') {
      return NextResponse.json(
        {
          success: false,
          error: 'Can only remove approvers from requests in Draft status',
        },
        { status: 400 }
      )
    }

    // Delete the approver
    await prisma.approver.delete({
      where: { id: approverId },
    })

    // Resequence remaining approvers
    const remainingApprovers = await prisma.approver.findMany({
      where: { documentRequestId: id },
      orderBy: { sequence: 'asc' },
    })

    for (let i = 0; i < remainingApprovers.length; i++) {
      if (remainingApprovers[i].sequence !== i + 1) {
        await prisma.approver.update({
          where: { id: remainingApprovers[i].id },
          data: { sequence: i + 1 },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Approver removed successfully',
    })
  } catch (error) {
    console.error('Error removing approver:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove approver',
      },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/requests/[id] - Get single document request by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const documentRequest = await prisma.documentRequest.findUnique({
      where: { id },
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        approvers: {
          orderBy: {
            sequence: 'asc',
          },
        },
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

    return NextResponse.json({
      success: true,
      data: documentRequest,
    })
  } catch (error) {
    console.error('Error fetching request:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch document request',
      },
      { status: 500 }
    )
  }
}

// PATCH /api/requests/[id] - Update document request (only if Draft)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Fetch existing request
    const existingRequest = await prisma.documentRequest.findUnique({
      where: { id },
    })

    if (!existingRequest) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document request not found',
        },
        { status: 404 }
      )
    }

    // Can only update if status is Draft
    if (existingRequest.status !== 'Draft') {
      return NextResponse.json(
        {
          success: false,
          error: 'Can only update requests in Draft status',
        },
        { status: 400 }
      )
    }

    const {
      title,
      requestType,
      department,
      priority,
      dueDate,
      externalPartyName,
      externalPartyContact,
      pdfPath,
      remarks,
    } = body

    // Update the request
    const updatedRequest = await prisma.documentRequest.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(requestType && { requestType }),
        ...(department && { department }),
        ...(priority && { priority }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(externalPartyName !== undefined && { externalPartyName }),
        ...(externalPartyContact !== undefined && { externalPartyContact }),
        ...(pdfPath !== undefined && { pdfPath }),
        ...(remarks !== undefined && { remarks }),
        updatedAt: new Date(),
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        approvers: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedRequest,
    })
  } catch (error) {
    console.error('Error updating request:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update document request',
      },
      { status: 500 }
    )
  }
}

// DELETE /api/requests/[id] - Delete document request (only if Draft)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch existing request
    const existingRequest = await prisma.documentRequest.findUnique({
      where: { id },
    })

    if (!existingRequest) {
      return NextResponse.json(
        {
          success: false,
          error: 'Document request not found',
        },
        { status: 404 }
      )
    }

    // Can only delete if status is Draft or Rejected
    if (!['Draft', 'Rejected'].includes(existingRequest.status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Can only delete requests in Draft or Rejected status',
        },
        { status: 400 }
      )
    }

    // Delete the request (approvers will cascade delete)
    await prisma.documentRequest.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Document request deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting request:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete document request',
      },
      { status: 500 }
    )
  }
}

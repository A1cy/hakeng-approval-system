import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateRequestFields, isValidEmail } from '@/lib/workflows'

// Shape of an approver supplied inline on the create payload
interface ApproverInput {
  approverName: string
  approverEmail: string
  role: string
}

// GET /api/requests - List all document requests with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const requestType = searchParams.get('requestType')
    const priority = searchParams.get('priority')
    const department = searchParams.get('department')

    const where: {
      status?: string
      requestType?: string
      priority?: string
      department?: string
    } = {}
    if (status) where.status = status
    if (requestType) where.requestType = requestType
    if (priority) where.priority = priority
    if (department) where.department = department

    const requests = await prisma.documentRequest.findMany({
      where,
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: requests,
      count: requests.length,
    })
  } catch (error) {
    console.error('Error fetching requests:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch document requests',
      },
      { status: 500 }
    )
  }
}

// POST /api/requests - Create new document request (draft)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      title,
      requestType,
      requestedById,
      department,
      priority,
      dueDate,
      externalPartyName,
      externalPartyContact,
      pdfPath,
      remarks,
      approvers,
    } = body

    // Required identity field (validated separately from the shared field rules)
    if (!requestedById) {
      return NextResponse.json(
        { success: false, error: 'requestedById is required' },
        { status: 400 }
      )
    }
    if (!department || department.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'department is required' },
        { status: 400 }
      )
    }

    // Field-level validation (title, enums, future due date, external email)
    const fieldCheck = validateRequestFields(
      { title, requestType, priority, dueDate, externalPartyContact },
      new Date()
    )
    if (!fieldCheck.valid) {
      return NextResponse.json(
        { success: false, error: fieldCheck.errors.join('; '), errors: fieldCheck.errors },
        { status: 400 }
      )
    }

    // Validate any approvers passed inline (email format + no duplicates)
    if (Array.isArray(approvers) && approvers.length > 0) {
      const badEmails = approvers.filter(
        (a: ApproverInput) => !isValidEmail(a.approverEmail || '')
      )
      if (badEmails.length > 0) {
        return NextResponse.json(
          { success: false, error: 'One or more approver emails are invalid' },
          { status: 400 }
        )
      }
      const seen = new Set<string>()
      for (const a of approvers) {
        const key = (a.approverEmail || '').trim().toLowerCase()
        if (seen.has(key)) {
          return NextResponse.json(
            { success: false, error: `Duplicate approver email: ${a.approverEmail}` },
            { status: 400 }
          )
        }
        seen.add(key)
      }
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: requestedById },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Requested user not found',
        },
        { status: 404 }
      )
    }

    // Create document request with approvers
    const documentRequest = await prisma.documentRequest.create({
      data: {
        title,
        requestType,
        requestedById,
        department,
        priority,
        dueDate: new Date(dueDate),
        externalPartyName: externalPartyName || null,
        externalPartyContact: externalPartyContact || null,
        pdfPath: pdfPath || '',
        status: 'Draft',
        remarks: remarks || null,
        approvers: approvers
          ? {
              create: approvers.map((approver: ApproverInput, index: number) => ({
                approverName: approver.approverName,
                approverEmail: approver.approverEmail,
                role: approver.role,
                sequence: index + 1,
                status: 'Pending',
              })),
            }
          : undefined,
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

    return NextResponse.json(
      {
        success: true,
        data: documentRequest,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating request:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create document request',
      },
      { status: 500 }
    )
  }
}

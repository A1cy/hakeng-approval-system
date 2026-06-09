import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/users - List all users
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: users,
      count: users.length,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users',
      },
      { status: 500 }
    )
  }
}

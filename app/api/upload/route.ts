import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// POST /api/upload - Upload PDF file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No file provided',
        },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only PDF files are allowed',
        },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: 'File size exceeds 10MB limit',
        },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${timestamp}_${sanitizedName}`
    const filepath = path.join(uploadsDir, filename)

    // Convert file to buffer and write
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Return public URL
    const publicUrl = `/uploads/${filename}`

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename,
        path: publicUrl,
        size: file.size,
        mimeType: file.type,
      },
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload file',
      },
      { status: 500 }
    )
  }
}

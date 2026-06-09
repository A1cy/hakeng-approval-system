import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

// POST /api/upload - Upload a PDF to Vercel Blob storage.
// Vercel's serverless filesystem is read-only, so uploads go to Blob (a managed
// object store). The returned public URL is saved on the request's pdfPath.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type — PDF only
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Unique, sanitized object key. `addRandomSuffix` guards against collisions.
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const blob = await put(`requests/${sanitizedName}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/pdf',
    })

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: sanitizedName,
        path: blob.url, // public Blob URL, stored on the request
        size: file.size,
        mimeType: 'application/pdf',
      },
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

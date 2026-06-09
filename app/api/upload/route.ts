import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// POST /api/upload - Upload a PDF.
//
// Storage is environment-aware so the app runs end-to-end with zero extra setup:
//  - In production (Vercel), BLOB_READ_WRITE_TOKEN is set → store in Vercel Blob
//    (the serverless filesystem is read-only, so Blob is required there).
//  - Locally, with no token, fall back to writing into public/uploads/ so a
//    reviewer can test uploads after a plain `git clone` — no Blob account needed.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate type — PDF only
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'Only PDF files are allowed' }, { status: 400 })
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    let path: string

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Production / configured: Vercel Blob
      const blob = await put(`requests/${sanitizedName}`, file, {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/pdf',
      })
      path = blob.url
    } else {
      // Local dev fallback: write to public/uploads/ (served statically by Next)
      const bytes = Buffer.from(await file.arrayBuffer())
      const dir = join(process.cwd(), 'public', 'uploads')
      await mkdir(dir, { recursive: true })
      const filename = `${Date.now()}-${sanitizedName}`
      await writeFile(join(dir, filename), bytes)
      path = `/uploads/${filename}`
    }

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: { filename: sanitizedName, path, size: file.size, mimeType: 'application/pdf' },
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 })
  }
}

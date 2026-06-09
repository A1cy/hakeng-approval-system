'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'motion/react'

interface User { id: string; name: string; email: string; department: string }
interface Approver { approverName: string; approverEmail: string; role: string }

const inputCls =
  'w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/40'
const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground'

export default function NewRequestPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  const [formData, setFormData] = useState({
    title: '', requestType: 'Internal Approval', requestedById: '', department: '',
    priority: 'Medium', dueDate: '', externalPartyName: '', externalPartyContact: '',
    pdfPath: '', remarks: '',
  })
  const [approvers, setApprovers] = useState<Approver[]>([])
  const [newApprover, setNewApprover] = useState({ approverName: '', approverEmail: '', role: 'Reviewer' })

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      if (data.success) setUsers(data.data)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers()
  }, [fetchUsers])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const user = users.find((u) => u.id === e.target.value)
    if (user) setFormData((prev) => ({ ...prev, requestedById: user.id, department: user.department }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) { alert('Only PDF files are allowed'); return }
    try {
      setUploadingFile(true)
      const fd = new FormData()
      fd.append('file', file)
      const response = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await response.json()
      if (data.success) setFormData((prev) => ({ ...prev, pdfPath: data.data.path }))
      else alert('File upload failed: ' + data.error)
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('File upload failed')
    } finally {
      setUploadingFile(false)
    }
  }

  const addApprover = () => {
    if (!newApprover.approverName || !newApprover.approverEmail) { alert('Please fill in approver name and email'); return }
    setApprovers([...approvers, { ...newApprover }])
    setNewApprover({ approverName: '', approverEmail: '', role: 'Reviewer' })
  }
  const removeApprover = (i: number) => setApprovers(approvers.filter((_, idx) => idx !== i))
  const moveApproverUp = (i: number) => {
    if (i === 0) return
    const a = [...approvers]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setApprovers(a)
  }
  const moveApproverDown = (i: number) => {
    if (i === approvers.length - 1) return
    const a = [...approvers]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; setApprovers(a)
  }

  const validateForm = () => {
    if (!formData.title) { alert('Please enter a title'); return false }
    if (!formData.requestedById) { alert('Please select a requester'); return false }
    if (!formData.dueDate) { alert('Please select a due date'); return false }
    return true
  }

  const handleSaveDraft = async () => {
    if (!validateForm()) return
    try {
      setLoading(true)
      const response = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, approvers: approvers.length > 0 ? approvers : undefined }),
      })
      const data = await response.json()
      if (data.success) router.push(`/requests/${data.data.id}`)
      else alert('Failed to save draft: ' + data.error)
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Failed to save draft')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    if (!formData.pdfPath) { alert('Please upload a PDF document before submitting'); return }
    if (approvers.length === 0) { alert('Please add at least one approver before submitting'); return }
    try {
      setLoading(true)
      const createRes = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, approvers }),
      })
      const createData = await createRes.json()
      if (!createData.success) { alert('Failed to create request: ' + createData.error); return }
      const submitRes = await fetch(`/api/requests/${createData.data.id}/submit`, { method: 'POST' })
      const submitData = await submitRes.json()
      if (!submitData.success) alert('Failed to submit request: ' + submitData.error)
      router.push(`/requests/${createData.data.id}`)
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  const roleHints: Record<string, string> = { Reviewer: 'reviews', Approver: 'approves', Signatory: 'signs' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto max-w-3xl px-6 py-10"
    >
      <Link href="/requests" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to requests
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">New request</h1>
        <p className="mt-2 text-sm text-muted-foreground">Fill in the details, attach a PDF, and build the sequential approval chain.</p>
      </div>

      <div className="space-y-6">
        {/* Basic info */}
        <section className="glass rounded-xl p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basic information</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Title <span className="text-destructive">*</span></label>
              <input name="title" value={formData.title} onChange={handleInputChange} className={inputCls} placeholder="e.g. Q4 Vendor Contract Review" />
            </div>
            <div>
              <label className={labelCls}>Requester <span className="text-destructive">*</span></label>
              <select value={formData.requestedById} onChange={handleUserChange} className={inputCls}>
                <option value="">Select requester</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Department <span className="text-destructive">*</span></label>
              <input name="department" value={formData.department} onChange={handleInputChange} className={inputCls} placeholder="Department" />
            </div>
            <div>
              <label className={labelCls}>Request type <span className="text-destructive">*</span></label>
              <select name="requestType" value={formData.requestType} onChange={handleInputChange} className={inputCls}>
                {['Internal Approval', 'Client Submission', 'Contract Review', 'Signature Request'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority <span className="text-destructive">*</span></label>
              <select name="priority" value={formData.priority} onChange={handleInputChange} className={inputCls}>
                {['Low', 'Medium', 'High'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Due date <span className="text-destructive">*</span></label>
              <input type="date" name="dueDate" value={formData.dueDate} onChange={handleInputChange} className={`${inputCls} tnum`} />
            </div>
          </div>
        </section>

        {/* External party */}
        <section className="glass rounded-xl p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">External party <span className="normal-case text-muted-foreground/60">(optional)</span></h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Name</label>
              <input name="externalPartyName" value={formData.externalPartyName} onChange={handleInputChange} className={inputCls} placeholder="Company or person" />
            </div>
            <div>
              <label className={labelCls}>Email / WhatsApp</label>
              <input name="externalPartyContact" value={formData.externalPartyContact} onChange={handleInputChange} className={inputCls} placeholder="email or +966…" />
            </div>
          </div>
        </section>

        {/* Document */}
        <section className="glass rounded-xl p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document {formData.pdfPath ? '' : <span className="text-destructive">*</span>}</h2>
          {formData.pdfPath ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/[0.06] p-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div className="flex-1 text-sm"><div className="font-medium text-foreground">PDF uploaded</div><a href={formData.pdfPath} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View file</a></div>
              <button onClick={() => setFormData((p) => ({ ...p, pdfPath: '' }))} className="text-sm font-medium text-destructive hover:underline">Remove</button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/40 px-6 py-8 text-center transition hover:border-primary/50 hover:bg-primary/[0.03]">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <span className="text-sm font-medium text-foreground">{uploadingFile ? 'Uploading…' : 'Click to upload a PDF'}</span>
              <span className="text-xs text-muted-foreground">PDF only · max 10MB · stored on Vercel Blob</span>
              <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
            </label>
          )}
        </section>

        {/* Approvers */}
        <section className="glass rounded-xl p-6">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approvers</h2>
          <p className="mb-5 text-xs text-muted-foreground">They act in order — step 1 first, then 2, then 3.</p>

          {approvers.length > 0 && (
            <ol className="mb-5 space-y-2">
              {approvers.map((a, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary ring-1 ring-primary/25">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{a.approverName}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.approverEmail} · {a.role} {roleHints[a.role]}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveApproverUp(i)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30" title="Move up">↑</button>
                    <button onClick={() => moveApproverDown(i)} disabled={i === approvers.length - 1} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30" title="Move down">↓</button>
                    <button onClick={() => removeApprover(i)} className="grid h-7 w-7 place-items-center rounded-md text-destructive transition hover:bg-destructive/10" title="Remove">✕</button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input value={newApprover.approverName} onChange={(e) => setNewApprover({ ...newApprover, approverName: e.target.value })} className={inputCls} placeholder="Name" />
            <input type="email" value={newApprover.approverEmail} onChange={(e) => setNewApprover({ ...newApprover, approverEmail: e.target.value })} className={inputCls} placeholder="email@hakeng.sa" />
            <select value={newApprover.role} onChange={(e) => setNewApprover({ ...newApprover, role: e.target.value })} className={inputCls}>
              {['Reviewer', 'Approver', 'Signatory'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button onClick={addApprover} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/50 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/[0.04]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            Add approver
          </button>
        </section>

        {/* Remarks */}
        <section className="glass rounded-xl p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remarks <span className="normal-case text-muted-foreground/60">(optional)</span></h2>
          <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={4} className={inputCls} placeholder="Add any context for the approvers…" />
        </section>

        {/* Actions */}
        <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-xl glass p-4">
          <button onClick={handleSaveDraft} disabled={loading}
            className="rounded-lg border border-border bg-background/50 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/50 active:scale-[0.98] disabled:opacity-50">
            {loading ? 'Saving…' : 'Save as draft'}
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
            {loading ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

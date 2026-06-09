'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'motion/react'

interface Approver {
  id: string
  approverName: string
  approverEmail: string
  role: string
  sequence: number
}
interface DocumentRequest {
  id: string; title: string; requestType: string; department: string; priority: string
  dueDate: string; externalPartyName?: string; externalPartyContact?: string; pdfPath: string
  status: string; remarks?: string; approvers: Approver[]
}

const inputCls =
  'w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring/40'
const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground'

export default function EditRequestPage() {
  const params = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<DocumentRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [form, setForm] = useState({
    title: '', requestType: '', department: '', priority: '', dueDate: '',
    externalPartyName: '', externalPartyContact: '', pdfPath: '', remarks: '',
  })
  const [newApprover, setNewApprover] = useState({ approverName: '', approverEmail: '', role: 'Reviewer' })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${params.id}`)
      const data = await res.json()
      if (!data.success) { alert('Request not found'); router.push('/requests'); return }
      const r: DocumentRequest = data.data
      setRequest(r)
      setForm({
        title: r.title, requestType: r.requestType, department: r.department, priority: r.priority,
        dueDate: r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : '',
        externalPartyName: r.externalPartyName ?? '', externalPartyContact: r.externalPartyContact ?? '',
        pdfPath: r.pdfPath ?? '', remarks: r.remarks ?? '',
      })
    } catch (e) {
      console.error('Error loading request:', e)
      alert('Error loading request')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) { alert('Only PDF files are allowed'); return }
    try {
      setUploadingFile(true)
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) setForm((p) => ({ ...p, pdfPath: data.data.path }))
      else alert('Upload failed: ' + data.error)
    } finally {
      setUploadingFile(false)
    }
  }

  const addApprover = async () => {
    if (!newApprover.approverName || !newApprover.approverEmail) { alert('Name and email required'); return }
    const res = await fetch(`/api/requests/${params.id}/approvers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newApprover),
    })
    const data = await res.json()
    if (!data.success) { alert('Error: ' + data.error); return }
    setNewApprover({ approverName: '', approverEmail: '', role: 'Reviewer' })
    load()
  }

  const removeApprover = async (approverId: string) => {
    const res = await fetch(`/api/requests/${params.id}/approvers?approverId=${approverId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!data.success) { alert('Error: ' + data.error); return }
    load()
  }

  const save = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/requests/${params.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) router.push(`/requests/${params.id}`)
      else alert('Failed to save: ' + (data.errors?.join('; ') || data.error))
    } catch (e) {
      console.error('Error saving:', e)
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-6 py-10"><div className="glass h-40 animate-pulse rounded-xl" /></div>

  if (request && request.status !== 'Draft') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Only <span className="font-medium text-foreground">Draft</span> requests can be edited. This request is <span className="font-medium text-foreground">{request.status}</span>.</p>
        <Link href={`/requests/${params.id}`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">← Back to request</Link>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/requests/${params.id}`} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to request
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Edit draft</h1>
        <p className="mt-2 text-sm text-muted-foreground">Update the request and its approver chain. Changes are allowed only while the request is a Draft.</p>
      </div>

      <div className="space-y-6">
        <section className="glass rounded-xl p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Details</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Title</label>
              <input name="title" value={form.title} onChange={change} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <input name="department" value={form.department} onChange={change} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Request type</label>
              <select name="requestType" value={form.requestType} onChange={change} className={inputCls}>
                {['Internal Approval', 'Client Submission', 'Contract Review', 'Signature Request'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select name="priority" value={form.priority} onChange={change} className={inputCls}>
                {['Low', 'Medium', 'High'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input type="date" name="dueDate" value={form.dueDate} onChange={change} className={`${inputCls} tnum`} />
            </div>
            <div>
              <label className={labelCls}>External party name</label>
              <input name="externalPartyName" value={form.externalPartyName} onChange={change} className={inputCls} placeholder="optional" />
            </div>
            <div>
              <label className={labelCls}>External email / WhatsApp</label>
              <input name="externalPartyContact" value={form.externalPartyContact} onChange={change} className={inputCls} placeholder="optional" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Remarks</label>
              <textarea name="remarks" value={form.remarks} onChange={change} rows={3} className={inputCls} placeholder="optional" />
            </div>
          </div>
        </section>

        <section className="glass rounded-xl p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document</h2>
          {form.pdfPath ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/[0.06] p-3.5 text-sm">
              <span className="flex-1 text-foreground">PDF attached · <a href={form.pdfPath} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">view</a></span>
              <label className="cursor-pointer text-primary hover:underline">
                Replace<input type="file" accept=".pdf" onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/40 px-6 py-6 text-sm text-foreground transition hover:border-primary/50">
              {uploadingFile ? 'Uploading…' : 'Upload a PDF'}
              <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
            </label>
          )}
        </section>

        <section className="glass rounded-xl p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approvers (in order)</h2>
          {request && request.approvers.length > 0 && (
            <ol className="mb-5 space-y-2">
              {request.approvers.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary ring-1 ring-primary/25">{a.sequence}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{a.approverName}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.approverEmail} · {a.role}</div>
                  </div>
                  <button onClick={() => removeApprover(a.id)} className="grid h-7 w-7 place-items-center rounded-md text-destructive transition hover:bg-destructive/10" title="Remove">✕</button>
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

        <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-xl glass p-4">
          <Link href={`/requests/${params.id}`} className="rounded-lg border border-border bg-background/50 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/50">Cancel</Link>
          <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

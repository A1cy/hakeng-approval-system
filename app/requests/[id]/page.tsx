'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { StatusBadge, PriorityTag } from '@/components/status-badge'
import { getCurrentPendingApprover } from '@/lib/workflows'

interface User { id: string; name: string; email: string; department: string }
interface Approver {
  id: string; approverName: string; approverEmail: string; role: string
  sequence: number; status: string; comments?: string; actionDate?: string
}
interface DocumentRequest {
  id: string; title: string; requestType: string; department: string; priority: string
  dueDate: string; externalPartyName?: string; externalPartyContact?: string; pdfPath: string
  status: string; remarks?: string; requestedBy: User; approvers: Approver[]
  createdAt: string; updatedAt: string
}

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<DocumentRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [approverEmail, setApproverEmail] = useState('')
  const [comments, setComments] = useState('')
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [actionType, setActionType] = useState<'Approved' | 'Rejected'>('Approved')

  const fetchRequest = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests/${params.id}`)
      const data = await response.json()
      if (data.success) setRequest(data.data)
      else { alert('Request not found'); router.push('/requests') }
    } catch (error) {
      console.error('Error fetching request:', error)
      alert('Error loading request')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    if (params.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRequest()
    }
  }, [params.id, fetchRequest])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const openApprovalModal = (action: 'Approved' | 'Rejected') => {
    setActionType(action)
    setShowApprovalModal(true)
  }

  const handleApprovalAction = async () => {
    if (!approverEmail) { alert('Please enter your email address'); return }
    try {
      setActionLoading(true)
      const endpoint = actionType === 'Approved' ? 'approve' : 'reject'
      const response = await fetch(`/api/requests/${params.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverEmail, comments: comments || undefined }),
      })
      const data = await response.json()
      if (data.success) {
        setShowApprovalModal(false); setApproverEmail(''); setComments('')
        fetchRequest()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error processing approval:', error)
      alert('Failed to process approval')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitRequest = async () => {
    if (!confirm('Submit this request for approval?')) return
    try {
      setActionLoading(true)
      const response = await fetch(`/api/requests/${params.id}/submit`, { method: 'POST' })
      const data = await response.json()
      if (data.success) fetchRequest()
      else alert('Error: ' + data.error)
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Failed to submit request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteRequest = async () => {
    if (!confirm('Delete this request? This cannot be undone.')) return
    try {
      setActionLoading(true)
      const response = await fetch(`/api/requests/${params.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (data.success) router.push('/requests')
      else alert('Error: ' + data.error)
    } catch (error) {
      console.error('Error deleting request:', error)
      alert('Failed to delete request')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="glass h-40 animate-pulse rounded-xl" />
      </div>
    )
  }
  if (!request) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-center text-muted-foreground">Request not found</div>
  }

  const nextPending = getCurrentPendingApprover(request.approvers)
  const overdue = new Date(request.dueDate) < new Date() && !['Approved', 'Rejected'].includes(request.status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto max-w-5xl px-6 py-10"
    >
      <Link href="/requests" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to requests
      </Link>

      {/* Title block */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{request.requestType}</span>
            <PriorityTag priority={request.priority} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{request.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Raised by <span className="font-medium text-foreground">{request.requestedBy.name}</span> · {request.department} · {formatDate(request.createdAt)}
          </p>
        </div>
        <StatusBadge status={request.status} className="px-3 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Details */}
          <section className="glass rounded-xl p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request details</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field label="Request type" value={request.requestType} />
              <Field label="Department" value={request.department} />
              <Field label="Priority" value={<PriorityTag priority={request.priority} />} />
              <Field label="Due date" value={<span className={`tnum ${overdue ? 'font-semibold text-destructive' : ''}`}>{formatDate(request.dueDate)}{overdue && ' · overdue'}</span>} />
              {request.externalPartyName && (
                <Field label="External party" value={<>{request.externalPartyName}{request.externalPartyContact && <span className="text-muted-foreground"> · {request.externalPartyContact}</span>}</>} />
              )}
              {request.remarks && <div className="sm:col-span-2"><Field label="Remarks" value={request.remarks} /></div>}
            </dl>
          </section>

          {/* Document */}
          <section className="glass rounded-xl p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document</h2>
            {request.pdfPath ? (
              <a href={request.pdfPath} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-background/50 px-4 py-3 text-sm font-medium text-foreground transition hover:border-primary/50 hover:bg-primary/[0.04]">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/25">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M14 2v6h6M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                </span>
                <span className="flex flex-col"><span>View PDF attachment</span><span className="text-xs text-muted-foreground">opens in a new tab</span></span>
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No document uploaded yet.</p>
            )}
          </section>

          {/* Pending-approval actions */}
          {request.status === 'Pending Approval' && (
            <section className="glass rounded-xl p-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approver actions</h2>
              {nextPending && (
                <div className="mb-4 flex items-start gap-3 rounded-lg bg-warning/10 p-4 ring-1 ring-warning/30">
                  <span className="mt-0.5 flex h-2 w-2 shrink-0"><span className="absolute h-2 w-2 animate-ping rounded-full bg-warning opacity-60" /><span className="h-2 w-2 rounded-full bg-warning" /></span>
                  <p className="text-sm text-foreground">
                    Awaiting <span className="font-semibold">{nextPending.approverName}</span> ({nextPending.role}, step {nextPending.sequence}). Sequential approval is enforced — only the current approver can act.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => openApprovalModal('Approved')} disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Approve
                </button>
                <button onClick={() => openApprovalModal('Rejected')} disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/10 active:scale-[0.98] disabled:opacity-50">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                  Reject
                </button>
              </div>
            </section>
          )}

          {/* Draft actions */}
          {request.status === 'Draft' && (
            <section className="glass rounded-xl p-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</h2>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleSubmitRequest} disabled={actionLoading}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50">
                  Submit for approval
                </button>
                <button onClick={handleDeleteRequest} disabled={actionLoading}
                  className="rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/10 active:scale-[0.98] disabled:opacity-50">
                  Delete draft
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Right column — approval flow */}
        <div className="space-y-6">
          <section className="glass rounded-xl p-6">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval flow</h2>
            {request.approvers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approvers assigned.</p>
            ) : (
              <ol className="relative">
                {request.approvers.map((a, i) => {
                  const isCurrent = a.status === 'Pending' && nextPending?.id === a.id
                  const last = i === request.approvers.length - 1
                  return (
                    <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {!last && <span className="absolute left-[15px] top-9 h-[calc(100%-1.5rem)] w-px bg-border" aria-hidden />}
                      <Node status={a.status} sequence={a.sequence} current={isCurrent} />
                      <div className="flex-1 pt-0.5">
                        <div className="text-sm font-medium text-foreground">{a.approverName}</div>
                        <div className="text-xs text-muted-foreground">{a.approverEmail}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{a.role}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        {a.actionDate && <div className="tnum mt-1.5 text-[11px] text-muted-foreground">{formatDateTime(a.actionDate)}</div>}
                        {a.comments && <p className="mt-2 rounded-md bg-muted/40 p-2.5 text-xs text-foreground ring-1 ring-border/50">“{a.comments}”</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <section className="glass rounded-xl p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metadata</h2>
            <dl className="space-y-3 text-sm">
              <Field label="Created" value={<span className="tnum">{formatDateTime(request.createdAt)}</span>} />
              <Field label="Last updated" value={<span className="tnum">{formatDateTime(request.updatedAt)}</span>} />
              <Field label="Request ID" value={<span className="tnum font-mono text-xs">{request.id}</span>} />
            </dl>
          </section>
        </div>
      </div>

      {/* Approve/Reject modal */}
      <AnimatePresence>
        {showApprovalModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
            onClick={() => !actionLoading && setShowApprovalModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-md rounded-2xl p-6"
            >
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                {actionType === 'Approved' ? 'Approve request' : 'Reject request'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {actionType === 'Approved'
                  ? 'Confirm your approval to advance the chain.'
                  : 'Rejecting will mark the entire request as Rejected.'}
              </p>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Your email</span>
                  <input type="email" value={approverEmail} onChange={(e) => setApproverEmail(e.target.value)} placeholder="you@hakeng.sa"
                    className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40" required />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Comments {actionType === 'Rejected' ? '' : '(optional)'}</span>
                  <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder="Add a note…"
                    className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40" />
                </label>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setShowApprovalModal(false)} disabled={actionLoading}
                  className="flex-1 rounded-lg border border-border bg-background/50 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleApprovalAction} disabled={actionLoading}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                    actionType === 'Approved'
                      ? 'bg-primary text-primary-foreground hover:brightness-110'
                      : 'bg-destructive text-destructive-foreground hover:brightness-110'
                  }`}>
                  {actionLoading ? 'Processing…' : `Confirm ${actionType === 'Approved' ? 'approval' : 'rejection'}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  )
}

function Node({ status, sequence, current }: { status: string; sequence: number; current: boolean }) {
  if (status === 'Approved')
    return (
      <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/15">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    )
  if (status === 'Rejected')
    return (
      <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground ring-4 ring-destructive/15">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
      </span>
    )
  return (
    <span className={`z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
      current ? 'bg-warning/15 text-warning-foreground ring-4 ring-warning/20' : 'bg-muted text-muted-foreground ring-4 ring-background'
    }`}>
      {sequence}
    </span>
  )
}

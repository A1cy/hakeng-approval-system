'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { getCurrentPendingApprover, calculateAgingDays } from '@/lib/workflows'
import { StatusBadge } from '@/components/status-badge'

interface User {
  id: string
  name: string
  email: string
  department: string
}

interface Approver {
  id: string
  approverName: string
  approverEmail: string
  role: string
  sequence: number
  status: string
}

interface DocumentRequest {
  id: string
  title: string
  requestType: string
  department: string
  priority: string
  dueDate: string
  status: string
  requestedBy: User
  approvers: Approver[]
  createdAt: string
}

const STATUSES = ['Draft', 'Pending Approval', 'Approved', 'Rejected']
const TYPES = ['Internal Approval', 'Client Submission', 'Contract Review', 'Signature Request']
const PRIORITIES = ['Low', 'Medium', 'High']

export default function RequestsPage() {
  const [requests, setRequests] = useState<DocumentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', requestType: '', priority: '', department: '' })

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter.status) params.append('status', filter.status)
      if (filter.requestType) params.append('requestType', filter.requestType)
      if (filter.priority) params.append('priority', filter.priority)
      if (filter.department) params.append('department', filter.department)
      const res = await fetch(`/api/requests?${params.toString()}`)
      const data = await res.json()
      if (data.success) setRequests(data.data)
    } catch (e) {
      console.error('Error fetching requests:', e)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests()
  }, [fetchRequests])

  const stats = useMemo(() => {
    const by = (s: string) => requests.filter((r) => r.status === s).length
    return [
      { label: 'Total', value: requests.length, tone: 'text-foreground' },
      { label: 'Pending', value: by('Pending Approval'), tone: 'text-warning' },
      { label: 'Approved', value: by('Approved'), tone: 'text-primary' },
      { label: 'Rejected', value: by('Rejected'), tone: 'text-destructive' },
    ]
  }, [requests])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const selectCls =
    'w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring/40'

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-8"
      >
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Document Approvals
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Requests
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Track every document request through its sequential approval chain — from draft to
          signed-off.
        </p>
      </motion.div>

      {/* Metric tiles */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            className="glass rounded-xl p-4"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </div>
            <div className={`tnum mt-1 text-3xl font-semibold ${s.tone}`}>{s.value}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        className="glass mb-6 rounded-xl p-5"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className={selectCls}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</span>
            <select value={filter.requestType} onChange={(e) => setFilter({ ...filter, requestType: e.target.value })} className={selectCls}>
              <option value="">All types</option>
              {TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority</span>
            <select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })} className={selectCls}>
              <option value="">All priorities</option>
              {PRIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</span>
            <input value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value })} placeholder="Search department" className={selectCls} />
          </label>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
        className="glass overflow-hidden rounded-xl"
      >
        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">No requests match these filters.</p>
            <Link href="/requests/new" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Create the first request →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left">
                  {['Title', 'Requested By', 'Department', 'Status', 'Current Pending Approver', 'Due Date', 'Aging', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r, i) => {
                  const pending = r.status === 'Pending Approval' ? getCurrentPendingApprover(r.approvers) : null
                  const aging = calculateAgingDays(r.createdAt, new Date())
                  const overdue = new Date(r.dueDate) < new Date() && !['Approved', 'Rejected'].includes(r.status)
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.3 }}
                      className="group border-b border-border/40 transition-colors last:border-0 hover:bg-primary/[0.04]"
                    >
                      <td className="px-5 py-4">
                        <Link href={`/requests/${r.id}`} className="font-medium text-foreground transition group-hover:text-primary">
                          {r.title}
                        </Link>
                        <div className="mt-0.5 text-xs text-muted-foreground">{r.requestType}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-foreground">{r.requestedBy.name}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">{r.department}</td>
                      <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {pending ? (
                          <span className="text-foreground">
                            {pending.approverName}
                            <span className="ml-1 text-xs text-muted-foreground">· step {pending.sequence}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className={`tnum whitespace-nowrap px-5 py-4 ${overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                        {formatDate(r.dueDate)}
                        {overdue && <span className="ml-1.5 text-[10px] uppercase tracking-wide">overdue</span>}
                      </td>
                      <td className="tnum px-5 py-4 text-muted-foreground">{aging}d</td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/requests/${r.id}`} className="text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100">
                          View →
                        </Link>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {!loading && requests.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Showing {requests.length} request{requests.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentPendingApprover, calculateAgingDays } from '@/lib/workflows'

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
  comments?: string
  actionDate?: string
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

export default function RequestsPage() {
  const [requests, setRequests] = useState<DocumentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: '',
    requestType: '',
    priority: '',
    department: '',
  })

  // useCallback so the function identity is stable per `filter`, satisfying the
  // effect's dependency list. State is only set after the await (never
  // synchronously inside the effect), avoiding cascading-render lint errors.
  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter.status) params.append('status', filter.status)
      if (filter.requestType) params.append('requestType', filter.requestType)
      if (filter.priority) params.append('priority', filter.priority)
      if (filter.department) params.append('department', filter.department)

      const response = await fetch(`/api/requests?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setRequests(data.data)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    // Standard fetch-on-mount: state is set only after the await inside
    // fetchRequests, so this does not cause a synchronous cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests()
  }, [fetchRequests])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
      case 'Pending Approval':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'Approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Document Requests
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Manage approval workflows and track document submissions
            </p>
          </div>
          <Link
            href="/requests/new"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            + Create New Request
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Status
              </label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Type
              </label>
              <select
                value={filter.requestType}
                onChange={(e) => setFilter({ ...filter, requestType: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              >
                <option value="">All Types</option>
                <option value="Internal Approval">Internal Approval</option>
                <option value="Client Submission">Client Submission</option>
                <option value="Contract Review">Contract Review</option>
                <option value="Signature Request">Signature Request</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Priority
              </label>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              >
                <option value="">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Department
              </label>
              <input
                type="text"
                value={filter.department}
                onChange={(e) => setFilter({ ...filter, department: e.target.value })}
                placeholder="Filter by department"
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-zinc-600 dark:text-zinc-400">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 dark:text-zinc-400">
              No requests found. Create your first request to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Requested By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Current Pending Approver
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Aging (Days)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {requests.map((request) => {
                    // Feature 10e: current pending approver = lowest-sequence Pending.
                    // Only meaningful while the request is in flight.
                    const pending =
                      request.status === 'Pending Approval'
                        ? getCurrentPendingApprover(request.approvers)
                        : null
                    // Feature 10g: aging in whole days since creation.
                    const aging = calculateAgingDays(request.createdAt, new Date())
                    const overdue =
                      new Date(request.dueDate) < new Date() &&
                      !['Approved', 'Rejected'].includes(request.status)

                    return (
                      <tr
                        key={request.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/requests/${request.id}`}
                            className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-primary transition-colors"
                          >
                            {request.title}
                          </Link>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {request.requestType}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                          {request.requestedBy.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                          {request.department}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {pending ? (
                            <span className="text-zinc-900 dark:text-zinc-100">
                              {pending.approverName}
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {' '}
                                (#{pending.sequence})
                              </span>
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600">N/A</span>
                          )}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm ${
                            overdue
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {formatDate(request.dueDate)}
                          {overdue && (
                            <span className="block text-xs text-red-500">Overdue</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                          {aging}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/requests/${request.id}`}
                            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {!loading && requests.length > 0 && (
          <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Showing {requests.length} request{requests.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

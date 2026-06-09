'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
  externalPartyName?: string
  externalPartyContact?: string
  pdfPath: string
  status: string
  remarks?: string
  requestedBy: User
  approvers: Approver[]
  createdAt: string
  updatedAt: string
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

  // Defined before the effect (no use-before-declare) and memoised on the id so
  // the effect's dependency list is honest. State is set only after the await.
  const fetchRequest = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests/${params.id}`)
      const data = await response.json()

      if (data.success) {
        setRequest(data.data)
      } else {
        alert('Request not found')
        router.push('/requests')
      }
    } catch (error) {
      console.error('Error fetching request:', error)
      alert('Error loading request')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    if (params.id) {
      // Fetch-on-mount: state is set post-await inside fetchRequest, not synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRequest()
    }
  }, [params.id, fetchRequest])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 dark:text-red-400 font-semibold'
      case 'Medium':
        return 'text-yellow-600 dark:text-yellow-400 font-medium'
      case 'Low':
        return 'text-green-600 dark:text-green-400'
      default:
        return 'text-zinc-600 dark:text-zinc-400'
    }
  }

  const openApprovalModal = (action: 'Approved' | 'Rejected') => {
    setActionType(action)
    setShowApprovalModal(true)
  }

  const handleApprovalAction = async () => {
    if (!approverEmail) {
      alert('Please enter your email address')
      return
    }

    try {
      setActionLoading(true)
      // Separate endpoints per spec: /approve and /reject
      const endpoint = actionType === 'Approved' ? 'approve' : 'reject'
      const response = await fetch(`/api/requests/${params.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverEmail,
          comments: comments || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`Request ${actionType.toLowerCase()} successfully!`)
        setShowApprovalModal(false)
        setApproverEmail('')
        setComments('')
        fetchRequest() // Refresh the data
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
    if (!confirm('Are you sure you want to submit this request for approval?')) {
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/requests/${params.id}/submit`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        alert('Request submitted successfully!')
        fetchRequest()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Failed to submit request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteRequest = async () => {
    if (!confirm('Are you sure you want to delete this request? This cannot be undone.')) {
      return
    }

    try {
      setActionLoading(true)
      const response = await fetch(`/api/requests/${params.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert('Request deleted successfully')
        router.push('/requests')
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error deleting request:', error)
      alert('Failed to delete request')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
        <div className="max-w-5xl mx-auto text-center text-zinc-600 dark:text-zinc-400">
          Loading request details...
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
        <div className="max-w-5xl mx-auto text-center text-zinc-600 dark:text-zinc-400">
          Request not found
        </div>
      </div>
    )
  }

  // Find the next pending approver (for sequential logic display)
  const nextPendingApprover = request.approvers.find((a) => a.status === 'Pending')

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/requests"
            className="text-primary hover:text-primary/80 text-sm font-medium mb-4 inline-block transition-colors"
          >
            ← Back to Requests
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {request.title}
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                Created by {request.requestedBy.name} on {formatDate(request.createdAt)}
              </p>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(
                request.status
              )}`}
            >
              {request.status}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Request Details
              </h2>
              <dl className="space-y-3">
                <div className="grid grid-cols-3">
                  <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Request Type
                  </dt>
                  <dd className="col-span-2 text-sm text-zinc-900 dark:text-zinc-100">
                    {request.requestType}
                  </dd>
                </div>
                <div className="grid grid-cols-3">
                  <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Department
                  </dt>
                  <dd className="col-span-2 text-sm text-zinc-900 dark:text-zinc-100">
                    {request.department}
                  </dd>
                </div>
                <div className="grid grid-cols-3">
                  <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Priority
                  </dt>
                  <dd className={`col-span-2 text-sm ${getPriorityColor(request.priority)}`}>
                    {request.priority}
                  </dd>
                </div>
                <div className="grid grid-cols-3">
                  <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Due Date
                  </dt>
                  <dd className="col-span-2 text-sm text-zinc-900 dark:text-zinc-100">
                    {formatDate(request.dueDate)}
                  </dd>
                </div>
                {request.externalPartyName && (
                  <div className="grid grid-cols-3">
                    <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      External Party
                    </dt>
                    <dd className="col-span-2 text-sm text-zinc-900 dark:text-zinc-100">
                      {request.externalPartyName}
                      {request.externalPartyContact && (
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {' '}
                          ({request.externalPartyContact})
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {request.remarks && (
                  <div className="grid grid-cols-3">
                    <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Remarks
                    </dt>
                    <dd className="col-span-2 text-sm text-zinc-900 dark:text-zinc-100">
                      {request.remarks}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* PDF Document */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Document
              </h2>
              {request.pdfPath ? (
                <div className="space-y-3">
                  <a
                    href={request.pdfPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    View/Download PDF
                  </a>
                </div>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No document uploaded yet
                </p>
              )}
            </div>

            {/* Approval Actions (if pending approval) */}
            {request.status === 'Pending Approval' && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                  Approver Actions
                </h2>
                {nextPendingApprover && (
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      <strong>Next Approver:</strong> {nextPendingApprover.approverName} (
                      {nextPendingApprover.approverEmail}) • {nextPendingApprover.role}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      Sequential approval is enforced. Only the next pending approver can take
                      action.
                    </p>
                  </div>
                )}
                <div className="flex gap-4">
                  <button
                    onClick={() => openApprovalModal('Approved')}
                    disabled={actionLoading}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => openApprovalModal('Rejected')}
                    disabled={actionLoading}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            )}

            {/* Draft Actions */}
            {request.status === 'Draft' && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                  Actions
                </h2>
                <div className="flex gap-4">
                  <button
                    onClick={handleSubmitRequest}
                    disabled={actionLoading}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit for Approval
                  </button>
                  <button
                    onClick={handleDeleteRequest}
                    disabled={actionLoading}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete Draft
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Approvers */}
          <div className="space-y-6">
            {/* Approvers Timeline */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Approval Flow
              </h2>
              {request.approvers.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No approvers assigned yet
                </p>
              ) : (
                <div className="space-y-4">
                  {request.approvers.map((approver, index) => (
                    <div key={approver.id} className="relative">
                      {/* Connector line */}
                      {index < request.approvers.length - 1 && (
                        <div className="absolute left-4 top-10 w-0.5 h-full bg-zinc-200 dark:bg-zinc-700" />
                      )}

                      <div className="flex gap-3">
                        {/* Status indicator */}
                        <div className="relative z-10">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              approver.status === 'Approved'
                                ? 'bg-green-500 text-white'
                                : approver.status === 'Rejected'
                                ? 'bg-red-500 text-white'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {approver.sequence}
                          </div>
                        </div>

                        {/* Approver info */}
                        <div className="flex-1 pb-6">
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {approver.approverName}
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            {approver.approverEmail}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                            {approver.role}
                          </div>
                          <div className="mt-2">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                                approver.status
                              )}`}
                            >
                              {approver.status}
                            </span>
                          </div>
                          {approver.actionDate && (
                            <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                              {formatDateTime(approver.actionDate)}
                            </div>
                          )}
                          {approver.comments && (
                            <div className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded text-xs text-zinc-700 dark:text-zinc-300">
                              {approver.comments}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                Metadata
              </h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Created</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {formatDateTime(request.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Last Updated</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {formatDateTime(request.updatedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Request ID</dt>
                  <dd className="text-zinc-900 dark:text-zinc-100 font-mono text-xs">
                    {request.id}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              {actionType === 'Approved' ? 'Approve Request' : 'Reject Request'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Your Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={approverEmail}
                  onChange={(e) => setApproverEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  placeholder="approver@hakeng.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Comments (Optional)
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  placeholder="Add any comments..."
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowApprovalModal(false)
                    setApproverEmail('')
                    setComments('')
                  }}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprovalAction}
                  disabled={actionLoading}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionType === 'Approved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? 'Processing...' : `Confirm ${actionType}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

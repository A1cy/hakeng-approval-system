'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  name: string
  email: string
  department: string
}

interface Approver {
  approverName: string
  approverEmail: string
  role: string
}

export default function NewRequestPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    requestType: 'Internal Approval',
    requestedById: '',
    department: '',
    priority: 'Medium',
    dueDate: '',
    externalPartyName: '',
    externalPartyContact: '',
    pdfPath: '',
    remarks: '',
  })

  const [approvers, setApprovers] = useState<Approver[]>([])
  const [newApprover, setNewApprover] = useState({
    approverName: '',
    approverEmail: '',
    role: 'Reviewer',
  })

  // Declared before the effect that uses it; memoised so the dependency list is honest.
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      if (data.success) {
        setUsers(data.data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }, [])

  useEffect(() => {
    // Fetch-on-mount: state is set post-await inside fetchUsers, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers()
  }, [fetchUsers])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value
    const user = users.find((u) => u.id === userId)
    if (user) {
      setFormData((prev) => ({
        ...prev,
        requestedById: userId,
        department: user.department,
      }))
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are allowed')
      return
    }

    try {
      setUploadingFile(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (data.success) {
        setFormData((prev) => ({ ...prev, pdfPath: data.data.path }))
        alert('File uploaded successfully!')
      } else {
        alert('File upload failed: ' + data.error)
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('File upload failed')
    } finally {
      setUploadingFile(false)
    }
  }

  const addApprover = () => {
    if (!newApprover.approverName || !newApprover.approverEmail) {
      alert('Please fill in approver name and email')
      return
    }

    setApprovers([...approvers, { ...newApprover }])
    setNewApprover({
      approverName: '',
      approverEmail: '',
      role: 'Reviewer',
    })
  }

  const removeApprover = (index: number) => {
    setApprovers(approvers.filter((_, i) => i !== index))
  }

  const moveApproverUp = (index: number) => {
    if (index === 0) return
    const newApprovers = [...approvers]
    ;[newApprovers[index - 1], newApprovers[index]] = [newApprovers[index], newApprovers[index - 1]]
    setApprovers(newApprovers)
  }

  const moveApproverDown = (index: number) => {
    if (index === approvers.length - 1) return
    const newApprovers = [...approvers]
    ;[newApprovers[index], newApprovers[index + 1]] = [newApprovers[index + 1], newApprovers[index]]
    setApprovers(newApprovers)
  }

  const validateForm = () => {
    if (!formData.title) {
      alert('Please enter a title')
      return false
    }
    if (!formData.requestedById) {
      alert('Please select a requester')
      return false
    }
    if (!formData.dueDate) {
      alert('Please select a due date')
      return false
    }
    return true
  }

  const handleSaveDraft = async () => {
    if (!validateForm()) return

    try {
      setLoading(true)
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          approvers: approvers.length > 0 ? approvers : undefined,
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('Draft saved successfully!')
        router.push(`/requests/${data.data.id}`)
      } else {
        alert('Failed to save draft: ' + data.error)
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Failed to save draft')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    if (!formData.pdfPath) {
      alert('Please upload a PDF document before submitting')
      return
    }

    if (approvers.length === 0) {
      alert('Please add at least one approver before submitting')
      return
    }

    try {
      setLoading(true)

      // First create the request as draft
      const createResponse = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          approvers,
        }),
      })

      const createData = await createResponse.json()
      if (!createData.success) {
        alert('Failed to create request: ' + createData.error)
        return
      }

      // Then submit it
      const submitResponse = await fetch(`/api/requests/${createData.data.id}/submit`, {
        method: 'POST',
      })

      const submitData = await submitResponse.json()
      if (submitData.success) {
        alert('Request submitted successfully!')
        router.push(`/requests/${createData.data.id}`)
      } else {
        alert('Failed to submit request: ' + submitData.error)
        router.push(`/requests/${createData.data.id}`)
      }
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/requests"
            className="text-primary hover:text-primary/80 text-sm font-medium mb-4 inline-block transition-colors"
          >
            ← Back to Requests
          </Link>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Create New Request
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Fill in the details below to create a new document request
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  placeholder="Enter request title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Requester <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.requestedById}
                  onChange={handleUserChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  required
                >
                  <option value="">Select requester</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  placeholder="Department"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="requestType"
                  value={formData.requestType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  required
                >
                  <option value="Internal Approval">Internal Approval</option>
                  <option value="Client Submission">Client Submission</option>
                  <option value="Contract Review">Contract Review</option>
                  <option value="Signature Request">Signature Request</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  required
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>
            </div>
          </div>

          {/* External Party (Optional) */}
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              External Party (Optional)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  External Party Name
                </label>
                <input
                  type="text"
                  name="externalPartyName"
                  value={formData.externalPartyName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  placeholder="Company or person name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  External Party Contact
                </label>
                <input
                  type="text"
                  name="externalPartyContact"
                  value={formData.externalPartyContact}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  placeholder="Email or WhatsApp"
                />
              </div>
            </div>
          </div>

          {/* PDF Upload */}
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Document Upload
            </h2>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                PDF Document {formData.pdfPath ? '' : <span className="text-red-500">*</span>}
              </label>
              {formData.pdfPath ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-green-600 dark:text-green-400">
                    ✓ File uploaded successfully
                  </span>
                  <a
                    href={formData.pdfPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                  >
                    View File
                  </a>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, pdfPath: '' }))}
                    className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="block w-full text-sm text-zinc-900 dark:text-zinc-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                  />
                  {uploadingFile && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                      Uploading...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Approvers */}
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Approvers (Sequential)
            </h2>

            {/* Approver List */}
            {approvers.length > 0 && (
              <div className="mb-4 space-y-2">
                {approvers.map((approver, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                  >
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 min-w-[30px]">
                      {index + 1}.
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {approver.approverName}
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {approver.approverEmail} • {approver.role}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveApproverUp(index)}
                        disabled={index === 0}
                        className="p-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveApproverDown(index)}
                        disabled={index === approvers.length - 1}
                        className="p-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeApprover(index)}
                        className="p-1 text-red-600 hover:text-red-700 transition-colors"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Approver Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newApprover.approverName}
                  onChange={(e) =>
                    setNewApprover({ ...newApprover, approverName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  placeholder="Approver name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newApprover.approverEmail}
                  onChange={(e) =>
                    setNewApprover({ ...newApprover, approverEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  placeholder="email@hakeng.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Role
                </label>
                <select
                  value={newApprover.role}
                  onChange={(e) =>
                    setNewApprover({ ...newApprover, role: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Reviewer">Reviewer</option>
                  <option value="Approver">Approver</option>
                  <option value="Signatory">Signatory</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={addApprover}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors font-medium"
            >
              + Add Approver
            </button>
          </div>

          {/* Remarks */}
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Additional Notes
            </h2>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Remarks (Optional)
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                placeholder="Add any additional notes or context..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={loading}
              className="px-6 py-3 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

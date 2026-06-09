// End-to-end verification against the RUNNING dev server (no mocks).
// Exercises the plan's verification protocol (lines 120-126).
// Run with: node tests/e2e-verify.mjs   (dev server must be up on :3000)

const BASE = 'http://localhost:3000'
let pass = 0
let fail = 0

function check(name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name}  ${detail}`)
  }
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function futureDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function main() {
  console.log('\n=== HAK Approval System — E2E verification ===\n')

  // Get a real seeded user
  const users = (await api('GET', '/api/users')).json.data
  const john = users.find((u) => u.email === 'john.doe@hakeng.com')
  check('Seeded users present', users.length >= 3)

  // --- Scenario A: Happy path (3 approvers, sequential approve → Approved) ---
  console.log('\n[A] Happy path — 3 approvers approve in sequence')

  const created = await api('POST', '/api/requests', {
    title: 'E2E Contract Review',
    requestType: 'Contract Review',
    requestedById: john.id,
    department: 'Engineering',
    priority: 'High',
    dueDate: futureDate(14),
    pdfPath: '/uploads/e2e-test.pdf', // simulate an already-uploaded PDF
    approvers: [
      { approverName: 'A One', approverEmail: 'a1@hakeng.com', role: 'Reviewer' },
      { approverName: 'A Two', approverEmail: 'a2@hakeng.com', role: 'Approver' },
      { approverName: 'A Three', approverEmail: 'a3@hakeng.com', role: 'Signatory' },
    ],
  })
  check('Create returns 201', created.status === 201, `got ${created.status}`)
  check('Default status is Draft', created.json.data?.status === 'Draft')
  const id = created.json.data.id

  // Submit
  const submitted = await api('POST', `/api/requests/${id}/submit`)
  check('Submit succeeds', submitted.status === 200, JSON.stringify(submitted.json))
  check('Status → Pending Approval', submitted.json.data?.status === 'Pending Approval')

  // A2 tries to approve before A1 → must be blocked (403)
  const outOfSeq = await api('POST', `/api/requests/${id}/approve`, { approverEmail: 'a2@hakeng.com' })
  check('A2 blocked before A1 (403)', outOfSeq.status === 403, `got ${outOfSeq.status}`)
  check('Block message mentions turn', /turn/i.test(outOfSeq.json.error || ''))

  // A1 approves → still Pending Approval
  const a1 = await api('POST', `/api/requests/${id}/approve`, { approverEmail: 'a1@hakeng.com' })
  check('A1 approves OK', a1.status === 200)
  check('Still Pending after A1', a1.json.data?.status === 'Pending Approval')

  // A1 cannot approve again
  const a1again = await api('POST', `/api/requests/${id}/approve`, { approverEmail: 'a1@hakeng.com' })
  check('A1 cannot act twice', a1again.status === 400, `got ${a1again.status}`)

  // A2 approves
  const a2 = await api('POST', `/api/requests/${id}/approve`, { approverEmail: 'a2@hakeng.com' })
  check('A2 approves OK', a2.status === 200)
  check('Still Pending after A2', a2.json.data?.status === 'Pending Approval')

  // A3 approves → Approved
  const a3 = await api('POST', `/api/requests/${id}/approve`, { approverEmail: 'a3@hakeng.com' })
  check('A3 approves OK', a3.status === 200)
  check('Status → Approved after all', a3.json.data?.status === 'Approved')

  // --- Scenario B: Rejection cascade ---
  console.log('\n[B] Rejection cascade — A1 rejects → whole request Rejected')

  const created2 = await api('POST', '/api/requests', {
    title: 'E2E Rejection Test',
    requestType: 'Internal Approval',
    requestedById: john.id,
    department: 'Engineering',
    priority: 'Medium',
    dueDate: futureDate(7),
    pdfPath: '/uploads/e2e-reject.pdf',
    approvers: [
      { approverName: 'R One', approverEmail: 'r1@hakeng.com', role: 'Reviewer' },
      { approverName: 'R Two', approverEmail: 'r2@hakeng.com', role: 'Approver' },
    ],
  })
  const id2 = created2.json.data.id
  await api('POST', `/api/requests/${id2}/submit`)

  const reject = await api('POST', `/api/requests/${id2}/reject`, {
    approverEmail: 'r1@hakeng.com',
    comments: 'Budget not approved',
  })
  check('R1 reject OK', reject.status === 200)
  check('Status → Rejected', reject.json.data?.status === 'Rejected')

  // R2 cannot act after rejection
  const r2 = await api('POST', `/api/requests/${id2}/approve`, { approverEmail: 'r2@hakeng.com' })
  check('R2 blocked after rejection', r2.status === 400, `got ${r2.status}`)

  // --- Scenario C: Submit validations ---
  console.log('\n[C] Submit validations')

  const noPdf = await api('POST', '/api/requests', {
    title: 'No PDF', requestType: 'Internal Approval', requestedById: john.id,
    department: 'Engineering', priority: 'Low', dueDate: futureDate(5),
    approvers: [{ approverName: 'X', approverEmail: 'x@hakeng.com', role: 'Reviewer' }],
  })
  const noPdfSubmit = await api('POST', `/api/requests/${noPdf.json.data.id}/submit`)
  check('Submit without PDF fails', noPdfSubmit.status === 400)
  check('Error names PDF', /pdf/i.test(noPdfSubmit.json.error || ''))

  const noApprover = await api('POST', '/api/requests', {
    title: 'No Approver', requestType: 'Internal Approval', requestedById: john.id,
    department: 'Engineering', priority: 'Low', dueDate: futureDate(5),
    pdfPath: '/uploads/x.pdf',
  })
  const noApprSubmit = await api('POST', `/api/requests/${noApprover.json.data.id}/submit`)
  check('Submit without approver fails', noApprSubmit.status === 400)
  check('Error names approver', /approver/i.test(noApprSubmit.json.error || ''))

  // --- Scenario D: Field validation (past due date) ---
  console.log('\n[D] Field validation')

  const pastDue = await api('POST', '/api/requests', {
    title: 'Past Due', requestType: 'Internal Approval', requestedById: john.id,
    department: 'Engineering', priority: 'Low', dueDate: '2020-01-01',
  })
  check('Past due date rejected (400)', pastDue.status === 400, `got ${pastDue.status}`)

  const dupEmail = await api('POST', '/api/requests', {
    title: 'Dup', requestType: 'Internal Approval', requestedById: john.id,
    department: 'Engineering', priority: 'Low', dueDate: futureDate(5),
    approvers: [
      { approverName: 'D1', approverEmail: 'dup@hakeng.com', role: 'Reviewer' },
      { approverName: 'D2', approverEmail: 'dup@hakeng.com', role: 'Approver' },
    ],
  })
  check('Duplicate approver email rejected', dupEmail.status === 400, `got ${dupEmail.status}`)

  // --- Scenario E: List view data (current approver + aging) ---
  console.log('\n[E] List endpoint returns derivable columns')

  const list = await api('GET', '/api/requests')
  check('List returns array', Array.isArray(list.json.data))
  const happy = list.json.data.find((r) => r.id === id)
  check('Approved request has all approvers approved',
    happy?.approvers?.every((a) => a.status === 'Approved'))
  const rejected = list.json.data.find((r) => r.id === id2)
  check('Rejected request shows Rejected', rejected?.status === 'Rejected')

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('E2E script error:', e)
  process.exit(1)
})

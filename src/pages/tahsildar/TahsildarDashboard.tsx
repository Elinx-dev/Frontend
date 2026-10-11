import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth'
import { Banner } from '../../ui'
import { CheckCircleIcon, ClockIcon, ListIcon, ShieldCheckIcon, WorkflowIcon } from '../../icons'
import { useVaoResource } from '../vao/useVao'
import { formatTimestamp, rupees } from '../vao/vaoShared'
import { recordPath } from './tahsildarShared'
import { TahsildarStagePill } from './TahsildarUi'
import type { TahsildarDashboardData } from './tahsildarShared'

const LIFECYCLE = [
  { label: 'Surveyor field survey', stages: ['WITH_SURVEYOR'] },
  { label: 'VAO verifies & forwards', stages: ['WITH_VAO', 'OBJECTION_PENDING'] },
  { label: 'Tahsildar reviews the checklist', stages: ['READY_FOR_APPROVAL', 'ON_HOLD'] },
  { label: 'Tahsildar approves & generates patta', stages: ['APPROVED'] },
]

export default function TahsildarDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, error, loading } = useVaoResource<TahsildarDashboardData>('/api/tahsildar/dashboard')
  const kpis = data?.kpis
  const taluks = (data?.officer.jurisdiction ?? []).map((j) => j.taluk_name ?? j.taluk_code).filter(Boolean)
  const value = (n: number | undefined) => n ?? (loading ? '…' : 0)

  return (
    <div className="vao-page">
      <section className="vao-welcome">
        <span className="vao-welcome-icon"><ShieldCheckIcon /></span>
        <div>
          <p>Tahsildar Portal</p>
          <h1>Welcome back, {user?.fullName ?? 'Officer'}</h1>
          <small>{user?.designation ?? 'Tahsildar'}{taluks.length > 0 ? ` · ${taluks.join(', ')} Taluk` : ''}</small>
        </div>
      </section>
      <Banner kind="error" message={error} />

      <div className="vao-kpis">
        <div className="vao-kpi tone-warning">
          <span>Pending approval <ClockIcon /></span>
          <strong>{value(kpis?.awaitingApproval)}</strong>
          <small>{kpis?.readyForApproval ?? 0} ready · {kpis?.onHold ?? 0} checks pending</small>
        </div>
        <div className="vao-kpi tone-navy">
          <span>Total in queue <WorkflowIcon /></span>
          <strong>{value(kpis?.total)}</strong>
          <small>{kpis?.inProgress ?? 0} with Surveyor / VAO · {kpis?.objections ?? 0} objections</small>
        </div>
        <div className="vao-kpi tone-gold">
          <span>Approved today <CheckCircleIcon /></span>
          <strong>{value(kpis?.approvedToday)}</strong>
          <small>{kpis?.approvedThisMonth ?? 0} this month</small>
        </div>
        <div className="vao-kpi tone-success">
          <span>Approved <ShieldCheckIcon /></span>
          <strong>{value(kpis?.approved)}</strong>
          <small>Revenue record updated, patta issued</small>
        </div>
      </div>

      <div className="vao-dash-grid">
        <section className="vao-card">
          <h2>Quick actions</h2>
          <div className="vao-quick-grid">
            <Link className="vao-quick" to="/tahsildar/verification">
              <ShieldCheckIcon />
              <div>
                <strong>Verification Queue</strong>
                <small>Review pending patta mutation requests from the VAO · {kpis?.readyForApproval ?? 0} ready</small>
              </div>
            </Link>
            <Link className="vao-quick" to="/tahsildar/transactions">
              <ListIcon />
              <div>
                <strong>Transactions</strong>
                <small>Search every transaction in your taluk</small>
              </div>
            </Link>
            <div className="vao-quick info">
              <ShieldCheckIcon />
              <div>
                <strong>Your jurisdiction</strong>
                <small>{taluks.length > 0 ? `${taluks.join(', ')} Taluk` : '—'}</small>
                <small>{kpis?.total ?? 0} transactions · {kpis?.awaitingApproval ?? 0} pending approval</small>
              </div>
            </div>
          </div>
          <div className="vao-lifecycle">
            <h3>Mutation lifecycle</h3>
            {LIFECYCLE.map((step) => (
              <div key={step.label} className="vao-lifecycle-step">
                <span className="tick">✓</span>
                <span>{step.label}</span>
                <b>{step.stages.reduce((sum, stage) => sum + (data?.byStage.find((s) => s.stage === stage)?.count ?? 0), 0)}</b>
              </div>
            ))}
          </div>
          {data != null && data.byVillage.length > 0 ? (
            <div className="vao-lifecycle">
              <h3>By village</h3>
              <table className="vao-table compact">
                <thead><tr><th>Village</th><th>Total</th><th>Awaiting you</th><th>Approved</th></tr></thead>
                <tbody>
                  {data.byVillage.map((v) => (
                    <tr key={v.village_name}><td>{v.village_name}</td><td>{v.total}</td><td>{v.pending}</td><td>{v.approved}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="vao-card">
          <div className="vao-card-head">
            <h2>Pending queue</h2>
            <Link to="/tahsildar/verification">View all →</Link>
          </div>
          {data != null && data.approvalQueue.length === 0 ? <p className="muted">No pending items. Items appear once the VAO forwards a mutation request.</p> : null}
          <div className="vao-snapshot">
            {(data?.approvalQueue ?? []).map((r) => (
              <button key={r.txn_ref} className="vao-snapshot-item" onClick={() => navigate(recordPath(r.txn_ref))}>
                <div>
                  <strong>{r.ulpin ?? r.property_ref}</strong>
                  <small>{r.txn_ref} · {r.village_name ?? r.village_code} · {rupees(r.declared_consideration)}</small>
                </div>
                <TahsildarStagePill record={r} />
              </button>
            ))}
          </div>
          <div className="vao-card-head" style={{ marginTop: 18 }}>
            <h2>Recent approvals</h2>
          </div>
          {data != null && data.recentApprovals.length === 0 ? <p className="muted">No approvals yet.</p> : null}
          <div className="vao-snapshot">
            {(data?.recentApprovals ?? []).map((r) => (
              <button key={r.txn_ref} className="vao-snapshot-item" onClick={() => navigate(recordPath(r.txn_ref))}>
                <div>
                  <strong>{r.ulpin ?? r.property_ref}</strong>
                  <small>{r.mutation_register_number ?? r.txn_ref} · {formatTimestamp(r.approved_at)}</small>
                </div>
                <TahsildarStagePill record={r} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

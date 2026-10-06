import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth'
import { Banner } from '../../ui'
import { CalendarIcon, CheckCircleIcon, ClockIcon, CompassIcon, PinIcon, ShieldCheckIcon } from '../../icons'
import { useVaoResource } from './useVao'
import { StagePill } from './VaoUi'
import { when } from './vaoShared'
import type { VaoDashboardData } from './vaoShared'

const LIFECYCLE = [
  { label: 'Agree a visit slot with the Surveyor', stages: ['AWAITING_PROPOSAL', 'SURVEYOR_PROPOSED', 'SURVEYOR_COUNTERED', 'VAO_PROPOSED', 'VAO_COUNTERED'] },
  { label: 'Slot booked — confirm the visit', stages: ['SLOT_BOOKED', 'CHECK_IN_DUE'] },
  { label: 'Check in at site', stages: ['VISIT_DONE'] },
  { label: 'Verify & forward to Tahsildar', stages: ['READY_TO_VERIFY', 'VERIFIED'] },
]

export default function VaoDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, error, loading } = useVaoResource<VaoDashboardData>('/api/vao/dashboard')
  const kpis = data?.kpis
  const villages = data?.officer.villages ?? []

  return (
    <div className="vao-page">
      <section className="vao-welcome">
        <span className="vao-welcome-icon"><CompassIcon /></span>
        <div>
          <p>VAO Officer Portal</p>
          <h1>Welcome back, {user?.fullName ?? 'Officer'}</h1>
          <small>{user?.designation ?? 'VAO'}{villages.length > 0 ? ` · ${villages.join(', ')}` : ''}</small>
        </div>
      </section>
      <Banner kind="error" message={error} />

      <div className="vao-kpis">
        <div className="vao-kpi tone-warning">
          <span>Action required <ClockIcon /></span>
          <strong>{kpis?.actionRequired ?? (loading ? '…' : 0)}</strong>
          <small>Needs your attention</small>
        </div>
        <div className="vao-kpi tone-navy">
          <span>Scheduled <CalendarIcon /></span>
          <strong>{kpis?.scheduled ?? (loading ? '…' : 0)}</strong>
          <small>Visit slots booked</small>
        </div>
        <div className="vao-kpi tone-gold">
          <span>Visit done <PinIcon /></span>
          <strong>{kpis?.visitDone ?? (loading ? '…' : 0)}</strong>
          <small>Checked in at site</small>
        </div>
        <div className="vao-kpi tone-success">
          <span>Verified <CheckCircleIcon /></span>
          <strong>{kpis?.verified ?? (loading ? '…' : 0)}</strong>
          <small>Forwarded to Tahsildar</small>
        </div>
      </div>

      <div className="vao-dash-grid">
        <section className="vao-card">
          <h2>Quick actions</h2>
          <div className="vao-quick-grid">
            <Link className="vao-quick" to="/vao/site-visits">
              <CalendarIcon />
              <div>
                <strong>Site Visit Plan</strong>
                <small>Planned dates and times, accept or counter the Surveyor, check in</small>
              </div>
            </Link>
            <Link className="vao-quick" to="/vao/slots">
              <ClockIcon />
              <div>
                <strong>Slot Booking</strong>
                <small>Book a visit slot — required before you can verify</small>
              </div>
            </Link>
            <Link className="vao-quick" to="/vao/verification">
              <ShieldCheckIcon />
              <div>
                <strong>Verification Queue</strong>
                <small>{kpis?.readyToVerify ?? 0} ready to verify &amp; forward</small>
              </div>
            </Link>
            <div className="vao-quick info">
              <CompassIcon />
              <div>
                <strong>Your jurisdiction</strong>
                <small>{villages.length > 0 ? villages.join(', ') : '—'}</small>
                <small>{kpis?.assigned ?? 0} records assigned · {kpis?.actionRequired ?? 0} need attention</small>
              </div>
            </div>
          </div>
          <div className="vao-lifecycle">
            <h3>Visit lifecycle</h3>
            {LIFECYCLE.map((step) => {
              const count = step.stages.reduce((sum, stage) => sum + (data?.byStage[stage] ?? 0), 0)
              return (
                <div key={step.label} className="vao-lifecycle-step">
                  <span className="tick">✓</span>
                  <span>{step.label}</span>
                  <b>{count}</b>
                </div>
              )
            })}
          </div>
          {data != null && data.todaysVisits.length > 0 ? (
            <div className="vao-lifecycle">
              <h3>Today&apos;s visits</h3>
              {data.todaysVisits.map((r) => (
                <div key={r.txn_ref} className="vao-lifecycle-step">
                  <span className="tick"><ClockIcon /></span>
                  <span className="mono">{r.agreed_time} · {r.ulpin ?? r.property_ref}</span>
                  <StagePill record={r} />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="vao-card">
          <div className="vao-card-head">
            <h2>Task snapshot</h2>
            <Link to="/vao/site-visits">View all →</Link>
          </div>
          {data != null && data.records.length === 0 ? <p className="muted">No records are assigned to you yet.</p> : null}
          <div className="vao-snapshot">
            {(data?.records ?? []).slice(0, 8).map((r) => (
              <button
                key={r.txn_ref}
                className="vao-snapshot-item"
                onClick={() => navigate(r.status === 'SURVEY_PENDING' ? '/vao/site-visits' : `/vao/verification/${encodeURIComponent(r.txn_ref)}`)}
              >
                <div>
                  <strong>{r.ulpin ?? r.property_ref}</strong>
                  <small>{r.surveyor_name ?? r.village_name ?? r.txn_ref}{r.agreed_date == null ? '' : ` · ${when(r.agreed_date, r.agreed_time)}`}</small>
                </div>
                <StagePill record={r} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

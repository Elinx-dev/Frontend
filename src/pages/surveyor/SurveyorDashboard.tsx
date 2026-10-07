import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth'
import { Banner } from '../../ui'
import { CalendarIcon, CheckCircleIcon, ClockIcon, CompassIcon, ListIcon, PinIcon, ShieldCheckIcon } from '../../icons'
import { SURVEYOR_PORTAL } from '../vao/portal'
import { useVaoResource } from '../vao/useVao'
import { StagePill } from '../vao/VaoUi'
import { when } from '../vao/vaoShared'
import { surveyorRecordLink } from './surveyorShared'
import type { SurveyorDashboardData } from './surveyorShared'

const LIFECYCLE = [
  { label: 'Book your survey slot', stages: ['AWAITING_PROPOSAL'] },
  { label: 'Slot booked — check in at site', stages: ['SLOT_BOOKED', 'CHECK_IN_DUE'] },
  { label: 'Fill the survey verification form', stages: ['SURVEY_DUE', 'CONFLICT_FLAGGED'] },
  { label: 'Submitted — VAO verification', stages: ['SUBMITTED', 'OBJECTION_PENDING', 'VERIFIED'] },
]

export default function SurveyorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, error, loading } = useVaoResource<SurveyorDashboardData>('/api/surveyor/dashboard')
  const kpis = data?.kpis
  const count = (v: number | undefined) => v ?? (loading ? '…' : 0)

  return (
    <div className="vao-page">
      <section className="vao-welcome">
        <span className="vao-welcome-icon"><CompassIcon /></span>
        <div>
          <p>Surveyor Portal</p>
          <h1>Welcome back, {user?.fullName ?? 'Surveyor'}</h1>
          <small>{user?.designation ?? 'Surveyor'}{user?.department ? ` · ${user.department}` : ''}</small>
        </div>
      </section>
      <Banner kind="error" message={error} />

      <div className="vao-kpis">
        <div className="vao-kpi tone-warning">
          <span>Action required <ClockIcon /></span>
          <strong>{count(kpis?.actionRequired)}</strong>
          <small>Needs your attention</small>
        </div>
        <div className="vao-kpi tone-navy">
          <span>Scheduled <CalendarIcon /></span>
          <strong>{count(kpis?.scheduled)}</strong>
          <small>Survey visits booked</small>
        </div>
        <div className="vao-kpi tone-gold">
          <span>Survey due <PinIcon /></span>
          <strong>{count(kpis?.surveyDue)}</strong>
          <small>Checked in or flagged</small>
        </div>
        <div className="vao-kpi tone-success">
          <span>Submitted to VAO <CheckCircleIcon /></span>
          <strong>{count(kpis == null ? undefined : kpis.submitted + kpis.verified)}</strong>
          <small>{kpis?.verified ?? 0} verified by VAO</small>
        </div>
      </div>

      <div className="vao-dash-grid">
        <section className="vao-card">
          <h2>Quick actions</h2>
          <div className="vao-quick-grid">
            <Link className="vao-quick" to="/surveyor/site-visits">
              <CalendarIcon />
              <div>
                <strong>Site Visit Plan</strong>
                <small>Your planned dates and times, reschedule, check in</small>
              </div>
            </Link>
            <Link className="vao-quick" to="/surveyor/slots">
              <ClockIcon />
              <div>
                <strong>Slot Booking</strong>
                <small>Book your visit — required before the survey form opens</small>
              </div>
            </Link>
            <Link className="vao-quick" to="/surveyor/field-survey">
              <ListIcon />
              <div>
                <strong>Field Survey</strong>
                <small>{kpis?.surveyDue ?? 0} survey form{kpis?.surveyDue === 1 ? '' : 's'} to fill</small>
              </div>
            </Link>
            <Link className="vao-quick" to="/surveyor/verification">
              <ShieldCheckIcon />
              <div>
                <strong>Verification View</strong>
                <small>Your submitted surveys and the VAO&apos;s verification</small>
              </div>
            </Link>
          </div>
          <div className="vao-lifecycle">
            <h3>Survey lifecycle</h3>
            {LIFECYCLE.map((step) => (
              <div key={step.label} className="vao-lifecycle-step">
                <span className="tick">✓</span>
                <span>{step.label}</span>
                <b>{step.stages.reduce((sum, stage) => sum + (data?.byStage[stage] ?? 0), 0)}</b>
              </div>
            ))}
          </div>
          {data != null && data.todaysVisits.length > 0 ? (
            <div className="vao-lifecycle">
              <h3>Today&apos;s visits</h3>
              {data.todaysVisits.map((r) => (
                <div key={r.txn_ref} className="vao-lifecycle-step">
                  <span className="tick"><ClockIcon /></span>
                  <span className="mono">{r.agreed_time} · {r.ulpin ?? r.property_ref}</span>
                  <StagePill record={r} portal={SURVEYOR_PORTAL} />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="vao-card">
          <div className="vao-card-head">
            <h2>Task snapshot</h2>
            <Link to="/surveyor/site-visits">View all →</Link>
          </div>
          {data != null && data.records.length === 0 ? <p className="muted">No surveys are assigned to you yet.</p> : null}
          <div className="vao-snapshot">
            {(data?.records ?? []).slice(0, 8).map((r) => (
              <button key={r.txn_ref} className="vao-snapshot-item" onClick={() => navigate(surveyorRecordLink(r))}>
                <div>
                  <strong>{r.ulpin ?? r.property_ref}</strong>
                  <small>{r.village_name ?? r.village_code ?? r.txn_ref}{r.agreed_date == null ? '' : ` · ${when(r.agreed_date, r.agreed_time)}`}</small>
                </div>
                <StagePill record={r} portal={SURVEYOR_PORTAL} />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

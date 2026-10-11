import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Banner } from '../../ui'
import { CheckCircleIcon, ClockIcon, ShieldCheckIcon } from '../../icons'
import { SURVEYOR_PORTAL } from '../vao/portal'
import { useVaoResource } from '../vao/useVao'
import { StagePill, VaoHeading } from '../vao/VaoUi'
import { formatTimestamp } from '../vao/vaoShared'
import { areaUnitLabel } from './surveyorShared'
import type { SurveyorRecord } from './surveyorShared'

type Tab = 'pending' | 'conflict' | 'verified'

export default function SurveyorVerification() {
  const navigate = useNavigate()
  const { data, error, reload } = useVaoResource<SurveyorRecord[]>('/api/surveyor/records')
  const [tab, setTab] = useState<Tab>('pending')
  const [search, setSearch] = useState('')
  const submitted = (data ?? []).filter((r) => r.submission_id != null)
  const groups: Record<Tab, SurveyorRecord[]> = {
    pending: submitted.filter((r) => r.stage === 'SUBMITTED' || r.stage === 'OBJECTION_PENDING'),
    conflict: submitted.filter((r) => r.stage === 'CONFLICT_FLAGGED'),
    verified: submitted.filter((r) => r.stage === 'VERIFIED'),
  }
  const needle = search.trim().toLowerCase()
  const rows = groups[tab].filter((r) =>
    needle === '' ? true : [r.txn_ref, r.ulpin, r.property_ref, r.village_name, r.survey_no].some((v) => (v ?? '').toLowerCase().includes(needle)),
  )

  return (
    <div className="vao-page">
      <VaoHeading
        title="Verification View"
        subtitle="Surveys you have submitted, what was captured and where the VAO's verification stands."
        actions={<button className="outline" onClick={() => void reload()}>Refresh</button>}
      />
      <Banner kind="error" message={error} />
      <div className="vao-table-card">
        <div className="vao-tabs">
          <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
            <ClockIcon /> With VAO <span className="vao-count">{groups.pending.length}</span>
          </button>
          <button className={tab === 'conflict' ? 'active' : ''} onClick={() => setTab('conflict')}>
            <ShieldCheckIcon /> Conflict flagged <span className="vao-count muted">{groups.conflict.length}</span>
          </button>
          <button className={tab === 'verified' ? 'active' : ''} onClick={() => setTab('verified')}>
            <CheckCircleIcon /> Verified <span className="vao-count muted">{groups.verified.length}</span>
          </button>
          <input className="vao-search" placeholder="Search ID, ULPIN, village…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {rows.length === 0 ? (
          <p className="muted vao-empty">No surveys here.</p>
        ) : (
          <table className="vao-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>ULPIN</th>
                <th>Village</th>
                <th>Measured / Token</th>
                <th>Variance</th>
                <th>Submitted</th>
                <th>VAO</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.txn_ref} className="clickable" onClick={() => navigate(`/surveyor/verification/${encodeURIComponent(r.txn_ref)}`)}>
                  <td className="mono strong">{r.txn_ref}</td>
                  <td className="mono faint">{r.ulpin ?? r.property_ref}</td>
                  <td>{r.village_name ?? r.village_code ?? '—'}</td>
                  <td>{r.measured_extent ?? '—'} {areaUnitLabel(r.measured_unit)} / {r.extent_value ?? '—'} {areaUnitLabel(r.extent_unit)}</td>
                  <td className={r.within_tolerance === false ? 'sv-variance bad' : 'sv-variance'}>{r.variance_pct == null ? '—' : `${Number(r.variance_pct).toFixed(2)}%`}</td>
                  <td>{formatTimestamp(r.submitted_at)}</td>
                  <td>{r.assigned_vao_name ?? '—'}</td>
                  <td><StagePill record={r} portal={SURVEYOR_PORTAL} /></td>
                  <td className="vao-row-action"><button className="vao-btn-review"><ShieldCheckIcon /> View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

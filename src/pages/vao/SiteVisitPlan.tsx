import { useState } from 'react'

import { Banner } from '../../ui'
import { useVaoResource } from './useVao'
import { CheckIns, StagePill, UlpinCell, VaoHeading } from './VaoUi'
import { VisitModal } from './VisitModal'
import { isCompleted, planLabel, when } from './vaoShared'
import type { VaoRecord } from './vaoShared'

function PlanTable({ rows, onManage }: { rows: VaoRecord[]; onManage: (r: VaoRecord) => void }) {
  if (rows.length === 0) return <p className="muted vao-empty">Nothing here.</p>
  return (
    <table className="vao-table">
      <thead>
        <tr>
          <th>ULPIN</th>
          <th>Surveyor</th>
          <th>Purpose</th>
          <th>Status</th>
          <th>Date &amp; time</th>
          <th>Check-ins</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.txn_ref}>
            <td><UlpinCell record={r} /></td>
            <td>{r.surveyor_name ?? '—'}</td>
            <td className="vao-purpose">{r.visit_purpose === 'FIELD_VERIFICATION' ? 'Field verification' : r.status === 'SURVEY_PENDING' || r.visit_purpose === 'JOINT_SURVEY' ? 'Joint survey' : '—'}</td>
            <td>
              <StagePill record={r} />
              {r.action_required ? <small className="vao-action-needed">Action needed</small> : null}
            </td>
            <td>
              {r.agreed_date == null ? '—' : (
                <span className="vao-when"><small>{planLabel(r)}:</small> {when(r.agreed_date, r.agreed_time)}</span>
              )}
              {r.visit_status === 'COUNTER_PROPOSED' && r.visit_date != null ? (
                <small className="vao-when-prev">Originally {when(r.visit_date, r.visit_time)}</small>
              ) : null}
            </td>
            <td>{r.visit_status == null ? <span className="muted">—</span> : <CheckIns record={r} />}</td>
            <td className="vao-row-action">
              <button className={isCompleted(r) || r.stage === 'VISIT_DONE' ? 'vao-btn-light' : 'vao-btn-navy small'} onClick={() => onManage(r)}>
                {isCompleted(r) || r.stage === 'VISIT_DONE' ? 'View' : 'Manage'} ›
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function SiteVisitPlan() {
  const { data, error, reload } = useVaoResource<VaoRecord[]>('/api/vao/records')
  const [selected, setSelected] = useState<VaoRecord | null>(null)
  const [message, setMessage] = useState('')
  const records = data ?? []
  const active = records.filter((r) => !isCompleted(r))
  const completed = records.filter(isCompleted)

  return (
    <div className="vao-page">
      <VaoHeading
        title="Site Visit Plan"
        subtitle="Planned site visits with date and time. Propose or accept a slot with the Surveyor, then check in on the day of the visit."
      />
      <Banner kind="error" message={error} />
      <Banner kind="success" message={message} />
      <h2 className="vao-section-title">Active <span className="vao-count">{active.length}</span></h2>
      <div className="vao-table-card">
        <PlanTable rows={active} onManage={setSelected} />
      </div>
      <h2 className="vao-section-title">Completed <span className="vao-count muted">{completed.length}</span></h2>
      <div className="vao-table-card">
        <PlanTable rows={completed} onManage={setSelected} />
      </div>
      {selected == null ? null : (
        <VisitModal
          record={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setMessage(`Site visit updated for ${selected.ulpin ?? selected.txn_ref}.`)
            void reload()
          }}
        />
      )}
    </div>
  )
}

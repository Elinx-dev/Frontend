import { useState } from 'react'

import { Banner } from '../../ui'
import { useVaoResource } from './useVao'
import { VAO_PORTAL } from './portal'
import type { Portal } from './portal'
import { CheckIns, StagePill, UlpinCell, VaoHeading } from './VaoUi'
import { VisitModal } from './VisitModal'
import { planLabel, purposeLabel, when } from './vaoShared'
import type { VaoRecord } from './vaoShared'

function PlanTable({ rows, onManage, portal }: { rows: VaoRecord[]; onManage: (r: VaoRecord) => void; portal: Portal }) {
  const done = (r: VaoRecord) => portal.isCompleted(r) || !portal.canBook(r)
  if (rows.length === 0) return <p className="muted vao-empty">Nothing here.</p>
  return (
    <table className="vao-table">
      <thead>
        <tr>
          <th>ULPIN</th>
          <th>{portal.other}</th>
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
            <td>{portal.otherName(r) ?? '—'}</td>
            <td className="vao-purpose">{purposeLabel(r.visit_purpose)}</td>
            <td>
              <StagePill record={r} portal={portal} />
              {r.action_required ? <small className="vao-action-needed">Action needed</small> : null}
            </td>
            <td>
              {r.agreed_date == null ? '—' : (
                <span className="vao-when"><small>{planLabel(r)}:</small> {when(r.agreed_date, r.agreed_time)}</span>
              )}
            </td>
            <td>{r.visit_status == null ? <span className="muted">—</span> : <CheckIns record={r} portal={portal} />}</td>
            <td className="vao-row-action">
              <button className={done(r) ? 'vao-btn-light' : 'vao-btn-navy small'} onClick={() => onManage(r)}>
                {done(r) ? 'View' : 'Manage'} ›
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function SiteVisitPlan({ portal = VAO_PORTAL }: { portal?: Portal }) {
  const { data, error, reload } = useVaoResource<VaoRecord[]>(`${portal.api}/records`)
  const [selected, setSelected] = useState<VaoRecord | null>(null)
  const [message, setMessage] = useState('')
  const records = data ?? []
  const active = records.filter((r) => !portal.isCompleted(r))
  const completed = records.filter(portal.isCompleted)

  return (
    <div className="vao-page">
      <VaoHeading
        title="Site Visit Plan"
        subtitle={portal.key === 'VAO'
          ? 'Your planned field-verification visits with date and time. Book or reschedule your own slot, then check in on the day of the visit.'
          : 'Your planned survey visits with date and time. Book or reschedule your own slot, then check in on the day of the visit.'}
      />
      <Banner kind="error" message={error} />
      <Banner kind="success" message={message} />
      <h2 className="vao-section-title">Active <span className="vao-count">{active.length}</span></h2>
      <div className="vao-table-card">
        <PlanTable rows={active} onManage={setSelected} portal={portal} />
      </div>
      <h2 className="vao-section-title">Completed <span className="vao-count muted">{completed.length}</span></h2>
      <div className="vao-table-card">
        <PlanTable rows={completed} onManage={setSelected} portal={portal} />
      </div>
      {selected == null ? null : (
        <VisitModal
          record={selected}
          portal={portal}
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

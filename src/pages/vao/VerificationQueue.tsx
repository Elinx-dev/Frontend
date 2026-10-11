import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Banner } from '../../ui'
import { CheckCircleIcon, ClockIcon, ShieldCheckIcon } from '../../icons'
import { useVaoResource } from './useVao'
import { StagePill, VaoHeading } from './VaoUi'
import { deedLabel, parties, rupees, when } from './vaoShared'
import type { VaoRecord } from './vaoShared'

export default function VerificationQueue() {
  const navigate = useNavigate()
  const { data, error, reload } = useVaoResource<VaoRecord[]>('/api/vao/records')
  const [tab, setTab] = useState<'pending' | 'completed'>('pending')
  const [search, setSearch] = useState('')
  const all = (data ?? []).filter((r) => r.status !== 'SURVEY_PENDING')
  const pending = all.filter((r) => r.status === 'VAO_PENDING' || r.status === 'OBJECTION_PENDING')
  const completed = all.filter((r) => r.stage === 'VERIFIED')
  const needle = search.trim().toLowerCase()
  const rows = (tab === 'pending' ? pending : completed).filter((r) =>
    needle === '' ? true : [r.txn_ref, r.ulpin, r.property_ref, r.first_parties, r.second_parties].some((v) => (v ?? '').toLowerCase().includes(needle)),
  )

  return (
    <div className="vao-page">
      <VaoHeading
        title="Verification Queue"
        subtitle="Proposed mutations awaiting your field verification. Verify & forward unlocks once a site-visit slot is booked."
        actions={<button className="outline" onClick={() => void reload()}>Refresh</button>}
      />
      <Banner kind="error" message={error} />
      <div className="vao-table-card">
        <div className="vao-tabs">
          <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
            <ClockIcon /> Pending Verification <span className="vao-count">{pending.length}</span>
          </button>
          <button className={tab === 'completed' ? 'active' : ''} onClick={() => setTab('completed')}>
            <CheckCircleIcon /> Completed <span className="vao-count muted">{completed.length}</span>
          </button>
          <input className="vao-search" placeholder="Search ID, ULPIN, parties…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {rows.length === 0 ? (
          <p className="muted vao-empty">Nothing to verify here.</p>
        ) : (
          <table className="vao-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>ULPIN</th>
                <th>Type</th>
                <th>Parties</th>
                <th>Amount</th>
                <th>Visit slot</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.txn_ref} className="clickable" onClick={() => navigate(`/vao/verification/${encodeURIComponent(r.txn_ref)}`)}>
                  <td className="mono strong">{r.txn_ref}</td>
                  <td className="mono faint">{r.ulpin ?? r.property_ref}</td>
                  <td><span className="vao-type">{deedLabel(r.deed_type_code)}</span></td>
                  <td className="vao-parties">{parties(r)}</td>
                  <td className="vao-amount">{rupees(r.declared_consideration)}</td>
                  <td>{r.slot_booked ? when(r.agreed_date, r.agreed_time) : <span className="vao-not-booked">Not booked</span>}</td>
                  <td><StagePill record={r} /></td>
                  <td className="vao-row-action">
                    <button className="vao-btn-review">
                      <ShieldCheckIcon /> {tab === 'pending' ? 'Review & Verify' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

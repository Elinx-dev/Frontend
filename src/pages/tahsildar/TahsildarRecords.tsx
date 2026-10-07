import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Banner } from '../../ui'
import { CheckCircleIcon, ClockIcon, ListIcon, ShieldCheckIcon } from '../../icons'
import { useVaoResource } from '../vao/useVao'
import { VaoHeading } from '../vao/VaoUi'
import { deedLabel, formatTimestamp, rupees } from '../vao/vaoShared'
import { recordPath } from './tahsildarShared'
import { TahsildarStagePill } from './TahsildarUi'
import type { TahsildarRecord } from './tahsildarShared'

type Tab = 'pending' | 'completed' | 'progress' | 'approved' | 'all'

const TABS: Record<'approvals' | 'transactions', [Tab, string][]> = {
  approvals: [['pending', 'Pending Approval'], ['completed', 'Completed']],
  transactions: [['all', 'All'], ['progress', 'In Progress'], ['approved', 'Approved']],
}

function matches(tab: Tab, r: TahsildarRecord): boolean {
  switch (tab) {
    case 'pending': return r.action_required
    case 'completed':
    case 'progress': return !r.action_required && r.stage !== 'APPROVED'
    case 'approved': return r.stage === 'APPROVED'
    default: return true
  }
}

/** Approval Queue (records awaiting the Tahsildar) and the searchable Transactions register. */
export default function TahsildarRecords({ view }: { view: 'approvals' | 'transactions' }) {
  const navigate = useNavigate()
  const { data, error, reload } = useVaoResource<TahsildarRecord[]>('/api/tahsildar/records')
  const tabs = TABS[view]
  const [tab, setTab] = useState<Tab>(tabs[0][0])
  const [search, setSearch] = useState('')
  const activeTab = tabs.some(([key]) => key === tab) ? tab : tabs[0][0]
  const all = data ?? []
  const needle = search.trim().toLowerCase()
  const rows = all.filter((r) => matches(activeTab, r)).filter((r) =>
    needle === '' ? true : [r.txn_ref, r.ulpin, r.property_ref, r.sellers, r.buyers, r.village_name, r.survey_no, r.registered_document_no, r.mutation_register_number]
      .some((v) => (v ?? '').toLowerCase().includes(needle)),
  )
  const icon = (key: Tab) => (key === 'pending' ? <ClockIcon /> : key === 'approved' || key === 'completed' ? <CheckCircleIcon /> : key === 'all' ? <ListIcon /> : <ClockIcon />)

  return (
    <div className="vao-page">
      <VaoHeading
        title={view === 'approvals' ? 'Verification Queue' : 'Transactions'}
        subtitle={view === 'approvals'
          ? 'Patta mutation requests verified and forwarded by the VAO. Approval unlocks once every check on the record has passed.'
          : 'Every registered transaction in your taluk, from survey to Revenue approval.'}
        actions={<button className="outline" onClick={() => void reload()}>Refresh</button>}
      />
      <Banner kind="error" message={error} />
      <div className="vao-table-card">
        <div className="vao-tabs">
          {tabs.map(([key, label]) => (
            <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {icon(key)} {label} <span className="vao-count">{all.filter((r) => matches(key, r)).length}</span>
            </button>
          ))}
          <input className="vao-search" placeholder="Search ID, ULPIN, parties, village…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {rows.length === 0 ? (
          <p className="muted vao-empty">{data == null ? 'Loading…' : activeTab === 'pending' ? 'No pending approvals. Deeds appear here once the VAO has verified them and forwarded them for Tahsildar approval.' : 'No transactions here.'}</p>
        ) : (
          <table className="vao-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>ULPIN / Survey no.</th>
                <th>Type</th>
                <th>Parties</th>
                <th>Village</th>
                <th>Amount</th>
                <th>{view === 'approvals' ? 'Submitted' : 'Registered'}</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.txn_ref} className="clickable" onClick={() => navigate(recordPath(r.txn_ref))}>
                  <td className="mono strong">{r.txn_ref}</td>
                  <td className="mono faint">{r.ulpin ?? r.property_ref}<br /><small>S.No. {r.survey_no ?? '—'}{r.subdivision_no == null ? '' : `/${r.subdivision_no}`}</small></td>
                  <td><span className="vao-type">{deedLabel(r.deed_type_code)}</span></td>
                  <td className="vao-parties">{r.sellers ?? '—'} → {r.buyers ?? '—'}</td>
                  <td>{r.village_name ?? r.village_code}</td>
                  <td className="vao-amount">{rupees(r.declared_consideration)}</td>
                  <td>{formatTimestamp(view === 'approvals' ? (r.vao_verified_at ?? r.forwarded_at) : r.registered_at)}</td>
                  <td><TahsildarStagePill record={r} /></td>
                  <td className="vao-row-action">
                    <button className="vao-btn-review">
                      <ShieldCheckIcon /> {r.can_approve ? 'Review & Approve' : 'View'}
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

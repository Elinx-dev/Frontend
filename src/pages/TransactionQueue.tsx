import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, get, qs } from '../api'
import { useAuth } from '../auth'
import { PropertyIcon } from '../icons'
import type { Row } from '../types'
import { Banner, Field, Panel, StatusPill, formatCell } from '../ui'

export default function TransactionQueue() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await get<Row[]>(`/api/transactions${qs({ status })}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  const count = (statuses: string[]) => rows.filter((row) => statuses.includes(String(row.status ?? '').toUpperCase())).length
  const pendingReview = count(['DRAFT', 'CONSENT_PENDING', 'RULE_CHECK_PENDING', 'SURVEY_PENDING', 'VAO_PENDING'])
  const inProgress = count(['FEE_PAYMENT_PENDING', 'OBJECTION_PENDING', 'TAHSILDAR_PENDING'])
  const exceptions = count(['EXCEPTION', 'OBJECTION_PENDING'])
  const registered = count(['REGISTERED', 'REVENUE_APPROVED'])
  const feeTotal = rows.reduce((total, row) => total + Number(row.fee_collected ?? row.fee_amount ?? 0), 0)
  const exceptionRows = rows.filter((row) => ['EXCEPTION', 'OBJECTION_PENDING'].includes(String(row.status ?? '').toUpperCase()))
  const ledgerRows = rows.filter((row) => row.block_number !== undefined || row.tx_hash !== undefined).slice(0, 4)

  return (
    <div className="dashboard-page">
      <section className="vao-welcome ro-welcome">
        <span className="vao-welcome-icon"><PropertyIcon /></span>
        <div>
          <p>Registration Officer Portal</p>
          <h1>Welcome back, {user?.fullName ?? 'Officer'}</h1>
          <small>{user?.designation ?? 'Registration Officer'}{user?.department ? ` · ${user.department}` : ''}</small>
        </div>
        <div className="ro-welcome-actions"><button onClick={() => void load()}>Refresh</button><button className="outline" onClick={() => navigate('/properties/new')}>Mint Property</button><button className="primary" onClick={() => navigate('/transactions/new')}>+ Initiate Transaction</button></div>
      </section>
      <Banner kind="error" message={error} />
      <div className="vao-kpis ro-kpis">
        <div className="vao-kpi tone-warning"><span>Pending Review</span><strong>{pendingReview}</strong><small>Draft to VAO stage</small></div>
        <div className="vao-kpi"><span>In Progress</span><strong>{inProgress}</strong><small>Fees, objections, Tahsildar</small></div>
        <div className="vao-kpi tone-danger"><span>Open Exceptions</span><strong>{exceptions}</strong><small>Need manual review</small></div>
        <div className="vao-kpi tone-success"><span>Registered (MTD)</span><strong>{registered}</strong><small>Registered or approved</small></div>
        <div className="vao-kpi tone-gold"><span>Fee Collected (Session)</span><strong>₹ {feeTotal.toLocaleString('en-IN')}</strong><small>Across listed transactions</small></div>
      </div>
      <Panel title="Queue Snapshot">
        <div className="queue-toolbar"><Field label="Status filter" value={status} onChange={setStatus} options={['DRAFT', 'CONSENT_PENDING', 'RULE_CHECK_PENDING', 'EXCEPTION', 'FEE_PAYMENT_PENDING', 'REGISTERED', 'SURVEY_PENDING', 'VAO_PENDING', 'OBJECTION_PENDING', 'TAHSILDAR_PENDING', 'REVENUE_APPROVED'].map((s) => ({ value: s, label: s }))} /></div>
        {rows.length === 0 ? <p className="muted">No transactions in this queue.</p> : <table className="grid"><thead><tr><th>Txn ID</th><th>Type</th><th>Property Ref / ULPIN</th><th>Parties</th><th>Value</th><th>Stage</th><th>Status</th></tr></thead><tbody>{rows.map((row, index) => { const reference = row.txn_ref ?? row.txnRef ?? row.id; return <tr key={index} className="clickable" onClick={() => navigate(`/transactions/${encodeURIComponent(String(reference))}`)}><td>{formatCell(reference)}</td><td>{formatCell(row.deed_type_code ?? row.deedTypeCode)}</td><td><strong>{formatCell(row.property_ref ?? row.propertyRef)}</strong><small className="cell-subtext">{formatCell(row.ulpin)}</small></td><td>{formatCell(row.parties ?? row.party_summary)}</td><td>{formatCell(row.declared_consideration ?? row.declaredConsideration ?? row.transaction_value)}</td><td>{formatCell(row.current_stage_code ?? row.currentStageCode ?? row.stage)}</td><td><StatusPill status={String(row.status ?? 'UNKNOWN')} /></td></tr> })}</tbody></table>}
      </Panel>
      <div className="dashboard-lower">
        <Panel title="Open Exceptions (Rule Check Engine)">
          {exceptionRows.length === 0 ? <p className="muted">No open exceptions.</p> : <div className="exception-list">{exceptionRows.slice(0, 4).map((row, index) => <div className="exception-item" key={index}><span>{formatCell(row.txn_ref)} · {formatCell(row.exception_type ?? 'Rule check')}</span><StatusPill status={String(row.status)} /></div>)}</div>}
          <p className="advisory">Advisory only in pilot. No engine result blocks registration; findings are recorded against the token.</p>
        </Panel>
        <Panel title="Recent Ledger Anchors">
          {ledgerRows.length === 0 ? <div className="code ledger-empty">Ledger activity will appear after transactions are anchored.</div> : <div className="code">{ledgerRows.map((row, index) => <div key={index}>block {formatCell(row.block_number)} · tx {formatCell(row.tx_hash)} · {formatCell(row.event_type ?? 'TRANSACTION_ANCHORED')}</div>)}</div>}
        </Panel>
      </div>
    </div>
  )
}

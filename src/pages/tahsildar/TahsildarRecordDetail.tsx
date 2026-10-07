import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { post } from '../../api'
import { Banner, formatCell } from '../../ui'
import type { Row } from '../../types'
import { CheckCircleIcon, ClockIcon, PinIcon, UsersIcon } from '../../icons'
import { errorText, useVaoResource } from '../vao/useVao'
import { VaoModal } from '../vao/VaoUi'
import { deedLabel, formatTimestamp, rupees, when } from '../vao/vaoShared'
import { TahsildarStagePill } from './TahsildarUi'
import type { TahsildarDetail } from './tahsildarShared'

type Tab = 'transaction' | 'parties' | 'fees' | 'survey' | 'verification' | 'timeline'

const TABS: [Tab, string][] = [
  ['transaction', 'Deed Details'],
  ['parties', 'Parties'],
  ['fees', 'Fees & Payments'],
  ['survey', 'Survey'],
  ['verification', 'VAO Verification'],
  ['timeline', 'Timeline'],
]

function Fact({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="vao-fact">
      <span>{label}</span>
      <strong className={mono ? 'mono' : undefined}>{formatCell(value === '' ? null : value)}</strong>
    </div>
  )
}

function Rows({ rows, columns, empty }: { rows: Row[]; columns: [string, string, ((v: unknown) => string)?][]; empty: string }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>
  return (
    <table className="vao-table compact">
      <thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={String(row.id ?? i)}>
            {columns.map(([key, , format]) => <td key={key}>{format == null ? formatCell(row[key]) : format(row[key])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const money = (v: unknown) => rupees(v == null ? null : Number(v))

export default function TahsildarRecordDetail() {
  const { txnRef = '' } = useParams()
  const { data, error, reload } = useVaoResource<TahsildarDetail>(`/api/tahsildar/records/${encodeURIComponent(txnRef)}`)
  const [tab, setTab] = useState<Tab>('transaction')
  const [showApprove, setShowApprove] = useState(false)
  const [showPatta, setShowPatta] = useState(false)
  const [registerNumber, setRegisterNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  if (data == null) {
    return <div className="vao-page"><Banner kind="error" message={error} />{error === '' ? <p className="muted">Loading…</p> : null}</div>
  }
  const record = data
  const property = record.property
  const survey = record.survey
  const fee = record.feeCalculation
  const objections = record.mutation?.objections ?? []
  const awaiting = record.status === 'TAHSILDAR_PENDING'
  const failed = record.checklist.filter((c) => !c.passed)

  async function approve() {
    setBusy(true)
    setActionError('')
    try {
      await post(`/api/tahsildar/records/${encodeURIComponent(record.txn_ref)}/approve`, {
        mutationRegisterNumber: registerNumber.trim() === '' ? null : registerNumber.trim(),
        remarks: remarks.trim() === '' ? null : remarks.trim(),
      }, true)
      setMessage('Mutation approved. The Revenue record has been updated and the revenue document generated.')
      setShowApprove(false)
      await reload()
    } catch (e) {
      setActionError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vao-page">
      <div className="vao-detail-card">
        <div className="vao-detail-head">
          <Link className="vao-back" to="/tahsildar/verification">← Back to Queue</Link>
          <strong className="mono">{record.txn_ref}</strong>
          <span className="vao-detail-parties">{record.sellers ?? '—'} → {record.buyers ?? '—'}</span>
          <span className="vao-detail-spacer" />
          <TahsildarStagePill record={record} />
          {awaiting ? (
            <button
              className="vao-btn-green"
              disabled={!record.can_approve}
              title={record.can_approve ? undefined : `Pending: ${failed.map((c) => c.label).join(', ')}`}
              onClick={() => setShowApprove(true)}
            >
              <CheckCircleIcon /> Approve and Generate Revenue Document
            </button>
          ) : null}
          {record.approved_at == null ? null : (
            <button className="vao-btn-light" onClick={() => setShowPatta(true)}>Preview Revenue Document</button>
          )}
        </div>
        <div className="vao-detail-meta">
          <span>Type: <b>{deedLabel(record.deed_type_code)}</b></span>
          <span>Amount: <b>{rupees(record.declared_consideration)}</b></span>
          <span>Guideline value: <b>{rupees(record.guideline_value)}</b></span>
          <span>Document no.: <b className="mono">{record.registered_document_no ?? '—'}</b></span>
          <span>Registered: <b>{formatTimestamp(record.registered_at)}</b></span>
          <span>ULPIN: <b className="mono">{record.ulpin ?? record.property_ref}</b></span>
        </div>
        {record.vao_verified_at == null ? null : (
          <div className="vao-surveyor-strip">
            <span className="label">VAO verification</span>
            <span><UsersIcon /> <b>{record.vao_verified_by_name ?? record.assigned_vao_name ?? 'VAO'}</b></span>
            <span><ClockIcon /> {formatTimestamp(record.vao_verified_at)}</span>
            {record.vao_remarks == null ? null : <span>“{record.vao_remarks}”</span>}
          </div>
        )}
        {record.approved_at == null ? null : (
          <div className="vao-gate booked">
            <CheckCircleIcon />
            <span>
              Approved {formatTimestamp(record.approved_at)} · Mutation register <b className="mono">{record.mutation_register_number ?? '—'}</b>
              {' '}· Revenue record <b className="mono">{record.revenue_record_number ?? '—'}</b>
            </span>
          </div>
        )}
      </div>
      <Banner kind="error" message={actionError} />
      <Banner kind="success" message={message} />

      <div className="vao-detail-grid">
        <section className="vao-card">
          <p className="vao-card-eyebrow">Transaction details</p>
          <div className="vao-tabs inline">
            {TABS.map(([key, label]) => (
              <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === 'transaction' ? (
            <>
              <div className="vao-facts">
                <Fact label="Transaction ID" value={record.txn_ref} mono />
                <Fact label="Deed type" value={deedLabel(record.deed_type_code)} />
                <Fact label="Sub-type" value={record.subtype} />
                <Fact label="SRO" value={record.sro_code} />
                <Fact label="Initiated" value={formatTimestamp(record.initiated_at)} />
                <Fact label="Registration date" value={record.registration?.registration_date} />
                <Fact label="Document no." value={record.registered_document_no} mono />
                <Fact label="Declared consideration" value={rupees(record.declared_consideration)} />
              </div>
              <p className="vao-card-eyebrow">Property</p>
              <div className="vao-facts">
                <Fact label="Property ref" value={record.property_ref} mono />
                <Fact label="ULPIN" value={property.ulpin} mono />
                <Fact label="Survey no. / Sub-division" value={`${formatCell(property.survey_no)} / ${formatCell(property.subdivision_no)}`} />
                <Fact label="Village" value={record.village_name ?? property.village_code} />
                <Fact label="Taluk / District" value={`${formatCell(property.taluk_code)} / ${formatCell(property.district_code)}`} />
                <Fact label="Extent" value={`${formatCell(property.extent_value)} ${formatCell(property.extent_unit)}`} />
                <Fact label="Land type / Classification" value={`${formatCell(property.land_type_code)} / ${formatCell(property.classification_code)}`} />
                <Fact label="Boundaries (N / S / E / W)" value={[property.boundary_north, property.boundary_south, property.boundary_east, property.boundary_west].map(formatCell).join(' / ')} />
              </div>
            </>
          ) : null}

          {tab === 'parties' ? (
            <>
              <Rows
                rows={record.parties}
                empty="No parties recorded."
                columns={[['side', 'Side', (v) => (v === 'SIDE_1' ? 'Transferor' : 'Transferee')], ['role', 'Role'], ['name', 'Name'], ['owner_type_code', 'Owner type'], ['aadhaar_last4', 'Aadhaar', (v) => (v == null ? '—' : `XXXX-${String(v)}`)], ['extent_transferred', 'Extent transferred']]}
              />
              <p className="vao-card-eyebrow">Witnesses</p>
              <Rows rows={record.witnesses} empty="No witnesses recorded." columns={[['name', 'Name'], ['address', 'Address']]} />
              <p className="vao-card-eyebrow">Current registered owners</p>
              <Rows rows={record.registeredOwners} empty="No registered owners on record." columns={[['owner_name', 'Owner'], ['share_pct', 'Share %'], ['effective_from', 'Since']]} />
            </>
          ) : null}

          {tab === 'fees' ? (
            <>
              {fee == null ? <p className="muted">No fee calculation recorded.</p> : (
                <div className="vao-facts">
                  <Fact label="Valuation basis" value={fee.valuation_basis_used} />
                  <Fact label="Valuation amount" value={money(fee.valuation_amount)} />
                  <Fact label="Stamp duty" value={money(fee.stamp_duty)} />
                  <Fact label="Registration fee" value={money(fee.registration_fee)} />
                  <Fact label="Survey fee" value={money(fee.survey_fee)} />
                  <Fact label="Other charges" value={money(fee.other_charges)} />
                  <Fact label="Total payable" value={money(fee.total_payable)} />
                  <Fact label="Calculated" value={formatTimestamp(fee.calculated_at)} />
                </div>
              )}
              <p className="vao-card-eyebrow">Payments</p>
              <Rows
                rows={record.payments}
                empty="No payments recorded."
                columns={[['mode', 'Mode'], ['reference_no', 'Reference'], ['amount', 'Amount', money], ['paid_at', 'Paid', formatTimestamp], ['status', 'Status']]}
              />
            </>
          ) : null}

          {tab === 'survey' ? (
            !record.survey_required && survey == null ? <p className="muted">No survey was required for this transaction.</p> : survey == null ? <p className="muted">The Surveyor has not submitted a survey yet.</p> : (
              <div className="vao-facts">
                <Fact label="Surveyor" value={survey.submitted_by_name ?? record.assigned_surveyor_name} />
                <Fact label="Submitted" value={formatTimestamp(survey.submitted_at)} />
                <Fact label="Recorded extent" value={`${formatCell(survey.authoritative_recorded_extent)} ${formatCell(property.extent_unit)}`} />
                <Fact label="Measured extent" value={`${formatCell(survey.measured_extent)} ${formatCell(survey.extent_unit)}`} />
                <Fact label="Variance" value={`${formatCell(survey.variance_pct)}% (tolerance ${formatCell(survey.tolerance_pct)}%)`} />
                <Fact label="Within tolerance" value={survey.within_tolerance === true ? 'Yes' : 'No — conflict flagged'} />
                <Fact label="GPS centroid" value={survey.centroid_lat == null ? null : `${formatCell(survey.centroid_lat)}, ${formatCell(survey.centroid_lon)}`} mono />
                <Fact label="Boundaries (N / S / E / W)" value={[survey.boundary_north, survey.boundary_south, survey.boundary_east, survey.boundary_west].map(formatCell).join(' / ')} />
                <Fact label="Site notes" value={survey.site_notes} />
              </div>
            )
          ) : null}

          {tab === 'verification' ? (
            <>
              <div className="vao-facts">
                <Fact label="Assigned VAO" value={record.assigned_vao_name} />
                <Fact label="Mutation type" value={record.mutation_type} />
                <Fact label="Mutation status" value={record.mutation_status} />
                <Fact label="Verified & forwarded" value={formatTimestamp(record.vao_verified_at)} />
                <Fact label="VAO remarks" value={record.vao_remarks} />
                <Fact label="Tahsildar remarks" value={record.tahsildar_remarks} />
              </div>
              <p className="vao-card-eyebrow">Site visits</p>
              <Rows
                rows={record.siteVisits}
                empty="No site visit recorded."
                columns={[
                  ['visit_purpose', 'Purpose', (v) => (v === 'FIELD_VERIFICATION' ? 'Field verification' : 'Joint survey')],
                  ['agreed_date', 'Slot', (v) => String(v ?? '—')],
                  ['agreed_time', 'Time', (v) => String(v ?? '—')],
                  ['status', 'Status'],
                  ['vao_checkin_at', 'VAO check-in', formatTimestamp],
                  ['surveyor_checkin_at', 'Surveyor check-in', formatTimestamp],
                ]}
              />
              <p className="vao-card-eyebrow">Objections</p>
              <Rows rows={objections} empty="No objections recorded." columns={[['objector_name', 'Objector'], ['objection_reason', 'Reason'], ['objection_date', 'Date'], ['disposal_decision', 'Decision']]} />
            </>
          ) : null}

          {tab === 'timeline' ? (
            record.timeline.length === 0 ? <p className="muted">No audit events yet.</p> : (
              <div className="vao-lifecycle">
                {record.timeline.map((t, i) => (
                  <div key={i} className="vao-lifecycle-step">
                    <span className="tick">✓</span>
                    <span>
                      <b>{String(t.action).replace(/_/g, ' ').toLowerCase()}</b>
                      {t.to_status == null ? '' : ` → ${String(t.to_status)}`}
                      <br />
                      <small className="muted">{formatTimestamp(t.occurred_at)} · {formatCell(t.actor_username)} ({formatCell(t.actor_role)}){t.detail == null ? '' : ` · “${String(t.detail)}”`}</small>
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </section>

        <section className="vao-card">
          <p className="vao-card-eyebrow">Approval checklist</p>
          <ul className="vao-checklist">
            {record.checklist.map((c) => (
              <li key={c.code} className={c.passed ? 'ok' : ''}>{c.label}{c.detail == null ? '' : ` · ${c.code === 'SURVEY_WITHIN_TOLERANCE' && c.detail !== 'Survey not required' ? `${c.detail}%` : c.code === 'VAO_VERIFIED' ? formatTimestamp(c.detail) : c.detail}`}</li>
            ))}
          </ul>
          {awaiting && !record.can_approve ? <p className="muted small">Approval unlocks once every check above has passed.</p> : null}
          <p className="muted small">Your approval is the authoritative Revenue decision: it records the mutation, updates the Revenue record and issues the patta.</p>
          <div className="vao-facts">
            <Fact label="Village" value={record.village_name} />
            <Fact label="Survey no." value={`${formatCell(record.survey_no)}${record.subdivision_no == null ? '' : `/${record.subdivision_no}`}`} />
          </div>
          {record.siteVisits.length === 0 ? null : (
            <p className="muted small"><PinIcon /> Last visit: {when((record.siteVisits[record.siteVisits.length - 1].agreed_date as string | null) ?? null, (record.siteVisits[record.siteVisits.length - 1].agreed_time as string | null) ?? null)}</p>
          )}
        </section>
      </div>

      {showApprove ? (
        <VaoModal title="Approve and Generate Revenue Document" onClose={() => setShowApprove(false)}>
          <ul className="vao-checklist">
            {record.checklist.map((c) => <li key={c.code} className={c.passed ? 'ok' : ''}>{c.label}</li>)}
          </ul>
          <label className="vao-textarea">
            <span>Mutation register number (optional)</span>
            <input value={registerNumber} onChange={(e) => setRegisterNumber(e.target.value)} placeholder="Leave blank to use the number issued by Revenue" />
          </label>
          <label className="vao-textarea">
            <span>Remarks</span>
            <textarea rows={4} value={remarks} placeholder="Approval remarks…" onChange={(e) => setRemarks(e.target.value)} />
          </label>
          <button className="vao-btn-green wide" disabled={busy} onClick={() => void approve()}>
            <CheckCircleIcon /> {busy ? 'Approving…' : 'Approve & Update Revenue Record'}
          </button>
        </VaoModal>
      ) : null}

      {showPatta ? (
        <VaoModal title="Revenue Document Preview" onClose={() => setShowPatta(false)}>
          <div className="vao-facts">
            <Fact label="Revenue record (Patta) no." value={record.revenue_record_number} mono />
            <Fact label="Mutation register no." value={record.mutation_register_number} mono />
            <Fact label="Approved" value={formatTimestamp(record.approved_at)} />
            <Fact label="Approved by" value={record.timeline.find((t) => t.action === 'MUTATION_APPROVED')?.actor_username} />
            <Fact label="Village / Taluk" value={`${formatCell(record.village_name)} / ${formatCell(property.taluk_code)}`} />
            <Fact label="Survey no." value={`${formatCell(property.survey_no)}${property.subdivision_no == null ? '' : `/${formatCell(property.subdivision_no)}`}`} />
            <Fact label="Extent" value={`${formatCell(property.extent_value)} ${formatCell(property.extent_unit)}`} />
            <Fact label="Classification" value={property.classification_code} />
            <Fact label="New owner(s)" value={record.buyers} />
            <Fact label="Previous owner(s)" value={record.sellers} />
            <Fact label="Deed" value={`${deedLabel(record.deed_type_code)} · ${formatCell(record.registered_document_no)}`} />
            <Fact label="Tahsildar remarks" value={record.tahsildar_remarks} />
          </div>
          <button className="vao-btn-light wide" onClick={() => window.print()}>Download / Print</button>
        </VaoModal>
      ) : null}
    </div>
  )
}

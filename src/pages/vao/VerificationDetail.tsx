import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { post } from '../../api'
import { Banner, formatCell } from '../../ui'
import type { Row } from '../../types'
import { CalendarIcon, CheckCircleIcon, ClockIcon, PinIcon, UsersIcon } from '../../icons'
import { errorText, useVaoResource } from './useVao'
import { StagePill, VaoModal } from './VaoUi'
import { VisitModal } from './VisitModal'
import { deedLabel, formatTimestamp, parties, purposeLabel, rupees, when } from './vaoShared'
import type { VaoDetail } from './vaoShared'

type Tab = 'identity' | 'parties' | 'visits' | 'mutation'

function Fact({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="vao-fact">
      <span>{label}</span>
      <strong className={mono ? 'mono' : undefined}>{formatCell(value === '' ? null : value)}</strong>
    </div>
  )
}

export default function VerificationDetail() {
  const { txnRef = '' } = useParams()
  const { data, error, reload } = useVaoResource<VaoDetail>(`/api/vao/records/${encodeURIComponent(txnRef)}`)
  const [tab, setTab] = useState<Tab>('identity')
  const [showVisit, setShowVisit] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [showObjection, setShowObjection] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [objector, setObjector] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  if (data == null) {
    return <div className="vao-page"><Banner kind="error" message={error} />{error === '' ? <p className="muted">Loading…</p> : null}</div>
  }
  const record = data
  const property = record.property
  const survey = record.survey
  const mutationId = record.mutation_id
  const awaitingVerification = record.status === 'VAO_PENDING'

  async function run(action: () => Promise<unknown>, success: string, close: () => void) {
    setBusy(true)
    setActionError('')
    try {
      await action()
      setMessage(success)
      close()
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
          <Link className="vao-back" to="/vao/verification">← Back to Queue</Link>
          <strong className="mono">{record.txn_ref}</strong>
          <span className="vao-detail-parties">{parties(record)}</span>
          <span className="vao-detail-spacer" />
          <StagePill record={record} />
          {awaitingVerification ? (
            <>
              <button
                className="vao-btn-green"
                disabled={!record.can_verify}
                title={record.can_verify ? undefined : 'Book a site-visit slot first'}
                onClick={() => setShowVerify(true)}
              >
                <CheckCircleIcon /> Verify &amp; Forward to Tahsildar
              </button>
              <button className="vao-btn-danger" onClick={() => setShowObjection(true)}>
                Raise Objection
              </button>
            </>
          ) : null}
        </div>
        <div className="vao-detail-meta">
          <span>Type: <b>{deedLabel(record.deed_type_code)}</b></span>
          <span>Amount: <b>{rupees(record.declared_consideration)}</b></span>
          <span>ULPIN: <b className="mono">{record.ulpin ?? '—'}</b></span>
          <span>Registered: <b>{formatTimestamp(record.registered_at)}</b></span>
          <span>Property: <b className="mono">{record.property_ref}</b></span>
        </div>
        {survey == null ? null : (
          <div className="vao-surveyor-strip">
            <span className="label">Surveyor data</span>
            <span><UsersIcon /> <b>{formatCell(survey.submitted_by_name)} (Surveyor)</b></span>
            <span><ClockIcon /> {formatTimestamp(survey.submitted_at)}</span>
            {survey.centroid_lat == null ? null : <span><PinIcon /> {formatCell(survey.centroid_lat)}, {formatCell(survey.centroid_lon)}</span>}
            <span><b>Measured:</b> {formatCell(survey.measured_extent)} {formatCell(survey.extent_unit)}</span>
            <span><b>Variance:</b> {formatCell(survey.variance_pct)}%</span>
          </div>
        )}
        <div className={record.slot_booked ? 'vao-gate booked' : 'vao-gate'}>
          <CalendarIcon />
          {record.slot_booked ? (
            <span>
              Field-verification slot booked for <b>{when(record.agreed_date, record.agreed_time)}</b>
              {record.vao_checkin_at == null ? ' · check-in pending' : ` · checked in ${formatTimestamp(record.vao_checkin_at)}`}
            </span>
          ) : record.status === 'SURVEY_PENDING' ? (
            <span><b>Survey in progress.</b> You can book your field-verification slot once the Surveyor submits the survey.</span>
          ) : (
            <span><b>No visit slot booked.</b> Verification stays locked until you book your field-verification slot for this record.</span>
          )}
          {awaitingVerification || record.status === 'OBJECTION_PENDING' ? (
            <button className="vao-btn-light" onClick={() => setShowVisit(true)}>
              {record.slot_booked ? 'Manage visit' : 'Book slot'}
            </button>
          ) : null}
        </div>
      </div>
      <Banner kind="error" message={actionError} />
      <Banner kind="success" message={message} />

      <div className="vao-detail-grid">
        <section className="vao-card">
          <p className="vao-card-eyebrow">Property details</p>
          <div className="vao-tabs inline">
            {([['identity', 'Identity & Location'], ['parties', 'Parties'], ['visits', 'Site Visits'], ['mutation', 'Mutation & Objections']] as [Tab, string][]).map(([key, label]) => (
              <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
          {tab === 'identity' ? (
            <div className="vao-facts">
              <Fact label="Survey no." value={property.survey_no} />
              <Fact label="Sub-division" value={property.subdivision_no} />
              <Fact label="ULPIN" value={property.ulpin} mono />
              <Fact label="Land type" value={property.land_type_code} />
              <Fact label="District" value={property.district_code} />
              <Fact label="Taluk" value={property.taluk_code} />
              <Fact label="Village" value={record.village_name ?? property.village_code} />
              <Fact label="Extent" value={`${formatCell(property.extent_value)} ${formatCell(property.extent_unit)}`} />
              <Fact label="GPS centroid" value={survey?.centroid_lat == null ? null : `${formatCell(survey.centroid_lat)}, ${formatCell(survey.centroid_lon)}`} mono />
              <Fact label="Boundaries (N / S / E / W)" value={survey == null ? null : [survey.boundary_north, survey.boundary_south, survey.boundary_east, survey.boundary_west].map(formatCell).join(' / ')} />
            </div>
          ) : null}
          {tab === 'parties' ? (
            <table className="vao-table compact">
              <thead><tr><th>Side</th><th>Role</th><th>Name</th><th>Share transferred</th></tr></thead>
              <tbody>
                {record.parties.map((p: Row) => (
                  <tr key={String(p.id)}>
                    <td>{p.side === 'SIDE_1' ? 'Transferor' : 'Transferee'}</td>
                    <td>{formatCell(p.role)}</td>
                    <td>{formatCell(p.name)}</td>
                    <td>{p.share_transferred_pct == null ? '—' : `${formatCell(p.share_transferred_pct)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {tab === 'visits' ? (
            record.visits.length === 0 ? <p className="muted">No site visit planned yet.</p> : (
              <table className="vao-table compact">
                <thead><tr><th>Purpose</th><th>Booked by</th><th>Planned slot</th><th>Status</th><th>Check-in</th></tr></thead>
                <tbody>
                  {record.visits.map((v: Row) => (
                    <tr key={String(v.id)}>
                      <td>{purposeLabel(v.visit_purpose)}</td>
                      <td>{formatCell(v.proposed_by_name)} ({formatCell(v.proposed_by_role)})</td>
                      <td className="mono">{when((v.agreed_date as string | null) ?? null, (v.agreed_time as string | null) ?? null)}</td>
                      <td>{formatCell(v.status)}</td>
                      <td>{formatTimestamp(v.visit_purpose === 'FIELD_VERIFICATION' ? v.vao_checkin_at : v.surveyor_checkin_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}
          {tab === 'mutation' ? (
            <>
              <div className="vao-facts">
                <Fact label="Mutation type" value={record.mutation?.mutation_type} />
                <Fact label="Mutation status" value={record.mutation_status} />
                <Fact label="VAO verified at" value={formatTimestamp(record.mutation?.vao_verified_at)} />
                <Fact label="VAO remarks" value={record.mutation?.vao_remarks} />
              </div>
              {(record.objections ?? []).length === 0 ? <p className="muted">No objections recorded.</p> : (
                <table className="vao-table compact">
                  <thead><tr><th>Objector</th><th>Reason</th><th>Date</th><th>Decision</th></tr></thead>
                  <tbody>
                    {(record.objections ?? []).map((o: Row) => (
                      <tr key={String(o.id)}>
                        <td>{formatCell(o.objector_name)}</td>
                        <td>{formatCell(o.objection_reason)}</td>
                        <td>{formatCell(o.objection_date)}</td>
                        <td>{formatCell(o.disposal_decision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {record.status === 'OBJECTION_PENDING' && mutationId != null ? (
                <button
                  className="vao-btn-light"
                  disabled={busy}
                  onClick={() => void run(
                    () => post(`/api/revenue/mutations/${mutationId}/objections/dispose`, { disposalDecision: 'DISPOSED', remarks: 'Objection disposed after field verification' }),
                    'Objection disposed; the record is back in your verification queue.',
                    () => undefined,
                  )}
                >
                  Dispose objection
                </button>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="vao-card">
          <p className="vao-card-eyebrow">Verification checklist</p>
          <ul className="vao-checklist">
            <li className={record.slot_booked ? 'ok' : ''}>Field-verification slot booked {record.slot_booked ? `· ${when(record.agreed_date, record.agreed_time)}` : ''}</li>
            <li className={record.vao_checkin_at == null ? '' : 'ok'}>Checked in at site {record.vao_checkin_at == null ? '(recommended)' : `· ${formatTimestamp(record.vao_checkin_at)}`}</li>
            <li className={survey == null && record.survey_required ? '' : 'ok'}>{record.survey_required ? 'Survey submitted by Surveyor' : 'No survey required for this transfer'}</li>
            <li className={record.stage === 'VERIFIED' ? 'ok' : ''}>Verified &amp; forwarded to Tahsildar</li>
          </ul>
          <p className="muted small">Only the Tahsildar approves the mutation and issues the patta. Your verification forwards the record to them.</p>
        </section>
      </div>

      {showVisit ? <VisitModal record={record} onClose={() => setShowVisit(false)} onChanged={() => void reload()} /> : null}

      {showVerify && mutationId != null ? (
        <VaoModal title="Verify & Forward" onClose={() => setShowVerify(false)}>
          <div className="vao-visit-box agreed">
            <h3><CheckCircleIcon /> Visit slot booked</h3>
            <div className="vao-visit-when">{when(record.agreed_date, record.agreed_time)}</div>
          </div>
          <label className="vao-textarea">
            <span>Verification remarks</span>
            <textarea rows={4} value={remarks} placeholder="Field verification findings…" onChange={(e) => setRemarks(e.target.value)} />
          </label>
          <button
            className="vao-btn-green wide"
            disabled={busy}
            onClick={() => void run(
              () => post(`/api/revenue/mutations/${mutationId}/verify`, { remarks }, true),
              'Verified and forwarded to the Tahsildar.',
              () => setShowVerify(false),
            )}
          >
            <CheckCircleIcon /> Verify &amp; Forward to Tahsildar
          </button>
        </VaoModal>
      ) : null}

      {showObjection && mutationId != null ? (
        <VaoModal title="Raise Objection" onClose={() => setShowObjection(false)}>
          <label className="vao-textarea">
            <span>Objector name</span>
            <input value={objector} onChange={(e) => setObjector(e.target.value)} placeholder="Name of the objector (or VAO)" />
          </label>
          <label className="vao-textarea">
            <span>Reason <b className="req">*</b></span>
            <textarea rows={4} value={reason} placeholder="State the reason for the objection…" onChange={(e) => setReason(e.target.value)} />
          </label>
          <button
            className="vao-btn-danger wide"
            disabled={busy || reason.trim() === ''}
            onClick={() => void run(
              () => post(`/api/revenue/mutations/${mutationId}/objections`, { objectorName: objector || null, objectionReason: reason }),
              'Objection recorded.',
              () => setShowObjection(false),
            )}
          >
            Record objection
          </button>
        </VaoModal>
      ) : null}
    </div>
  )
}

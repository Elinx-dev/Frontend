import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Banner, formatCell } from '../../ui'
import type { Row } from '../../types'
import { CalendarIcon, ClockIcon, ListIcon, PinIcon, UsersIcon } from '../../icons'
import { SURVEYOR_PORTAL } from '../vao/portal'
import { useVaoResource } from '../vao/useVao'
import { StagePill } from '../vao/VaoUi'
import { VisitModal } from '../vao/VisitModal'
import { deedLabel, formatTimestamp, parties, when } from '../vao/vaoShared'
import { SketchDiagram } from './SketchDiagram'
import { SurveyForm } from './SurveyForm'
import { SurveyMap } from './SurveyMap'
import { areaUnitLabel, num, toSquareMetres } from './surveyorShared'
import type { MeasurementRow, SurveyorDetail } from './surveyorShared'

type Tab = 'gps' | 'measurements' | 'boundaries' | 'polygon' | 'notes' | 'visits' | 'history'

function Fact({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="vao-fact">
      <span>{label}</span>
      <strong className={mono ? 'mono' : undefined}>{formatCell(value == null || value === '' ? null : value)}</strong>
    </div>
  )
}

export default function SurveyorRecordView() {
  const { txnRef = '' } = useParams()
  const { data, error, reload } = useVaoResource<SurveyorDetail>(`/api/surveyor/records/${encodeURIComponent(txnRef)}`)
  const [tab, setTab] = useState<Tab>('gps')
  const [preview, setPreview] = useState<'map' | 'sketch'>('map')
  const [showForm, setShowForm] = useState(false)
  const [showVisit, setShowVisit] = useState(false)
  const [message, setMessage] = useState('')
  const polygon = useMemo(
    () => (data?.boundary_points ?? []).map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)),
    [data],
  )

  if (data == null) {
    return <div className="vao-page"><Banner kind="error" message={error} />{error === '' ? <p className="muted">Loading…</p> : null}</div>
  }
  const record = data
  const survey: Row | undefined = record.submissions[0]
  const segments: MeasurementRow[] = (record.segments ?? []).map((s) => ({ from: String(s.from_point ?? ''), to: String(s.to_point ?? ''), value: String(s.length_value ?? ''), unit: String(s.length_unit ?? 'FT') }))
  const measured = num(survey?.measured_extent)
  const tabs: [Tab, string][] = [['gps', 'GPS & Area'], ['measurements', 'Measurements'], ['boundaries', 'Boundaries'], ['polygon', 'Polygon'], ['notes', 'Notes'], ['visits', 'Site Visits'], ['history', 'History']]
  const vaoVerifiedAt = record.mutation?.vao_verified_at

  return (
    <div className="vao-page">
      <Link className="vao-back" to="/surveyor/verification">← Verification View</Link>
      <div className="vao-detail-card">
        <div className="vao-detail-head">
          <div>
            <h1 className="mono">{record.ulpin ?? record.property_ref}</h1>
            <p className="mono">{record.txn_ref} · {parties(record)}</p>
          </div>
          <StagePill record={record} portal={SURVEYOR_PORTAL} />
          {record.can_survey ? (
            <button className="vao-btn-navy" onClick={() => setShowForm(true)}><ListIcon /> {survey == null ? 'Open Survey Form' : 'Resurvey'}</button>
          ) : null}
          {record.status === 'SURVEY_PENDING' && !record.slot_booked ? (
            <button className="vao-btn-light" onClick={() => setShowVisit(true)}><CalendarIcon /> Book slot</button>
          ) : null}
        </div>
        <div className="vao-detail-meta">
          <span>Type: <b>{deedLabel(record.deed_type_code)}</b></span>
          <span>Survey no.: <b>{record.survey_no ?? '—'}{record.subdivision_no ? ` / ${record.subdivision_no}` : ''}</b></span>
          <span>Village: <b>{record.village_name ?? record.village_code ?? '—'}</b></span>
          <span>Token extent: <b>{record.extent_value ?? '—'} {areaUnitLabel(record.extent_unit)}</b></span>
          <span>VAO: <b>{record.assigned_vao_name ?? '—'}</b></span>
        </div>
        {survey == null ? null : (
          <div className="vao-surveyor-strip">
            <span className="label">Submitted survey</span>
            <span><UsersIcon /> <b>{formatCell(survey.submitted_by_name)}</b></span>
            <span><ClockIcon /> {formatTimestamp(survey.submitted_at)}</span>
            {survey.centroid_lat == null ? null : <span><PinIcon /> {formatCell(survey.centroid_lat)}, {formatCell(survey.centroid_lon)}</span>}
            <span><b>Measured:</b> {formatCell(survey.measured_extent)} {areaUnitLabel(String(survey.extent_unit ?? ''))}</span>
            <span className={survey.within_tolerance === false ? 'sv-variance bad' : 'sv-variance'}><b>Variance:</b> {Number(survey.variance_pct).toFixed(2)}%</span>
          </div>
        )}
      </div>
      <Banner kind="success" message={message} />

      <div className="vao-detail-grid">
        <section className="vao-card">
          <p className="vao-card-eyebrow">Captured survey data</p>
          <div className="vao-tabs inline">
            {tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
          </div>
          {survey == null && tab !== 'visits' ? <p className="muted">No survey has been submitted yet.</p> : null}
          {survey != null && tab === 'gps' ? (
            <div className="vao-facts">
              <Fact label="Latitude" value={survey.centroid_lat} mono />
              <Fact label="Longitude" value={survey.centroid_lon} mono />
              <Fact label="Measured extent" value={`${formatCell(survey.measured_extent)} ${areaUnitLabel(String(survey.extent_unit ?? ''))}`} />
              <Fact label={`In token unit (${areaUnitLabel(record.extent_unit)})`} value={survey.measured_extent_in_record_unit} />
              <Fact label="Token record extent" value={survey.authoritative_recorded_extent} />
              <Fact label="Variance / tolerance" value={`${Number(survey.variance_pct).toFixed(2)}% / ${formatCell(survey.tolerance_pct)}%`} />
              <Fact label="Routing" value={survey.routed_to === 'VAO_VERIFICATION' ? 'Forwarded to VAO' : 'Conflict — survey correction review'} />
              <Fact label="Survey date" value={survey.survey_date} />
            </div>
          ) : null}
          {survey != null && tab === 'measurements' ? (
            segments.length === 0 ? <p className="muted">No measurements recorded.</p> : (
              <table className="vao-table compact">
                <thead><tr><th>#</th><th>From</th><th>To</th><th>Length</th></tr></thead>
                <tbody>{segments.map((s, i) => <tr key={i}><td>{i + 1}</td><td>{s.from}</td><td>{s.to}</td><td>{s.value} {s.unit.toLowerCase()}</td></tr>)}</tbody>
              </table>
            )
          ) : null}
          {survey != null && tab === 'boundaries' ? (
            <div className="vao-facts">
              <Fact label="North" value={survey.boundary_north} />
              <Fact label="South" value={survey.boundary_south} />
              <Fact label="East" value={survey.boundary_east} />
              <Fact label="West" value={survey.boundary_west} />
            </div>
          ) : null}
          {survey != null && tab === 'polygon' ? (
            (record.boundary_points ?? []).length === 0 ? <p className="muted">No polygon vertices recorded.</p> : (
              <table className="vao-table compact">
                <thead><tr><th>Point</th><th>Latitude</th><th>Longitude</th></tr></thead>
                <tbody>{(record.boundary_points ?? []).map((p) => <tr key={String(p.seq)}><td>{formatCell(p.point_label)}</td><td className="mono">{formatCell(p.latitude)}</td><td className="mono">{formatCell(p.longitude)}</td></tr>)}</tbody>
              </table>
            )
          ) : null}
          {survey != null && tab === 'notes' ? <p className="sv-notes">{formatCell(survey.site_notes)}</p> : null}
          {tab === 'visits' ? (
            record.visits.length === 0 ? <p className="muted">No site visit planned yet.</p> : (
              <table className="vao-table compact">
                <thead><tr><th>Proposed by</th><th>Planned slot</th><th>Status</th><th>Your check-in</th><th>VAO check-in</th></tr></thead>
                <tbody>
                  {record.visits.map((v) => (
                    <tr key={String(v.id)}>
                      <td>{formatCell(v.proposed_by_name)} ({formatCell(v.proposed_by_role)})</td>
                      <td className="mono">{when((v.agreed_date as string | null) ?? null, (v.agreed_time as string | null) ?? null)}</td>
                      <td>{formatCell(v.status)}</td>
                      <td>{formatTimestamp(v.surveyor_checkin_at)}</td>
                      <td>{formatTimestamp(v.vao_checkin_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}
          {survey != null && tab === 'history' ? (
            <table className="vao-table compact">
              <thead><tr><th>Submitted</th><th>Measured</th><th>Variance</th><th>Routing</th></tr></thead>
              <tbody>
                {record.submissions.map((s) => (
                  <tr key={String(s.id)}>
                    <td>{formatTimestamp(s.submitted_at)}</td>
                    <td>{formatCell(s.measured_extent)} {areaUnitLabel(String(s.extent_unit ?? ''))}</td>
                    <td>{Number(s.variance_pct).toFixed(2)}%</td>
                    <td>{s.routed_to === 'VAO_VERIFICATION' ? 'Forwarded to VAO' : 'Conflict flagged'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="vao-card">
          <div className="vao-tabs inline">
            <button className={preview === 'map' ? 'active' : ''} onClick={() => setPreview('map')}>Map View</button>
            <button className={preview === 'sketch' ? 'active' : ''} onClick={() => setPreview('sketch')}>Sketch Diagram</button>
          </div>
          {preview === 'map'
            ? <SurveyMap lat={num(survey?.centroid_lat)} lon={num(survey?.centroid_lon)} areaM2={measured == null ? null : toSquareMetres(measured, String(survey?.extent_unit ?? ''))} polygon={polygon} />
            : <SketchDiagram rows={segments} />}
          <p className="vao-card-eyebrow sv-gap">VAO verification</p>
          <ul className="vao-checklist">
            <li className={record.slot_booked || survey != null ? 'ok' : ''}>Joint visit slot booked {record.agreed_date == null ? '' : `· ${when(record.agreed_date, record.agreed_time)}`}</li>
            <li className={record.surveyor_checkin_at == null ? '' : 'ok'}>Checked in at site {record.surveyor_checkin_at == null ? '' : `· ${formatTimestamp(record.surveyor_checkin_at)}`}</li>
            <li className={survey == null ? '' : survey.within_tolerance === false ? 'warn' : 'ok'}>{survey == null ? 'Survey form submitted' : survey.within_tolerance === false ? 'Survey submitted with conflict flag' : 'Survey submitted and forwarded to VAO'}</li>
            <li className={vaoVerifiedAt == null ? '' : 'ok'}>VAO verified {vaoVerifiedAt == null ? '' : `· ${formatTimestamp(vaoVerifiedAt)}`}</li>
            <li className={record.status === 'REVENUE_APPROVED' ? 'ok' : ''}>Tahsildar approval</li>
          </ul>
        </section>
      </div>

      {showForm ? (
        <SurveyForm record={record} onClose={() => setShowForm(false)} onSubmitted={(text) => { setMessage(text); void reload() }} />
      ) : null}
      {showVisit ? <VisitModal record={record} portal={SURVEYOR_PORTAL} onClose={() => setShowVisit(false)} onChanged={() => void reload()} /> : null}
    </div>
  )
}

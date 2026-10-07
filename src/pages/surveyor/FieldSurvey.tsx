import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Banner } from '../../ui'
import { ListIcon } from '../../icons'
import { SURVEYOR_PORTAL } from '../vao/portal'
import { useVaoResource } from '../vao/useVao'
import { StagePill, UlpinCell, VaoHeading } from '../vao/VaoUi'
import { when } from '../vao/vaoShared'
import { SurveyForm } from './SurveyForm'
import { areaUnitLabel } from './surveyorShared'
import type { SurveyorRecord } from './surveyorShared'

export default function FieldSurvey() {
  const [params, setParams] = useSearchParams()
  const { data, error, reload } = useVaoResource<SurveyorRecord[]>('/api/surveyor/records')
  const [message, setMessage] = useState('')
  const rows = (data ?? []).filter((r) => r.status === 'SURVEY_PENDING')
  const open = rows.find((r) => r.txn_ref === params.get('txn') && r.can_survey) ?? null

  useEffect(() => {
    if (message !== '') window.scrollTo({ top: 0 })
  }, [message])

  return (
    <div className="vao-page">
      <VaoHeading
        title="Field Survey"
        subtitle="Capture GPS, extent, measurements, boundaries and the parcel polygon. The form opens once your survey visit slot is booked."
        actions={<button className="outline" onClick={() => void reload()}>Refresh</button>}
      />
      <Banner kind="error" message={error} />
      <Banner kind="success" message={message} />
      <div className="vao-table-card">
        {rows.length === 0 ? (
          <p className="muted vao-empty">No surveys are pending.</p>
        ) : (
          <table className="vao-table">
            <thead>
              <tr>
                <th>ULPIN</th>
                <th>Survey no.</th>
                <th>Village</th>
                <th>Token extent</th>
                <th>Visit slot</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.txn_ref}>
                  <td><UlpinCell record={r} /></td>
                  <td>{r.survey_no ?? '—'}{r.subdivision_no ? ` / ${r.subdivision_no}` : ''}</td>
                  <td>{r.village_name ?? r.village_code ?? '—'}</td>
                  <td>{r.extent_value ?? '—'} {areaUnitLabel(r.extent_unit)}</td>
                  <td>{r.slot_booked ? when(r.agreed_date, r.agreed_time) : <span className="vao-not-booked">Not booked</span>}</td>
                  <td><StagePill record={r} portal={SURVEYOR_PORTAL} /></td>
                  <td className="vao-row-action">
                    {r.can_survey ? (
                      <button className="vao-btn-navy small" onClick={() => setParams({ txn: r.txn_ref })}>
                        <ListIcon /> {r.submission_id == null ? 'Open Survey Form' : 'Resurvey'}
                      </button>
                    ) : (
                      <Link className="vao-btn-light" to={`/surveyor/slots?txn=${encodeURIComponent(r.txn_ref)}`} title="Book your visit slot before surveying">
                        Book slot first
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open == null ? null : (
        <SurveyForm
          record={open}
          onClose={() => setParams({})}
          onSubmitted={(text) => {
            setMessage(text)
            void reload()
          }}
        />
      )}
    </div>
  )
}

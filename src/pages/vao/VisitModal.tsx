import { useState } from 'react'

import { post } from '../../api'
import { Banner } from '../../ui'
import { CalendarIcon, CheckCircleIcon, PinIcon } from '../../icons'
import { errorText } from './useVao'
import { VAO_PORTAL } from './portal'
import type { Portal } from './portal'
import { VaoModal } from './VaoUi'
import { todayIso, when } from './vaoShared'
import type { VaoRecord } from './vaoShared'

/**
 * Manages the officer's own site visit for one record: book or reschedule a date and time,
 * or check in on the booked day (server-stamped). No other officer has to accept it.
 */
export function VisitModal({ record, onClose, onChanged, portal = VAO_PORTAL }: { record: VaoRecord; onClose: () => void; onChanged: () => void; portal?: Portal }) {
  const [visitDate, setVisitDate] = useState(record.agreed_date ?? todayIso())
  const [visitTime, setVisitTime] = useState(record.agreed_time ?? '10:30')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const base = `${portal.api}/records/${encodeURIComponent(record.txn_ref)}`
  const selfCheckin = portal.selfCheckin(record)
  const purpose = portal.key === 'VAO' ? 'Field-Verification' : 'Survey'

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      onChanged()
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const book = () => run(() => post(`${base}/book`, { visitDate, visitTime }))

  return (
    <VaoModal title="Schedule Site Visit" onClose={onClose}>
      <p className="vao-modal-meta">
        {record.ulpin ?? record.property_ref} · <span>{record.txn_ref}</span>
      </p>
      <Banner kind="error" message={error} />

      {record.slot_booked ? (
        <div className="vao-visit-box agreed">
          <h3>
            <CheckCircleIcon />
            Booked {purpose} Slot
          </h3>
          <div className="vao-visit-when">{when(record.agreed_date, record.agreed_time)}</div>
          <div className="vao-checkin-grid">
            <div className={selfCheckin == null ? '' : 'done'}>
              {selfCheckin == null ? 'Your check-in pending' : `You checked in · ${new Date(selfCheckin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
          </div>
          {selfCheckin == null && record.visit_id != null ? (
            <button
              className="vao-btn-navy"
              disabled={busy || (record.agreed_date ?? '') > todayIso()}
              onClick={() => void run(() => post(`${base}/visits/${record.visit_id}/check-in`, {}))}
            >
              <PinIcon />
              Check In at Site
            </button>
          ) : null}
          {(record.agreed_date ?? '') > todayIso() && selfCheckin == null ? (
            <small className="vao-hint">Check-in opens on {record.agreed_date}. The time is taken from the server clock.</small>
          ) : null}
        </div>
      ) : null}

      {portal.key === 'VAO' && record.status === 'SURVEY_PENDING' ? (
        <div className="vao-visit-box waiting">
          <h3>Survey in progress</h3>
          <small className="vao-hint">You can book your field-verification slot once the Surveyor submits the survey.</small>
        </div>
      ) : null}

      {portal.canBook(record) ? (
        <div className="vao-visit-box propose">
          <h3>
            <CalendarIcon />
            {record.slot_booked ? 'Reschedule slot' : `Book ${purpose} Slot`}
          </h3>
          <div className="vao-form-row">
            <label>
              <span>Visit Date</span>
              <input type="date" min={todayIso()} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </label>
            <label>
              <span>Time</span>
              <input type="time" min="08:00" max="18:00" step={900} value={visitTime} onChange={(e) => setVisitTime(e.target.value)} />
            </label>
          </div>
          <button className="vao-btn-navy" disabled={busy || visitDate === '' || visitTime === ''} onClick={() => void book()}>
            <CalendarIcon />
            {record.slot_booked ? 'Reschedule' : 'Book slot'}
          </button>
        </div>
      ) : null}
    </VaoModal>
  )
}

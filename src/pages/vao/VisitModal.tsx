import { useState } from 'react'

import { post } from '../../api'
import { Banner } from '../../ui'
import { CalendarIcon, CheckCircleIcon, ClockIcon, PinIcon } from '../../icons'
import { errorText } from './useVao'
import { VAO_PORTAL } from './portal'
import type { Portal } from './portal'
import { VaoModal } from './VaoUi'
import { todayIso, when } from './vaoShared'
import type { VaoRecord } from './vaoShared'

/**
 * Manages one record's site visit: propose or counter a date and time, accept the
 * other party's proposal, or check in on the booked day (server-stamped).
 */
export function VisitModal({ record, onClose, onChanged, portal = VAO_PORTAL }: { record: VaoRecord; onClose: () => void; onChanged: () => void; portal?: Portal }) {
  const [visitDate, setVisitDate] = useState(record.agreed_date ?? todayIso())
  const [visitTime, setVisitTime] = useState(record.agreed_time ?? '10:30')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const base = `${portal.api}/records/${encodeURIComponent(record.txn_ref)}`
  const selfCheckin = portal.selfCheckin(record)
  const otherName = portal.otherName(record)

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
  const otherTurn = portal.otherTurn.includes(record.stage)
  const fieldVisit = portal.key === 'VAO' && record.status !== 'SURVEY_PENDING'
  const proposeTitle = fieldVisit ? 'Book Field-Verification Slot' : record.visit_status == null ? 'Propose Visit Date & Time' : 'Counter-Propose Date & Time'

  return (
    <VaoModal title="Schedule Site Visit" onClose={onClose}>
      <p className="vao-modal-meta">
        {record.ulpin ?? record.property_ref} · <span>{record.txn_ref}</span>
        {otherName == null ? null : (
          <>
            <br />
            {portal.other}: <strong>{otherName}</strong>
          </>
        )}
      </p>
      <Banner kind="error" message={error} />

      {record.slot_booked ? (
        <div className="vao-visit-box agreed">
          <h3>
            <CheckCircleIcon />
            Agreed Visit Slot
          </h3>
          <div className="vao-visit-when">{when(record.agreed_date, record.agreed_time)}</div>
          <div className="vao-checkin-grid">
            <div className={selfCheckin == null ? '' : 'done'}>
              {selfCheckin == null ? 'Your check-in pending' : `You checked in · ${new Date(selfCheckin).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
            {fieldVisit && record.visit_purpose === 'FIELD_VERIFICATION' ? (
              <div className="muted-cell">Field verification (VAO only)</div>
            ) : (
              <div className={portal.otherCheckin(record) == null ? '' : 'done'}>
                {portal.otherCheckin(record) == null ? `${portal.other} check-in pending` : `${portal.other} checked in`}
              </div>
            )}
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

      {otherTurn && record.visit_id != null ? (
        <div className="vao-visit-box proposal">
          <h3>
            <ClockIcon />
            {record.stage.endsWith('_COUNTERED') ? `${portal.other} counter-proposal` : `${portal.other} proposed`}
          </h3>
          <div className="vao-visit-when">{when(record.agreed_date, record.agreed_time)}</div>
          <button
            className="vao-btn-green"
            disabled={busy}
            onClick={() => void run(() => post(`${base}/visits/${record.visit_id}/accept`, {}))}
          >
            <CheckCircleIcon />
            Accept and book this slot
          </button>
        </div>
      ) : null}

      {portal.ownWaiting.includes(record.stage) ? (
        <div className="vao-visit-box waiting">
          <h3>
            <ClockIcon />
            Waiting for the {portal.other}
          </h3>
          <div className="vao-visit-when">{when(record.agreed_date, record.agreed_time)}</div>
          <small className="vao-hint">You can revise your proposal below.</small>
        </div>
      ) : null}

      {!record.slot_booked || (fieldVisit && record.visit_purpose === 'FIELD_VERIFICATION' && record.vao_checkin_at == null) ? (
        <div className="vao-visit-box propose">
          <h3>
            <CalendarIcon />
            {record.slot_booked ? 'Reschedule slot' : otherTurn ? 'Or counter-propose' : proposeTitle}
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
            {fieldVisit ? 'Book slot' : otherTurn ? 'Send counter-proposal' : `Propose to ${portal.other}`}
          </button>
        </div>
      ) : null}
    </VaoModal>
  )
}

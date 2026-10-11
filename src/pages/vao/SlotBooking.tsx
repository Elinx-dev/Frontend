import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { post } from '../../api'
import { Banner } from '../../ui'
import { CalendarIcon, CheckCircleIcon, ClockIcon } from '../../icons'
import { errorText, useVaoResource } from './useVao'
import { VAO_PORTAL } from './portal'
import type { Portal } from './portal'
import { StagePill, VaoHeading } from './VaoUi'
import { todayIso, when } from './vaoShared'
import type { Slot, VaoRecord } from './vaoShared'

export default function SlotBooking({ portal = VAO_PORTAL }: { portal?: Portal }) {
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(todayIso())
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const records = useVaoResource<VaoRecord[]>(`${portal.api}/records`)
  const slots = useVaoResource<{ date: string; slots: Slot[] }>(date === '' ? null : `${portal.api}/slots?date=${date}`)

  const bookable = useMemo(() => (records.data ?? []).filter(portal.canBook), [records.data, portal])
  const txnRef = params.get('txn') ?? bookable[0]?.txn_ref ?? ''
  const record = (records.data ?? []).find((r) => r.txn_ref === txnRef) ?? null

  async function book() {
    if (record == null || time === '') return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await post<VaoRecord>(`${portal.api}/records/${encodeURIComponent(record.txn_ref)}/book`, { visitDate: date, visitTime: time })
      setMessage(
        `Slot booked for ${result.ulpin ?? result.txn_ref} on ${when(result.agreed_date, result.agreed_time)}. ${portal.key === 'VAO' ? 'You can now verify and forward the record.' : 'You can now open the survey form.'}`,
      )
      setTime('')
      await Promise.all([records.reload(), slots.reload()])
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vao-page">
      <VaoHeading
        title="Slot Booking"
        subtitle={portal.key === 'VAO'
          ? 'Book your field-verification slot for a record the Surveyor has submitted. A record can only be verified after your slot is booked.'
          : 'Book your survey slot for an assigned record. The survey form unlocks once your slot is booked.'}
      />
      <Banner kind="error" message={error || records.error || slots.error} />
      <Banner kind="success" message={message} />

      <div className="vao-booking">
        <section className="vao-card">
          <h2>1. Select record</h2>
          {bookable.length === 0 && !records.loading ? <p className="muted">{portal.key === 'VAO' ? 'No record is waiting for a field-verification slot. Records appear here once the Surveyor submits the survey.' : 'Every assigned record already has a booked slot.'}</p> : null}
          <div className="vao-record-pick">
            {bookable.map((r) => (
              <button
                key={r.txn_ref}
                className={r.txn_ref === txnRef ? 'vao-pick active' : 'vao-pick'}
                onClick={() => setParams({ txn: r.txn_ref })}
              >
                <div>
                  <strong>{r.ulpin ?? r.property_ref}</strong>
                  <small>{r.txn_ref} · {r.village_name ?? r.village_code ?? '—'}</small>
                </div>
                <StagePill record={r} portal={portal} />
              </button>
            ))}
          </div>
        </section>

        <section className="vao-card">
          <h2>2. Choose date &amp; time slot</h2>
          {record == null ? (
            <p className="muted">Select a record to book.</p>
          ) : (
            <>
              <div className="vao-booking-summary">
                <div><span>ULPIN</span><strong className="mono">{record.ulpin ?? record.property_ref}</strong></div>
                <div><span>Survey no.</span><strong>{record.survey_no ?? '—'}{record.subdivision_no ? ` / ${record.subdivision_no}` : ''}</strong></div>
                <div><span>Purpose</span><strong>{portal.key === 'VAO' ? 'Field verification' : 'Field survey'}</strong></div>
                <div><span>Current plan</span><strong>{when(record.agreed_date, record.agreed_time)}</strong></div>
              </div>
              <label className="vao-date-field">
                <span><CalendarIcon /> Visit date</span>
                <input type="date" min={todayIso()} value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} />
              </label>
              <div className="vao-slot-grid" role="radiogroup" aria-label="Time slots">
                {(slots.data?.slots ?? []).map((s) => (
                  <button
                    key={s.time}
                    role="radio"
                    aria-checked={time === s.time}
                    disabled={!s.available}
                    className={time === s.time ? 'vao-slot selected' : s.available ? 'vao-slot' : 'vao-slot taken'}
                    onClick={() => setTime(s.time)}
                    title={s.txn_ref == null ? undefined : `Booked for ${s.ulpin ?? s.txn_ref}`}
                  >
                    <ClockIcon />
                    <strong>{s.time}</strong>
                    <small>{s.available ? 'Available' : s.past ? 'Past' : `Booked · ${s.ulpin ?? s.txn_ref}`}</small>
                  </button>
                ))}
              </div>
              <button className="vao-btn-navy wide" disabled={busy || time === ''} onClick={() => void book()}>
                <CheckCircleIcon />
                {record.slot_booked ? 'Reschedule slot' : 'Book slot'}
                {time === '' ? '' : ` · ${date} ${time}`}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

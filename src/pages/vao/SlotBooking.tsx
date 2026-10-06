import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { post } from '../../api'
import { Banner } from '../../ui'
import { CalendarIcon, CheckCircleIcon, ClockIcon } from '../../icons'
import { errorText, useVaoResource } from './useVao'
import { StagePill, VaoHeading } from './VaoUi'
import { canBook, todayIso, when } from './vaoShared'
import type { Slot, VaoRecord } from './vaoShared'

export default function SlotBooking() {
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(todayIso())
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const records = useVaoResource<VaoRecord[]>('/api/vao/records')
  const slots = useVaoResource<{ date: string; slots: Slot[] }>(date === '' ? null : `/api/vao/slots?date=${date}`)

  const bookable = useMemo(() => (records.data ?? []).filter(canBook), [records.data])
  const txnRef = params.get('txn') ?? bookable[0]?.txn_ref ?? ''
  const record = (records.data ?? []).find((r) => r.txn_ref === txnRef) ?? null

  async function book() {
    if (record == null || time === '') return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await post<VaoRecord>(`/api/vao/records/${encodeURIComponent(record.txn_ref)}/book`, { visitDate: date, visitTime: time })
      setMessage(
        result.slot_booked
          ? `Slot booked for ${result.ulpin ?? result.txn_ref} on ${when(result.agreed_date, result.agreed_time)}. You can now verify once the record is with you.`
          : `Proposed ${when(result.agreed_date, result.agreed_time)} to the Surveyor for ${result.ulpin ?? result.txn_ref}. The slot is booked once they accept.`,
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
        subtitle="Book a site-visit slot for an assigned record. A record can only be verified after its visit slot is booked."
      />
      <Banner kind="error" message={error || records.error || slots.error} />
      <Banner kind="success" message={message} />

      <div className="vao-booking">
        <section className="vao-card">
          <h2>1. Select record</h2>
          {bookable.length === 0 && !records.loading ? <p className="muted">Every assigned record already has a booked slot.</p> : null}
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
                <StagePill record={r} />
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
                <div><span>Surveyor</span><strong>{record.surveyor_name ?? 'Field verification (VAO only)'}</strong></div>
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
                {record.status === 'SURVEY_PENDING' ? 'Book slot with Surveyor' : 'Book slot'}
                {time === '' ? '' : ` · ${date} ${time}`}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

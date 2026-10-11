import { useEffect, useState } from 'react'

import { ApiError, get } from '../api'
import type { Row } from '../types'
import { formatCell } from '../ui'
import { formatTimestamp } from './vao/vaoShared'

const words = (value: unknown) => String(value).replace(/_/g, ' ').toLowerCase()

/** Audit events for one transaction or property, scoped by the backend to what the signed-in user may see. */
export default function RecordTimeline({ path }: { path: string }) {
  const [events, setEvents] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    get<Row[]>(path)
      .then((rows) => { if (!cancelled) setEvents(rows) })
      .catch((e) => { if (!cancelled) { setError(e instanceof ApiError ? e.message : String(e)); setEvents([]) } })
    return () => { cancelled = true }
  }, [path])

  if (events === null) return <p className="muted">Loading timeline…</p>
  if (error.length > 0) return <div className="banner banner-error">{error}</div>
  if (events.length === 0) return <p className="muted">No audit events yet.</p>
  return (
    <div className="vao-lifecycle record-timeline">
      {events.map((t) => (
        <div key={String(t.id)} className={`vao-lifecycle-step${t.outcome === 'FAILURE' ? ' failed' : ''}`}>
          <span className="tick">{t.outcome === 'FAILURE' ? '!' : '✓'}</span>
          <span>
            <b>{words(t.action)}</b>
            {t.from_status == null && t.to_status == null ? '' : ` · ${formatCell(t.from_status)} → ${formatCell(t.to_status)}`}
            {t.decision == null ? '' : ` · ${words(t.decision)}`}
            <br />
            <small className="muted">
              {formatTimestamp(t.occurred_at)} · {formatCell(t.actor_username)}{t.actor_role == null ? '' : ` (${String(t.actor_role)})`}
              {t.detail == null ? '' : ` · “${String(t.detail)}”`}
            </small>
          </span>
        </div>
      ))}
    </div>
  )
}

import { useState } from 'react'
import { ApiError, post } from '../api'
import { useAuth } from '../auth'

const FIELDS: [string, string][] = [
  ['aadhaarNumber', 'Aadhaar'], ['pan', 'PAN'], ['mobile', 'Mobile'], ['address', 'Address'],
  ['representativeAadhaar', 'Representative Aadhaar'], ['representativePan', 'Representative PAN'],
  ['representativeMobile', 'Representative mobile'],
]

/** Audited "Show" of full personal details, for the Registrar and the Tahsildar only. */
export function RevealPii({ source, id }: { source: 'PROPERTY_OWNER' | 'TRANSACTION_PARTY'; id: unknown }) {
  const { user } = useAuth()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const allowed = user?.roles.some((role) => role === 'REGISTRATION_OFFICER' || role === 'TAHSILDAR') === true
  if (!allowed || id === null || id === undefined) return null

  const show = async () => {
    setBusy(true)
    setError('')
    try {
      setData(await post<Record<string, unknown>>('/api/pii/reveal', { source, id: Number(id) }))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return <div className="pii-reveal">
    {data === null
      ? <button type="button" className="secondary" disabled={busy} onClick={() => void show()}>{busy ? 'Loading…' : 'Show full details'}</button>
      : <button type="button" className="secondary" onClick={() => setData(null)}>Hide</button>}
    <span className="pii-reveal-note">Viewing is recorded in the audit log.</span>
    {error ? <span className="field-error">{error}</span> : null}
    {data !== null ? <dl className="pii-reveal-values">
      {FIELDS.filter(([key]) => data[key] !== null && data[key] !== undefined && data[key] !== '').map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd>{String(data[key])}{key === 'aadhaarNumber' && data.aadhaarStoredAsHashOnly === true ? ' (only the last 4 digits are stored)' : ''}</dd>
      </div>)}
    </dl> : null}
  </div>
}

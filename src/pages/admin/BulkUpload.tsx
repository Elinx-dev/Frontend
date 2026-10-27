import { useState } from 'react'

import { post, storedToken } from '../../api'
import { Banner, Panel, StatusPill } from '../../ui'
import { AdminHeader, StatCard } from './shared'
import { errorText } from './adminConfig'

interface SheetError { row: number; column: string; message: string }
interface CaseResult {
  row: number
  caseId: string
  propertyRef?: string
  txnRef?: string
  outcome: 'COMPLETED' | 'RULE_CHECK_FAILED' | 'FAILED'
  status?: string
  stoppedAt?: string
  documentNo?: string
  message?: string
  ruleChecks?: string[]
}
interface BulkResponse {
  valid: boolean
  rowCount: number
  errors: SheetError[]
  completed?: number
  failed?: number
  results?: CaseResult[]
}

export default function BulkUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<'' | 'validate' | 'run' | 'template'>('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<BulkResponse | null>(null)
  const [ran, setRan] = useState(false)

  const downloadTemplate = async () => {
    setBusy('template')
    setError('')
    try {
      const token = storedToken()
      const res = await fetch('/api/admin/bulk-upload/template', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new Error(`Template download failed (${res.status})`)
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = 'SLATE_bulk_upload_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy('')
    }
  }

  const send = async (mode: 'validate' | 'run') => {
    if (file === null) return
    setBusy(mode)
    setError('')
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      setResult(await post<BulkResponse>(`/api/admin/bulk-upload/${mode}`, form, mode === 'run'))
      setRan(mode === 'run')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="page">
      <AdminHeader title="Bulk upload" subtitle="Mint properties and run their transactions from an Excel sheet. Only rule checks are applied: no Aadhaar OTP, no VAO, Surveyor or Tahsildar step." />
      {error !== '' ? <Banner kind="error" message={error} /> : null}
      <Panel title="1. Download the template">
        <p className="muted">The template has a Cases sheet (one row per case, with 3 sample cases) and an Instructions sheet describing every column. Supported deeds: Sale, Gift, Settlement and Release of the whole property.</p>
        <button className="outline" onClick={() => void downloadTemplate()} disabled={busy !== ''}>{busy === 'template' ? 'Downloading…' : 'Download Excel template'}</button>
      </Panel>
      <Panel title="2. Upload the filled sheet">
        <p className="muted">The whole sheet is checked first; if any row has an error nothing is created. Then each case is minted, transacted and rule-checked. Passing cases are registered and revenue-approved; failing cases stop at the rule check.</p>
        <div className="toolbar">
          <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
          <button className="outline" onClick={() => void send('validate')} disabled={file === null || busy !== ''}>{busy === 'validate' ? 'Checking…' : 'Validate only'}</button>
          <button onClick={() => void send('run')} disabled={file === null || busy !== ''}>{busy === 'run' ? 'Processing cases…' : 'Validate and run'}</button>
        </div>
      </Panel>
      {result !== null ? (
        <Panel title={result.valid ? (ran ? 'Results' : 'Sheet is valid') : 'Sheet has errors — nothing was created'}>
          <div className="stat-row">
            <StatCard label="Cases in sheet" value={result.rowCount} />
            <StatCard label="Sheet errors" value={result.errors.length} tone={result.errors.length > 0 ? 'danger' : 'success'} />
            {ran && result.valid ? <StatCard label="Completed" value={result.completed ?? 0} tone="success" /> : null}
            {ran && result.valid ? <StatCard label="Stopped" value={result.failed ?? 0} tone={(result.failed ?? 0) > 0 ? 'warning' : 'navy'} /> : null}
          </div>
          {result.errors.length > 0 ? (
            <table className="grid">
              <thead><tr><th>Row</th><th>Column</th><th>Problem</th></tr></thead>
              <tbody>{result.errors.map((e, i) => <tr key={i}><td className="num">{e.row}</td><td><code>{e.column}</code></td><td>{e.message}</td></tr>)}</tbody>
            </table>
          ) : null}
          {result.valid && !ran ? <Banner kind="success" message={`All ${result.rowCount} case(s) passed the sheet checks. Click “Validate and run” to process them.`} /> : null}
          {(result.results ?? []).length > 0 ? (
            <table className="grid">
              <thead><tr><th>Row</th><th>Case</th><th>Property</th><th>Transaction</th><th>Outcome</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>
                {(result.results ?? []).map((r) => (
                  <tr key={r.row}>
                    <td className="num">{r.row}</td>
                    <td>{r.caseId}</td>
                    <td>{r.propertyRef ? <a href={`/properties/${r.propertyRef}`}>{r.propertyRef}</a> : '—'}</td>
                    <td>{r.txnRef ? <a href={`/transactions/${r.txnRef}`}>{r.txnRef}</a> : '—'}</td>
                    <td><StatusPill status={r.outcome} /></td>
                    <td>{r.status ?? '—'}{r.documentNo ? <span className="cell-subtext">Doc {r.documentNo}</span> : null}</td>
                    <td>
                      {r.message ?? (r.outcome === 'COMPLETED' ? 'Registered and revenue approved' : '')}
                      {r.stoppedAt && r.outcome !== 'COMPLETED' ? <span className="cell-subtext">Stopped at {r.stoppedAt}</span> : null}
                      {(r.ruleChecks ?? []).map((c) => <span className="cell-subtext" key={c}>{c}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Panel>
      ) : null}
    </div>
  )
}

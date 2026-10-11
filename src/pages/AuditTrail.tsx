import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FormEvent } from 'react'

import { ApiError, get, qs } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner, Field, Panel, StatusPill, formatCell } from '../ui'

interface AuditPage {
  rows: Row[]
  page: number
  size: number
  total: number
  totalPages: number
  scope: string
}

interface AuditFilters {
  search: string
  category: string
  outcome: string
  from: string
  to: string
}

const emptyFilters: AuditFilters = { search: '', category: '', outcome: '', from: '', to: '' }
const categories = ['TRANSACTION', 'PROPERTY', 'APPROVAL', 'CONFIGURATION']

export default function AuditTrail() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const centralAdmin = user?.roles.includes('CENTRAL_ADMIN') ?? false
  const stateCode = searchParams.get('stateCode') ?? user?.stateCode ?? ''
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(emptyFilters)
  const [page, setPage] = useState(0)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [result, setResult] = useState<AuditPage>({ rows: [], page: 0, size: 25, total: 0, totalPages: 0, scope: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [states, setStates] = useState<{ code: string; name: string }[]>([])

  useEffect(() => {
    if (!centralAdmin) return
    get<{ code: string; name: string }[]>('/api/admin/states')
      .then(setStates)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : String(e)))
  }, [centralAdmin])

  useEffect(() => {
    let active = true
    const query = qs({ ...appliedFilters, page, size: 25, sort: 'occurred_at', direction: 'desc' })
    get<AuditPage>(`/api/audit/logs${query}`)
      .then((data) => {
        if (active) {
          setResult(data)
          setError('')
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof ApiError ? e.message : String(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [appliedFilters, page, refreshVersion, stateCode])

  const updateFilter = (key: keyof AuditFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setPage(0)
    setAppliedFilters({ ...filters, search: filters.search.trim() })
  }

  const clearFilters = () => {
    setLoading(true)
    setFilters({ ...emptyFilters })
    setAppliedFilters({ ...emptyFilters })
    setPage(0)
  }

  const changePage = (nextPage: number) => {
    setLoading(true)
    setPage(nextPage)
  }

  return (
    <div className="audit-page">
      <div className="page-heading">
        <div><p className="eyebrow">Registration workspace</p><h1>Audit Trail</h1></div>
        <div className="dashboard-actions">
          {result.scope ? <span className="muted">Scope: {result.scope === 'RELATED' ? 'Related transactions' : result.scope}</span> : null}
          {centralAdmin ? (
            <label className="ad-filter">
              <span>State</span>
              <select value={stateCode} onChange={(event) => {
                setPage(0)
                setLoading(true)
                setSearchParams((current) => {
                  const next = new URLSearchParams(current)
                  next.set('stateCode', event.target.value)
                  return next
                })
              }}>
                {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
              </select>
            </label>
          ) : null}
          <button onClick={() => { setLoading(true); setRefreshVersion((version) => version + 1) }} disabled={loading}>Refresh</button>
        </div>
      </div>
      <Banner kind="error" message={error} />
      <Panel title="Filter activity">
        <form onSubmit={applyFilters}>
          <div className="audit-filters">
            <Field label="Search" value={filters.search} onChange={(value) => updateFilter('search', value)} placeholder="Actor, action, reference..." />
            <Field label="Category" value={filters.category} onChange={(value) => updateFilter('category', value)} options={categories.map((value) => ({ value, label: value }))} />
            <Field label="Outcome" value={filters.outcome} onChange={(value) => updateFilter('outcome', value)} options={['SUCCESS', 'FAILURE'].map((value) => ({ value, label: value }))} />
            <Field label="From" type="date" value={filters.from} onChange={(value) => updateFilter('from', value)} />
            <Field label="To" type="date" value={filters.to} onChange={(value) => updateFilter('to', value)} />
          </div>
          <div className="actions">
            <button className="primary" type="submit" disabled={loading}>Apply filters</button>
            <button type="button" onClick={clearFilters} disabled={loading}>Clear</button>
          </div>
        </form>
      </Panel>
      <Panel title="Recorded activity" actions={<span className="muted">{result.total.toLocaleString()} entries</span>}>
        {loading ? <p className="muted">Loading audit events...</p> : result.rows.length === 0 ? <p className="muted">No audit events match these filters.</p> : (
          <div className="audit-table-wrap">
            <table className="grid audit-grid">
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reference</th><th>Outcome</th><th>Details</th></tr></thead>
              <tbody>{result.rows.map((row, index) => {
                const reference = row.transaction_ref ?? row.property_ref
                return <tr key={String(row.id ?? `${row.occurred_at}-${index}`)}>
                  <td>{formatTimestamp(row.occurred_at)}</td>
                  <td><strong>{formatCell(row.actor_username)}</strong><small className="cell-subtext">{formatCell(row.actor_role)}</small></td>
                  <td><strong>{formatCell(row.action)}</strong><small className="cell-subtext">{formatCell(row.category)}</small></td>
                  <td>{formatCell(row.entity_type)}<small className="cell-subtext">{formatCell(row.entity_id)}</small></td>
                  <td>{formatCell(reference)}</td>
                  <td><StatusPill status={String(row.outcome ?? 'UNKNOWN')} /></td>
                  <td>
                    {formatCell(row.detail)}
                    {row.before_json != null || row.after_json != null ? (
                      <details className="audit-change-details">
                        <summary>View changes</summary>
                        {row.before_json != null ? <><strong>Before</strong><pre>{formatAuditJson(row.before_json)}</pre></> : null}
                        {row.after_json != null ? <><strong>After</strong><pre>{formatAuditJson(row.after_json)}</pre></> : null}
                      </details>
                    ) : null}
                  </td>
                </tr>
              })}</tbody>
            </table>
          </div>
        )}
        <div className="audit-pagination">
          <span className="muted">Page {result.totalPages === 0 ? 0 : page + 1} of {result.totalPages}</span>
          <div className="dashboard-actions">
            <button onClick={() => changePage(Math.max(0, page - 1))} disabled={loading || page === 0}>Previous</button>
            <button onClick={() => changePage(page + 1)} disabled={loading || page + 1 >= result.totalPages}>Next</button>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== 'string') return formatCell(value)
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString()
}

function formatAuditJson(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  return JSON.stringify(value, null, 2) ?? String(value)
}
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ApiError, get, getText, qs } from '../api'
import type { AuditFacets, AuditPage, AuditSummary } from '../audit'
import { recordUiEvent } from '../audit'
import type { Row } from '../types'
import { Banner, DataTable, Field, Panel, formatCell } from '../ui'

interface Filters extends Record<string, string> {
  from: string
  to: string
  actorUsername: string
  action: string
  category: string
  entityType: string
  entityId: string
  transactionRef: string
  propertyRef: string
  outcome: string
  decision: string
  search: string
  sort: string
  direction: string
}

const EMPTY: Filters = {
  from: '',
  to: '',
  actorUsername: '',
  action: '',
  category: '',
  entityType: '',
  entityId: '',
  transactionRef: '',
  propertyRef: '',
  outcome: '',
  decision: '',
  search: '',
  sort: 'occurred_at',
  direction: 'desc',
}

const SORTS = ['occurred_at', 'action', 'actor_username', 'entity_type', 'category', 'outcome']

export default function AuditTrail() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY,
    transactionRef: params.get('transactionRef') ?? '',
    propertyRef: params.get('propertyRef') ?? '',
    entityId: params.get('entityId') ?? '',
    actorUsername: params.get('actorUsername') ?? '',
  })
  const [applied, setApplied] = useState<Filters>(filters)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState('50')
  const [result, setResult] = useState<AuditPage | null>(null)
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [facets, setFacets] = useState<AuditFacets | null>(null)
  const [selected, setSelected] = useState<Row | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const query = useMemo(() => qs({ ...applied, page, size }), [applied, page, size])

  const load = useCallback(async () => {
    setError('')
    try {
      const [logs, totals] = await Promise.all([
        get<AuditPage>(`/api/audit/logs${query}`),
        get<AuditSummary>(`/api/audit/summary${query}`),
      ])
      setResult(logs)
      setSummary(totals)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    get<AuditFacets>('/api/audit/filters')
      .then(setFacets)
      .catch(() => setFacets(null))
    recordUiEvent({ action: 'AUDIT_TRAIL_VIEWED', page: '/audit' })
  }, [])

  const set = (key: keyof Filters) => (value: string) => setFilters((current) => ({ ...current, [key]: value }))

  const apply = () => {
    setPage(0)
    setApplied(filters)
    setSelected(null)
    const next = new URLSearchParams()
    if (filters.transactionRef.length > 0) next.set('transactionRef', filters.transactionRef)
    if (filters.propertyRef.length > 0) next.set('propertyRef', filters.propertyRef)
    setParams(next, { replace: true })
  }

  const reset = () => {
    setFilters(EMPTY)
    setApplied(EMPTY)
    setPage(0)
    setSelected(null)
    setParams(new URLSearchParams(), { replace: true })
  }

  const exportCsv = async () => {
    setError('')
    setNotice('')
    try {
      const csv = await getText(`/api/audit/export${qs({ ...applied })}`)
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'audit-trail.csv'
      link.click()
      URL.revokeObjectURL(url)
      setNotice('Exported the filtered audit trail. The export is itself audited.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  const rows = result?.rows ?? []
  const total = result?.total ?? 0
  const totalPages = result?.totalPages ?? 0
  const option = (values: string[] | undefined) => (values ?? []).map((v) => ({ value: v, label: v }))

  return (
    <>
      <Panel
        title="Audit trail"
        actions={
          <>
            <button onClick={() => void load()}>Refresh</button>
            <button onClick={() => void exportCsv()}>Export CSV</button>
            <button className="primary" onClick={apply}>
              Apply filters
            </button>
            <button className="link" onClick={reset}>
              Reset
            </button>
          </>
        }
      >
        <Banner kind="error" message={error} />
        <Banner kind="success" message={notice} />
        <p className="muted">
          {result === null
            ? 'Loading…'
            : `${total} audited action${total === 1 ? '' : 's'} · ${
                result.scope === 'STATE' ? 'every user in your state' : 'your own actions only'
              }`}
        </p>
        <div className="row">
          <Field label="From" type="date" value={filters.from} onChange={set('from')} />
          <Field label="To" type="date" value={filters.to} onChange={set('to')} />
          <Field
            label="User"
            value={filters.actorUsername}
            onChange={set('actorUsername')}
            options={option((facets?.actors ?? []).map((a) => String(a.actor_username)))}
          />
          <Field label="Category" value={filters.category} onChange={set('category')} options={option(facets?.categories)} />
        </div>
        <div className="row">
          <Field label="Action" value={filters.action} onChange={set('action')} options={option(facets?.actions)} />
          <Field label="Entity type" value={filters.entityType} onChange={set('entityType')} options={option(facets?.entityTypes)} />
          <Field label="Approval decision" value={filters.decision} onChange={set('decision')} options={option(facets?.decisions)} />
          <Field label="Outcome" value={filters.outcome} onChange={set('outcome')} options={option(facets?.outcomes)} />
        </div>
        <div className="row">
          <Field
            label="Transaction"
            value={filters.transactionRef}
            onChange={set('transactionRef')}
            placeholder="TXN-TN-2026-000001"
          />
          <Field label="Property" value={filters.propertyRef} onChange={set('propertyRef')} placeholder="TN-ADYAR-00000001" />
          <Field label="Entity id" value={filters.entityId} onChange={set('entityId')} />
          <Field label="Search" value={filters.search} onChange={set('search')} placeholder="Action, reference or detail" />
        </div>
        <div className="row">
          <Field label="Sort by" value={filters.sort} onChange={set('sort')} options={option(SORTS)} />
          <Field
            label="Direction"
            value={filters.direction}
            onChange={set('direction')}
            options={[
              { value: 'desc', label: 'Newest first' },
              { value: 'asc', label: 'Oldest first' },
            ]}
          />
          <Field
            label="Page size"
            value={size}
            onChange={(value) => {
              setPage(0)
              setSize(value)
            }}
            options={option(['25', '50', '100', '200'])}
          />
        </div>
      </Panel>

      <Panel
        title="Audited actions"
        actions={
          <>
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </button>
            <span className="muted">
              Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
            </span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </>
        }
      >
        <DataTable
          rows={rows}
          onRowClick={setSelected}
          columns={[
            { key: 'occurred_at', label: 'When' },
            { key: 'actor_username', label: 'User' },
            { key: 'actor_role', label: 'Role' },
            { key: 'action', label: 'Action' },
            { key: 'category', label: 'Category' },
            { key: 'entity_type', label: 'Entity' },
            { key: 'transaction_ref', label: 'Transaction' },
            { key: 'property_ref', label: 'Property' },
            { key: 'from_status', label: 'From' },
            { key: 'to_status', label: 'To' },
            { key: 'decision', label: 'Decision' },
            { key: 'outcome', label: 'Outcome' },
          ]}
          empty="No audited actions match these filters."
        />
      </Panel>

      {selected === null ? null : (
        <Panel
          title={`Entry ${formatCell(selected.id)} — ${formatCell(selected.action)}`}
          actions={
            <>
              {selected.transaction_ref === null || selected.transaction_ref === undefined ? null : (
                <button onClick={() => navigate(`/transactions/${String(selected.transaction_ref)}`)}>
                  Open transaction
                </button>
              )}
              {selected.property_ref === null || selected.property_ref === undefined ? null : (
                <button onClick={() => navigate(`/properties/${String(selected.property_ref)}`)}>Open property</button>
              )}
              <button className="link" onClick={() => setSelected(null)}>
                Close
              </button>
            </>
          }
        >
          <dl className="kv">
            <dt>When</dt>
            <dd>{formatCell(selected.occurred_at)}</dd>
            <dt>Who</dt>
            <dd>
              {formatCell(selected.actor_username)} ({formatCell(selected.actor_role)})
            </dd>
            <dt>Entity</dt>
            <dd>
              {formatCell(selected.entity_type)} {formatCell(selected.entity_id)}
            </dd>
            <dt>Linked records</dt>
            <dd>
              {selected.transaction_ref === null || selected.transaction_ref === undefined ? (
                '—'
              ) : (
                <Link to={`/transactions/${String(selected.transaction_ref)}`}>{String(selected.transaction_ref)}</Link>
              )}{' '}
              {selected.property_ref === null || selected.property_ref === undefined ? null : (
                <Link to={`/properties/${String(selected.property_ref)}`}>{String(selected.property_ref)}</Link>
              )}
            </dd>
            <dt>Status change</dt>
            <dd>
              {formatCell(selected.from_status)} → {formatCell(selected.to_status)} ({formatCell(selected.stage_code)})
            </dd>
            <dt>Approval decision</dt>
            <dd>{formatCell(selected.decision)}</dd>
            <dt>Outcome</dt>
            <dd>{formatCell(selected.outcome)}</dd>
            <dt>Detail</dt>
            <dd>{formatCell(selected.detail)}</dd>
            <dt>Request</dt>
            <dd>
              {formatCell(selected.http_method)} {formatCell(selected.request_path)} · {formatCell(selected.ip_address)}{' '}
              · {formatCell(selected.request_id)}
            </dd>
            <dt>Before</dt>
            <dd>
              <pre>{formatCell(selected.before_json)}</pre>
            </dd>
            <dt>After</dt>
            <dd>
              <pre>{formatCell(selected.after_json)}</pre>
            </dd>
          </dl>
        </Panel>
      )}

      <Panel title="Summary for these filters">
        <div className="row">
          <div>
            <h3>By category</h3>
            <DataTable
              rows={summary?.byCategory ?? []}
              columns={[
                { key: 'category', label: 'Category' },
                { key: 'events', label: 'Actions' },
              ]}
            />
          </div>
          <div>
            <h3>By approval decision</h3>
            <DataTable
              rows={summary?.byDecision ?? []}
              columns={[
                { key: 'decision', label: 'Decision' },
                { key: 'events', label: 'Actions' },
              ]}
              empty="No approvals or rejections in this selection."
            />
          </div>
          <div>
            <h3>By outcome</h3>
            <DataTable
              rows={summary?.byOutcome ?? []}
              columns={[
                { key: 'outcome', label: 'Outcome' },
                { key: 'events', label: 'Actions' },
              ]}
            />
          </div>
          <div>
            <h3>Most active users</h3>
            <DataTable
              rows={summary?.byActor ?? []}
              onRowClick={(row) => {
                setFilters((current) => ({ ...current, actorUsername: String(row.actor_username) }))
              }}
              columns={[
                { key: 'actor_username', label: 'User' },
                { key: 'actor_role', label: 'Role' },
                { key: 'events', label: 'Actions' },
                { key: 'last_action_at', label: 'Last action' },
              ]}
            />
          </div>
        </div>
      </Panel>
    </>
  )
}

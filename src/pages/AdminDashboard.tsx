import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { ApiError, get, qs } from '../api'
import { useAuth } from '../auth'
import { Banner, Panel, StatusPill, formatCell } from '../ui'

type Period = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'

interface CountRow {
  status: string
  count: number
}

interface TrendPoint {
  bucket: string
  transactions: number
  registered: number
  properties: number
  failures: number
}

interface DashboardData {
  filter: { stateCode: string; period: Period; from: string; to: string; bucket: 'HOUR' | 'DAY'; timezone: string }
  states: { code: string; name: string }[]
  summary: {
    transactionsInitiated: number
    transactionsRegistered: number
    transactionsWithdrawn: number
    propertiesAdded: number
    mutationsApproved: number
    feesCollected: number
    avgHoursToRegister?: number | null
    openPipeline: number
    openExceptions: number
  }
  transactionsByStatus: CountRow[]
  transactionsByDeedType: { code: string; name: string; count: number }[]
  trend: TrendPoint[]
  ruleChecks: { engine: string; outcome: string; count: number }[]
  failures: {
    ruleDiscrepancies: number
    ruleReviewRequired: number
    exceptionsRaised: number
    failedActions: number
    vaoObjections: number
    surveyOutOfTolerance: number
    withdrawn: number
    ruleReasons: { engine: string; outcome: string; reasonCode: string; count: number }[]
    failedActionsByType: { action: string; count: number }[]
  }
  revenue: {
    vaoVerified: number
    objectionsRaised: number
    objectionsDisposed: number
    objectionsUpheld: number
    objectionsDismissed: number
    objectionsOpen: number
    byStatus: CountRow[]
  }
  byOffice: { stateCode: string; sroCode: string; sroName: string; transactions: number; registered: number; exceptions: number }[]
  byState: { stateCode: string; stateName: string; transactions: number; registered: number; properties: number; exceptions: number }[]
  recentIssues: {
    occurredAt: string
    stateCode: string
    action: string
    transactionRef?: string | null
    propertyRef?: string | null
    actor?: string | null
    outcome: string
    toStatus?: string | null
    detail?: string | null
  }[]
  generatedAt: string
}

type Dataset = 'TRANSACTIONS' | 'PROPERTIES' | 'RULE_CHECKS' | 'ISSUES'

interface ExplorerQuery {
  dataset: Dataset
  search: string
  status: string
}

const TABS = [
  { id: 'overview', label: 'Overview', hint: 'Headline numbers, activity trend and the latest failures for the selected state and period.' },
  { id: 'transactions', label: 'Transactions', hint: 'Transaction volumes by status and deed type. Select a status to open the matching records.' },
  { id: 'failures', label: 'Failures & Rule Checks', hint: 'Why transactions failed or stalled: rule check discrepancies, exceptions, objections and failed actions.' },
  { id: 'revenue', label: 'VAO & Revenue', hint: 'Revenue mutation pipeline after registration, VAO verification and objection outcomes.' },
  { id: 'offices', label: 'States & Offices', hint: 'Activity compared across states and Sub-Registrar offices. Select an office to view its transactions.' },
  { id: 'data', label: 'Data Explorer', hint: 'Search and export the underlying records: transactions, properties, rule checks and failures.' },
] as const

type TabId = (typeof TABS)[number]['id']

const PALETTE = ['#0f2a4a', '#b8923d', '#2e6fb0', '#1c7a4e', '#7a9cc6', '#d9a75a', '#5f6670', '#16304f']

const PERIODS: { value: Period; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'WEEK', label: '1 Week' },
  { value: 'MONTH', label: '1 Month' },
  { value: 'CUSTOM', label: 'Date Range' },
]

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#9aa1a9',
  CONSENT_PENDING: '#e8cd95',
  RULE_CHECK_PENDING: '#d9a75a',
  EXCEPTION: '#b0392f',
  FEE_PAYMENT_PENDING: '#b8722e',
  SUBMITTED: '#5b8cc4',
  REGISTERED: '#1c7a4e',
  SURVEY_PENDING: '#7a9cc6',
  VAO_PENDING: '#2e6fb0',
  OBJECTION_PENDING: '#d8635a',
  TAHSILDAR_PENDING: '#16304f',
  REVENUE_APPROVED: '#0f6e56',
  WITHDRAWN: '#5f6670',
}

const SERIES = [
  { key: 'transactions', label: 'Transactions', color: '#0f2a4a' },
  { key: 'registered', label: 'Registered', color: '#1c7a4e' },
  { key: 'properties', label: 'New properties', color: '#b8923d' },
  { key: 'failures', label: 'Failures', color: '#b0392f' },
] as const

const OUTCOME_COLORS: Record<string, string> = {
  NO_DISCREPANCY_DETECTED: '#1c7a4e',
  REVIEW_REQUIRED: '#b8722e',
  DISCREPANCY_DETECTED: '#b0392f',
  NOT_CHECKED: '#9aa1a9',
}

const REVENUE_STAGES = ['VAO_PENDING', 'OBJECTION_PENDING', 'TAHSILDAR_PENDING', 'REVENUE_APPROVED']

const ENGINE_LABELS: Record<string, string> = {
  EC: 'Encumbrance (EC)',
  REVENUE_OWNERSHIP: 'Revenue ownership',
}

function humanize(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function formatBucket(bucket: string, granularity: 'HOUR' | 'DAY'): string {
  if (granularity === 'HOUR') return bucket.slice(11, 16)
  const date = new Date(`${bucket.slice(0, 10)}T00:00:00`)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function formatRange(from: string, to: string): string {
  const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  return `${Math.round((part / whole) * 100)}%`
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = isoDate(new Date())
  const [state, setState] = useState(user?.stateCode ?? 'ALL')
  const [period, setPeriod] = useState<Period>('MONTH')
  const [from, setFrom] = useState(() => {
    const start = new Date()
    start.setDate(start.getDate() - 29)
    return isoDate(start)
  })
  const [to, setTo] = useState(today)
  const [applied, setApplied] = useState({ from, to })
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [explorer, setExplorer] = useState<ExplorerQuery>({ dataset: 'TRANSACTIONS', search: '', status: '' })
  const requestedTab = searchParams.get('tab')
  const tab: TabId = TABS.find((t) => t.id === requestedTab)?.id ?? 'overview'

  const filterQuery = useMemo<Record<string, string>>(
    () => (period === 'CUSTOM' ? { state, period, from: applied.from, to: applied.to } : { state, period }),
    [state, period, applied],
  )

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      setData(await get<DashboardData>(`/api/admin/dashboard${qs(filterQuery)}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [filterQuery])

  useEffect(() => {
    void load()
  }, [load])

  const applyRange = () => {
    if (from.length === 0 || to.length === 0) {
      setError('Select both a start and an end date.')
      return
    }
    if (from > to) {
      setError('The start date must be on or before the end date.')
      return
    }
    setApplied({ from, to })
  }

  const stateName = data === null || data.filter.stateCode === 'ALL'
    ? 'All states'
    : data.states.find((s) => s.code === data.filter.stateCode)?.name ?? data.filter.stateCode

  const selectTab = (next: TabId) => {
    setSearchParams((params) => {
      const updated = new URLSearchParams(params)
      updated.set('tab', next)
      return updated
    }, { replace: true })
  }

  const explore = (next: Partial<ExplorerQuery>) => {
    setExplorer({ dataset: 'TRANSACTIONS', search: '', status: '', ...next })
    selectTab('data')
  }

  const counts: Partial<Record<TabId, number>> = data === null ? {} : {
    transactions: num(data.summary.transactionsInitiated),
    failures: totalFailures(data),
    revenue: num(data.revenue.objectionsOpen),
  }

  return (
    <div className="dashboard-page admin-dashboard">
      <div className="dashboard-titlebar">
        <div>
          <span className="eyebrow">State administration · Activity overview</span>
          <h1>State Dashboard</h1>
          {data !== null ? <p className="ad-subtitle">{stateName} · {formatRange(data.filter.from, data.filter.to)} · {data.filter.timezone}</p> : null}
        </div>
        <div className="dashboard-actions">
          <button onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          <button className="outline" onClick={() => navigate('/audit')}>Open Audit Trail</button>
        </div>
      </div>

      <section className="ad-filters" aria-label="Dashboard filters">
        <label className="ad-filter">
          <span>State</span>
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="ALL">All states</option>
            {(data?.states ?? (user !== null ? [{ code: user.stateCode, name: user.stateCode }] : [])).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        <div className="ad-filter">
          <span>Timeline</span>
          <div className="ad-segment" role="group" aria-label="Timeline">
            {PERIODS.map((p) => <button key={p.value} aria-pressed={period === p.value} className={period === p.value ? 'active' : undefined} onClick={() => setPeriod(p.value)}>{p.label}</button>)}
          </div>
        </div>
        {period === 'CUSTOM' ? (
          <div className="ad-range">
            <label className="ad-filter"><span>From</span><input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="ad-filter"><span>To</span><input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></label>
            <button className="primary" onClick={applyRange}>Apply</button>
          </div>
        ) : null}
      </section>

      <nav className="ad-tabs" role="tablist" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`ad-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`ad-panel-${t.id}`}
            className={tab === t.id ? 'active' : undefined}
            onClick={() => selectTab(t.id)}
            title={t.hint}
          >
            {t.label}
            {counts[t.id] !== undefined ? <b className={t.id === 'failures' || t.id === 'revenue' ? 'ad-tab-alert' : undefined}>{num(counts[t.id]).toLocaleString('en-IN')}</b> : null}
          </button>
        ))}
      </nav>

      <Banner kind="error" message={error} />
      <div role="tabpanel" id={`ad-panel-${tab}`} aria-labelledby={`ad-tab-${tab}`}>
        <p className="ad-tab-hint">{TABS.find((t) => t.id === tab)?.hint}</p>
        {tab === 'data' ? (
          <DataExplorer key={`${explorer.dataset}|${explorer.search}|${explorer.status}`} filterQuery={filterQuery} explorer={explorer} onChange={setExplorer} />
        ) : data === null ? (
          <p className="muted">{loading ? 'Loading dashboard…' : 'No data.'}</p>
        ) : (
          <DashboardTab data={data} tab={tab} explore={explore} />
        )}
      </div>
      {data !== null ? <p className="ad-footnote">Rule check findings are advisory in the pilot; counts reflect recorded engine results, workflow audit events and VAO objections within the selected window. Generated {new Date(data.generatedAt).toLocaleString('en-IN')}.</p> : null}
    </div>
  )
}

function totalFailures(data: DashboardData): number {
  const f = data.failures
  return num(f.ruleDiscrepancies) + num(f.exceptionsRaised) + num(f.failedActions) + num(f.vaoObjections) + num(f.surveyOutOfTolerance)
}

function DashboardTab({ data, tab, explore }: { data: DashboardData; tab: Exclude<TabId, 'data'>; explore: (next: Partial<ExplorerQuery>) => void }) {
  const s = data.summary
  const f = data.failures
  const r = data.revenue
  const allStates = data.filter.stateCode === 'ALL'
  const kpis = [
    { label: 'Transactions', value: num(s.transactionsInitiated).toLocaleString('en-IN'), note: 'Initiated in period', tone: 'navy' },
    { label: 'Registered', value: num(s.transactionsRegistered).toLocaleString('en-IN'), note: `${percent(num(s.transactionsRegistered), num(s.transactionsInitiated))} of initiated`, tone: 'success' },
    { label: 'New Properties', value: num(s.propertiesAdded).toLocaleString('en-IN'), note: 'Minted in period', tone: 'gold' },
    { label: 'Revenue Approved', value: num(s.mutationsApproved).toLocaleString('en-IN'), note: 'Mutations by Tahsildar', tone: 'info' },
    { label: 'Fees Collected', value: `₹ ${num(s.feesCollected).toLocaleString('en-IN')}`, note: 'Successful payments', tone: 'gold', money: true },
    { label: 'Failures & Holds', value: totalFailures(data).toLocaleString('en-IN'), note: 'Rule, VAO, survey, API', tone: 'danger' },
    { label: 'Open Exceptions', value: num(s.openExceptions).toLocaleString('en-IN'), note: 'Current, all time', tone: 'warning' },
    { label: 'Open Pipeline', value: num(s.openPipeline).toLocaleString('en-IN'), note: typeof s.avgHoursToRegister === 'number' ? `Avg ${s.avgHoursToRegister} h to register` : 'Current, all time', tone: 'navy' },
  ]

  const failureBars = [
    { label: 'Rule check discrepancy', value: num(f.ruleDiscrepancies), color: '#b0392f' },
    { label: 'Rule check review required', value: num(f.ruleReviewRequired), color: '#b8722e' },
    { label: 'Moved to exception', value: num(f.exceptionsRaised), color: '#d8635a' },
    { label: 'VAO objection raised', value: num(f.vaoObjections), color: '#2e6fb0' },
    { label: 'Survey out of tolerance', value: num(f.surveyOutOfTolerance), color: '#7a9cc6' },
    { label: 'Failed workflow actions', value: num(f.failedActions), color: '#5f6670' },
    { label: 'Withdrawn', value: num(f.withdrawn), color: '#9aa1a9' },
  ]
  const statusRows = data.transactionsByStatus.map((row) => ({ label: row.status, value: num(row.count), color: STATUS_COLORS[row.status] ?? '#9aa1a9' }))
  const exploreLink = (label: string, next: Partial<ExplorerQuery>) => <button className="link" onClick={() => explore(next)}>{label}</button>

  if (tab === 'overview') {
    return (
      <>
        <div className="ad-kpi-grid">
          {kpis.map((k) => (
            <div key={k.label} className={`ad-kpi ad-tone-${k.tone}${k.money === true ? ' ad-kpi-money' : ''}`}>
              <span>{k.label}</span>
              <strong>{k.value}</strong>
              <small>{k.note}</small>
            </div>
          ))}
        </div>
        <div className="ad-row ad-row-wide">
          <Panel title="Activity Trend" actions={<Legend items={SERIES.map((x) => ({ label: x.label, color: x.color }))} />}>
            <TrendChart points={data.trend} bucket={data.filter.bucket} />
          </Panel>
          <Panel title="Failure Snapshot" actions={exploreLink('View records', { dataset: 'ISSUES' })}>
            <HorizontalBars rows={failureBars.slice(0, 6)} />
          </Panel>
        </div>
        <Panel title="Recent Failures & Exceptions" actions={exploreLink('Search all failures', { dataset: 'ISSUES' })}>
          <RecentIssues rows={data.recentIssues} />
        </Panel>
      </>
    )
  }

  if (tab === 'transactions') {
    const total = statusRows.reduce((sum, row) => sum + row.value, 0)
    return (
      <>
        <div className="ad-row">
          <Panel title="Transactions by Status" actions={<span className="muted">Select a status to view records</span>}>
            <Donut rows={statusRows} centerLabel="Transactions" onSelect={(status) => explore({ dataset: 'TRANSACTIONS', status })} />
          </Panel>
          <Panel title="Deed Type Mix">
            <HorizontalBars rows={data.transactionsByDeedType.map((d, i) => ({ label: d.name, value: num(d.count), color: PALETTE[i % PALETTE.length] }))} empty="No transactions in this period." />
          </Panel>
        </div>
        <div className="ad-row ad-row-wide">
          <Panel title="Initiated vs Registered" actions={<Legend items={SERIES.slice(0, 2).map((x) => ({ label: x.label, color: x.color }))} />}>
            <TrendChart points={data.trend} bucket={data.filter.bucket} series={SERIES.slice(0, 2)} />
          </Panel>
          <Panel title="Status Breakdown">
            {statusRows.length === 0 ? <p className="muted">No transactions in this period.</p> : (
              <table className="grid ad-compact">
                <thead><tr><th>Status</th><th className="num">Count</th><th className="num">Share</th></tr></thead>
                <tbody>
                  {statusRows.map((row) => (
                    <tr key={row.label} className="clickable" onClick={() => explore({ dataset: 'TRANSACTIONS', status: row.label })}>
                      <td><StatusPill status={row.label} /></td>
                      <td className="num"><strong>{row.value.toLocaleString('en-IN')}</strong></td>
                      <td className="num muted">{percent(row.value, total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </>
    )
  }

  if (tab === 'failures') {
    return (
      <>
        <div className="ad-row">
          <Panel title="Failure Overview" actions={<span className="muted">Why transactions stalled or failed</span>}>
            <HorizontalBars rows={failureBars} />
          </Panel>
          <Panel title="Rule Check Outcomes by Engine" actions={<Legend items={Object.entries(OUTCOME_COLORS).map(([key, color]) => ({ label: humanize(key), color }))} />}>
            <RuleEngines rows={data.ruleChecks} />
          </Panel>
        </div>
        <div className="ad-row">
          <Panel title="Top Rule Check Failure Reasons" actions={<span className="muted">Select a reason to view checks</span>}>
            {f.ruleReasons.length === 0 ? <p className="muted">No rule check discrepancies in this period.</p> : (
              <ol className="ad-reasons">
                {f.ruleReasons.map((reason, i) => (
                  <li key={`${reason.engine}-${reason.reasonCode}-${reason.outcome}`} className="clickable" onClick={() => explore({ dataset: 'RULE_CHECKS', status: reason.outcome, search: reason.reasonCode })}>
                    <span className="ad-rank">{i + 1}</span>
                    <div><strong>{humanize(reason.reasonCode)}</strong><small>{ENGINE_LABELS[reason.engine] ?? reason.engine} · {humanize(reason.outcome)}</small></div>
                    <b>{num(reason.count)}</b>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel title="Failed Workflow Actions" actions={exploreLink('View failures', { dataset: 'ISSUES', status: 'FAILURE' })}>
            <HorizontalBars rows={f.failedActionsByType.map((a, i) => ({ label: humanize(a.action), value: num(a.count), color: PALETTE[(i + 3) % PALETTE.length] }))} empty="No failed workflow actions in this period." />
          </Panel>
        </div>
      </>
    )
  }

  if (tab === 'revenue') {
    const mutationRows = r.byStatus.map((row) => ({ label: row.status, value: num(row.count), color: STATUS_COLORS[row.status] ?? '#9aa1a9' }))
    return (
      <>
        <Panel title="VAO & Revenue Mutation Pipeline">
          <RevenuePipeline revenue={r} />
        </Panel>
        <div className="ad-row">
          <Panel title="Mutations by Status">
            <Donut rows={mutationRows} centerLabel="Mutations" />
          </Panel>
          <Panel title="VAO Objection Outcomes" actions={exploreLink('View objections', { dataset: 'ISSUES', status: 'OBJECTION' })}>
            <HorizontalBars rows={[
              { label: 'VAO verified', value: num(r.vaoVerified), color: '#1c7a4e' },
              { label: 'Objections raised', value: num(r.objectionsRaised), color: '#b0392f' },
              { label: 'Objections open', value: num(r.objectionsOpen), color: '#b8722e' },
              { label: 'Objections disposed', value: num(r.objectionsDisposed), color: '#2e6fb0' },
              { label: 'Upheld (rejected by VAO)', value: num(r.objectionsUpheld), color: '#d8635a' },
              { label: 'Dismissed', value: num(r.objectionsDismissed), color: '#9aa1a9' },
            ]} />
          </Panel>
        </div>
      </>
    )
  }

  return (
    <div className="ad-row">
      <Panel title={allStates ? 'State Comparison' : 'State Activity'}>
        <StateComparison rows={data.byState} />
      </Panel>
      <Panel title="Top Sub-Registrar Offices" actions={<span className="muted">Select an office to view transactions</span>}>
        <OfficeTable rows={data.byOffice} showState={allStates} onSelect={(sroCode) => explore({ dataset: 'TRANSACTIONS', search: sroCode })} />
      </Panel>
    </div>
  )
}

type RecordRow = Record<string, unknown>

interface RecordsResponse {
  dataset: Dataset
  total: number
  limit: number
  rows: RecordRow[]
}

interface Column {
  label: string
  value: (row: RecordRow) => string
  render?: (row: RecordRow) => ReactNode
  numeric?: boolean
}

function text(key: string): (row: RecordRow) => string {
  return (row) => formatCell(row[key])
}

function dateTime(key: string): (row: RecordRow) => string {
  return (row) => {
    const value = row[key]
    if (typeof value !== 'string') return '—'
    return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
}

const pill = (key: string) => (row: RecordRow) => (typeof row[key] === 'string' ? <StatusPill status={String(row[key])} /> : '—')
const strong = (key: string) => (row: RecordRow) => <strong>{formatCell(row[key])}</strong>

const DATASETS: Record<Dataset, { label: string; placeholder: string; statusLabel: string; statuses: string[]; columns: Column[]; link: (row: RecordRow) => string | null }> = {
  TRANSACTIONS: {
    label: 'Transactions',
    placeholder: 'Transaction ref, property ref, SRO or deed type',
    statusLabel: 'Status',
    statuses: Object.keys(STATUS_COLORS),
    link: (row) => (typeof row.txnRef === 'string' ? `/transactions/${encodeURIComponent(row.txnRef)}` : null),
    columns: [
      { label: 'Transaction', value: text('txnRef'), render: strong('txnRef') },
      { label: 'State', value: text('stateCode') },
      { label: 'Office', value: (row) => `${formatCell(row.sroName)} (${formatCell(row.sroCode)})`, render: (row) => <span className="ad-cell-stack"><span>{formatCell(row.sroName)}</span><small>{formatCell(row.sroCode)}</small></span> },
      { label: 'Property', value: text('propertyRef') },
      { label: 'Deed type', value: text('deedType') },
      { label: 'Status', value: text('status'), render: pill('status') },
      { label: 'Initiated', value: dateTime('initiatedAt') },
      { label: 'Registered', value: dateTime('registeredAt') },
      { label: 'Rule flags', value: (row) => `${num(row.ruleFlags)} / ${num(row.ruleChecks)}`, render: (row) => <span className={num(row.ruleFlags) > 0 ? 'ad-flag' : 'muted'}>{num(row.ruleFlags)} / {num(row.ruleChecks)}</span>, numeric: true },
      { label: 'Fees paid', value: (row) => `₹ ${num(row.feesPaid).toLocaleString('en-IN')}`, numeric: true },
    ],
  },
  PROPERTIES: {
    label: 'Properties',
    placeholder: 'Property ref, survey no, ULPIN, district, village or SRO',
    statusLabel: 'Status',
    statuses: ['ACTIVE', 'SUPERSEDED'],
    link: (row) => (typeof row.propertyRef === 'string' ? `/properties/${encodeURIComponent(row.propertyRef)}` : null),
    columns: [
      { label: 'Property', value: text('propertyRef'), render: strong('propertyRef') },
      { label: 'State', value: text('stateCode') },
      { label: 'District', value: text('districtCode') },
      { label: 'Village', value: text('villageCode') },
      { label: 'Office', value: text('sroCode') },
      { label: 'Survey no', value: (row) => [row.surveyNo, row.subdivisionNo].filter((v) => typeof v === 'string' && v.length > 0).join(' / ') || '—' },
      { label: 'Type', value: (row) => (typeof row.propertyType === 'string' ? humanize(row.propertyType) : '—') },
      { label: 'Extent', value: (row) => `${num(row.extentValue).toLocaleString('en-IN')} ${typeof row.extentUnit === 'string' ? humanize(row.extentUnit) : ''}`.trim(), numeric: true },
      { label: 'Status', value: text('status'), render: pill('status') },
      { label: 'Added', value: dateTime('createdAt') },
      { label: 'Transactions', value: (row) => String(num(row.transactions)), numeric: true },
    ],
  },
  RULE_CHECKS: {
    label: 'Rule Checks',
    placeholder: 'Transaction ref, reason code, engine or SRO',
    statusLabel: 'Outcome',
    statuses: Object.keys(OUTCOME_COLORS),
    link: (row) => (typeof row.txnRef === 'string' ? `/transactions/${encodeURIComponent(row.txnRef)}` : null),
    columns: [
      { label: 'Checked', value: dateTime('checkedAt') },
      { label: 'State', value: text('stateCode') },
      { label: 'Transaction', value: text('txnRef'), render: strong('txnRef') },
      { label: 'Office', value: text('sroCode') },
      { label: 'Engine', value: (row) => ENGINE_LABELS[String(row.engine)] ?? formatCell(row.engine) },
      { label: 'Outcome', value: text('outcome'), render: pill('outcome') },
      { label: 'Reason', value: (row) => (typeof row.reasonCode === 'string' ? humanize(row.reasonCode) : '—') },
      { label: 'Txn status', value: text('transactionStatus'), render: pill('transactionStatus') },
    ],
  },
  ISSUES: {
    label: 'Failures & Exceptions',
    placeholder: 'Action, transaction ref, property ref, user or detail',
    statusLabel: 'Type',
    statuses: ['FAILURE', 'EXCEPTION', 'OBJECTION'],
    link: (row) => (typeof row.transactionRef === 'string' ? `/transactions/${encodeURIComponent(row.transactionRef)}` : null),
    columns: [
      { label: 'When', value: dateTime('occurredAt') },
      { label: 'State', value: text('stateCode') },
      { label: 'Type', value: text('kind'), render: pill('kind') },
      { label: 'Action', value: (row) => humanize(String(row.action ?? '')) },
      { label: 'Transaction', value: text('transactionRef'), render: strong('transactionRef') },
      { label: 'User', value: (row) => [row.actor, row.actorRole].filter((v) => typeof v === 'string').join(' · ') || '—' },
      { label: 'Detail', value: text('detail'), render: (row) => <span className="ad-detail" title={formatCell(row.detail)}>{formatCell(row.detail)}</span> },
    ],
  },
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function DataExplorer({ filterQuery, explorer, onChange }: {
  filterQuery: Record<string, string>
  explorer: ExplorerQuery
  onChange: (next: ExplorerQuery) => void
}) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(explorer.search)
  const [result, setResult] = useState<RecordsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const config = DATASETS[explorer.dataset]

  useEffect(() => {
    let cancelled = false
    get<RecordsResponse>(`/api/admin/dashboard/records${qs({ ...filterQuery, dataset: explorer.dataset, q: explorer.search, status: explorer.status })}`)
      .then((response) => {
        if (!cancelled) setResult(response)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filterQuery, explorer])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onChange({ ...explorer, search: draft.trim() })
  }

  const exportCsv = () => {
    if (result === null) return
    const lines = [
      config.columns.map((c) => csvEscape(c.label)).join(','),
      ...result.rows.map((row) => config.columns.map((c) => csvEscape(c.value(row))).join(',')),
    ]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `slate-${explorer.dataset.toLowerCase().replace(/_/g, '-')}-${filterQuery.state ?? 'all'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Panel
      title={`${config.label} Records`}
      actions={<button className="outline" onClick={exportCsv} disabled={result === null || result.rows.length === 0}>Export CSV</button>}
    >
      <div className="ad-explorer-datasets" role="group" aria-label="Dataset">
        {(Object.keys(DATASETS) as Dataset[]).map((key) => (
          <button key={key} aria-pressed={explorer.dataset === key} className={explorer.dataset === key ? 'active' : undefined} onClick={() => onChange({ dataset: key, search: '', status: '' })}>
            {DATASETS[key].label}
          </button>
        ))}
      </div>
      <form className="ad-explorer-search" onSubmit={submit} role="search">
        <label className="ad-filter ad-explorer-query">
          <span>Search</span>
          <input type="search" value={draft} maxLength={100} placeholder={config.placeholder} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <label className="ad-filter">
          <span>{config.statusLabel}</span>
          <select value={explorer.status} onChange={(e) => onChange({ ...explorer, search: draft.trim(), status: e.target.value })}>
            <option value="">All</option>
            {config.statuses.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </label>
        <button className="primary" type="submit">Search</button>
        {explorer.search.length > 0 || explorer.status.length > 0 ? <button type="button" onClick={() => onChange({ dataset: explorer.dataset, search: '', status: '' })}>Clear</button> : null}
      </form>
      <Banner kind="error" message={error} />
      {loading ? <p className="muted">Loading records…</p> : result === null ? null : (
        <>
          <p className="ad-explorer-meta">
            {result.total === 0 ? 'No matching records in this period.' : `Showing ${result.rows.length.toLocaleString('en-IN')} of ${num(result.total).toLocaleString('en-IN')} matching records`}
            {num(result.total) > result.rows.length ? ` · latest ${result.limit} shown, refine the search to narrow down` : ''}
          </p>
          {result.rows.length > 0 ? (
            <div className="ad-table-scroll">
              <table className="grid">
                <thead><tr>{config.columns.map((c) => <th key={c.label} className={c.numeric === true ? 'num' : undefined}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {result.rows.map((row, i) => {
                    const href = config.link(row)
                    return (
                      <tr key={i} className={href === null ? undefined : 'clickable'} onClick={href === null ? undefined : () => navigate(href)}>
                        {config.columns.map((c) => <td key={c.label} className={c.numeric === true ? 'num' : undefined}>{c.render === undefined ? c.value(row) : c.render(row)}</td>)}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  )
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="ad-legend">
      {items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>)}
    </div>
  )
}

function TrendChart({ points, bucket, series = SERIES }: { points: TrendPoint[]; bucket: 'HOUR' | 'DAY'; series?: readonly (typeof SERIES)[number][] }) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 720
  const height = 260
  const pad = { top: 16, right: 16, bottom: 30, left: 40 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(1, ...points.flatMap((p) => series.map((s) => num(p[s.key]))))
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4)
  const x = (i: number) => pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH
  const labelEvery = Math.max(1, Math.ceil(points.length / 8))
  const ticks = [0, 1, 2, 3, 4].map((t) => (niceMax / 4) * t)

  if (points.length === 0) return <p className="muted">No activity in this period.</p>

  const line = (key: (typeof SERIES)[number]['key']) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(num(p[key])).toFixed(1)}`).join(' ')
  const area = `${line(series[0].key)} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
  const active = hover === null ? null : points[hover]

  return (
    <div className="ad-trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Activity trend chart" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="ad-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f2a4a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0f2a4a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className="ad-gridline" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="ad-axis">{Math.round(t)}</text>
          </g>
        ))}
        {points.map((p, i) => ((i % labelEvery === 0 && points.length - 1 - i >= labelEvery / 2) || i === points.length - 1 ? <text key={p.bucket} x={x(i)} y={height - 8} textAnchor="middle" className="ad-axis">{formatBucket(p.bucket, bucket)}</text> : null))}
        <path d={area} fill="url(#ad-area)" />
        {series.map((s) => <path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth={s.key === 'transactions' ? 2.4 : 1.8} strokeDasharray={s.key === 'failures' ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="ad-hoverline" /> : null}
        {hover !== null ? series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(num(points[hover][s.key]))} r={3.5} fill="#fff" stroke={s.color} strokeWidth={2} />) : null}
        {points.map((p, i) => {
          const step = points.length <= 1 ? innerW : innerW / (points.length - 1)
          return <rect key={p.bucket} x={x(i) - step / 2} y={pad.top} width={step} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
        })}
      </svg>
      {active !== null ? (
        <div className="ad-tooltip">
          <strong>{bucket === 'HOUR' ? `${formatBucket(active.bucket, 'DAY')} ${formatBucket(active.bucket, 'HOUR')}` : formatBucket(active.bucket, 'DAY')}</strong>
          {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}<b>{num(active[s.key])}</b></span>)}
        </div>
      ) : null}
    </div>
  )
}

function Donut({ rows, centerLabel, onSelect }: { rows: { label: string; value: number; color: string }[]; centerLabel: string; onSelect?: (label: string) => void }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const segments = useMemo(() => {
    const lengths = rows.map((r) => (total === 0 ? 0 : (r.value / total) * circumference))
    return rows.map((r, i) => ({ ...r, length: lengths[i], offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0) }))
  }, [rows, total, circumference])

  if (total === 0) return <p className="muted">No {centerLabel.toLowerCase()} in this period.</p>

  return (
    <div className="ad-donut">
      <svg viewBox="0 0 200 200" role="img" aria-label={`${centerLabel} by status`}>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#eceef0" strokeWidth="26" />
        {segments.map((s) => (
          <circle key={s.label} cx="100" cy="100" r={radius} fill="none" stroke={s.color} strokeWidth="26" strokeDasharray={`${s.length} ${circumference - s.length}`} strokeDashoffset={-s.offset} transform="rotate(-90 100 100)">
            <title>{`${humanize(s.label)}: ${s.value}`}</title>
          </circle>
        ))}
        <text x="100" y="96" textAnchor="middle" className="ad-donut-total">{total.toLocaleString('en-IN')}</text>
        <text x="100" y="116" textAnchor="middle" className="ad-donut-label">{centerLabel}</text>
      </svg>
      <ul className="ad-donut-legend">
        {rows.map((r) => (
          <li key={r.label} className={onSelect === undefined ? undefined : 'clickable'} onClick={onSelect === undefined ? undefined : () => onSelect(r.label)}><i style={{ background: r.color }} /><span>{humanize(r.label)}</span><b>{r.value}</b><small>{percent(r.value, total)}</small></li>
        ))}
      </ul>
    </div>
  )
}

function HorizontalBars({ rows, empty = 'Nothing recorded in this period.' }: { rows: { label: string; value: number; color: string }[]; empty?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="muted">{empty}</p>
  return (
    <div className="ad-hbars">
      {rows.map((r) => (
        <div key={r.label} className="ad-hbar">
          <span className="ad-hbar-label">{r.label}</span>
          <div className="ad-hbar-track"><div className="ad-hbar-fill" style={{ width: max === 0 ? '0%' : `${Math.max(2, (r.value / max) * 100)}%`, background: r.color }} /></div>
          <b>{r.value.toLocaleString('en-IN')}</b>
        </div>
      ))}
    </div>
  )
}

function RuleEngines({ rows }: { rows: DashboardData['ruleChecks'] }) {
  const engines = Array.from(new Set(rows.map((r) => r.engine)))
  if (engines.length === 0) return <p className="muted">No rule checks run in this period.</p>
  return (
    <div className="ad-stacks">
      {engines.map((engine) => {
        const parts = Object.keys(OUTCOME_COLORS).map((outcome) => ({ outcome, value: num(rows.find((r) => r.engine === engine && r.outcome === outcome)?.count) }))
        const total = parts.reduce((sum, p) => sum + p.value, 0)
        const flagged = parts.filter((p) => p.outcome !== 'NO_DISCREPANCY_DETECTED').reduce((sum, p) => sum + p.value, 0)
        return (
          <div key={engine} className="ad-stack">
            <div className="ad-stack-head"><strong>{ENGINE_LABELS[engine] ?? engine}</strong><small>{total} checks · {percent(flagged, total)} flagged</small></div>
            <div className="ad-stack-bar">
              {parts.filter((p) => p.value > 0).map((p) => <div key={p.outcome} style={{ width: `${(p.value / total) * 100}%`, background: OUTCOME_COLORS[p.outcome] }} title={`${humanize(p.outcome)}: ${p.value}`}>{p.value}</div>)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RevenuePipeline({ revenue }: { revenue: DashboardData['revenue'] }) {
  const counts = REVENUE_STAGES.map((stage) => ({ stage, value: num(revenue.byStatus.find((r) => r.status === stage)?.count) }))
  const total = counts.reduce((sum, c) => sum + c.value, 0)
  return (
    <div className="ad-pipeline">
      <div className="ad-pipeline-steps">
        {counts.map((c, i) => (
          <div key={c.stage} className={`ad-step ad-step-${i}`}>
            <span>{humanize(c.stage)}</span>
            <strong>{c.value}</strong>
            <small>{percent(c.value, total)}</small>
          </div>
        ))}
      </div>
      <div className="ad-mini-grid">
        <div><span>VAO verified</span><strong>{num(revenue.vaoVerified)}</strong></div>
        <div className="ad-mini-danger"><span>VAO objections raised</span><strong>{num(revenue.objectionsRaised)}</strong></div>
        <div><span>Objections disposed</span><strong>{num(revenue.objectionsDisposed)}</strong></div>
        <div className="ad-mini-warning"><span>Objections open</span><strong>{num(revenue.objectionsOpen)}</strong></div>
        <div><span>Objections upheld</span><strong>{num(revenue.objectionsUpheld)}</strong></div>
        <div><span>Objections dismissed</span><strong>{num(revenue.objectionsDismissed)}</strong></div>
      </div>
      <p className="ad-caption">Mutations created in the period, by current status. Objections are raised by the VAO and return the mutation to VAO verification once disposed.</p>
    </div>
  )
}

function StateComparison({ rows }: { rows: DashboardData['byState'] }) {
  const metrics = [
    { key: 'transactions', label: 'Transactions', color: '#0f2a4a' },
    { key: 'registered', label: 'Registered', color: '#1c7a4e' },
    { key: 'properties', label: 'New properties', color: '#b8923d' },
    { key: 'exceptions', label: 'Exceptions', color: '#b0392f' },
  ] as const
  const max = Math.max(1, ...rows.flatMap((r) => metrics.map((m) => num(r[m.key]))))
  return (
    <div className="ad-states">
      <Legend items={metrics.map((m) => ({ label: m.label, color: m.color }))} />
      {rows.map((r) => (
        <div key={r.stateCode} className="ad-state">
          <strong>{r.stateName}<small>{r.stateCode}</small></strong>
          <div className="ad-state-bars">
            {metrics.map((m) => (
              <div key={m.key} className="ad-state-bar">
                <div style={{ width: `${(num(r[m.key]) / max) * 100}%`, background: m.color }} />
                <b>{num(r[m.key])}</b>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function OfficeTable({ rows, showState, onSelect }: { rows: DashboardData['byOffice']; showState: boolean; onSelect: (sroCode: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => num(r.transactions)))
  if (rows.length === 0) return <p className="muted">No transactions in this period.</p>
  return (
    <table className="grid ad-office">
      <thead><tr><th>Office</th>{showState ? <th>State</th> : null}<th>Volume</th><th>Registered</th><th>Exceptions</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.stateCode}-${r.sroCode}`} className="clickable" onClick={() => onSelect(r.sroCode)}>
            <td><strong>{r.sroName}</strong><small className="cell-subtext">{r.sroCode}</small></td>
            {showState ? <td>{r.stateCode}</td> : null}
            <td><div className="ad-inline-bar"><div style={{ width: `${(num(r.transactions) / max) * 100}%` }} /><b>{num(r.transactions)}</b></div></td>
            <td>{num(r.registered)}</td>
            <td>{num(r.exceptions) > 0 ? <span className="pill pill-exception">{num(r.exceptions)}</span> : '0'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RecentIssues({ rows }: { rows: DashboardData['recentIssues'] }) {
  const navigate = useNavigate()
  if (rows.length === 0) return <p className="muted">No failures or exceptions recorded in this period.</p>
  const kind = (r: DashboardData['recentIssues'][number]) => {
    if (r.toStatus === 'EXCEPTION') return 'EXCEPTION'
    if (r.action === 'OBJECTION_RAISED') return 'OBJECTION_PENDING'
    return 'FAILED'
  }
  return (
    <table className="grid">
      <thead><tr><th>When</th><th>State</th><th>Type</th><th>Action</th><th>Transaction</th><th>Actor</th><th>Detail</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={r.transactionRef ? 'clickable' : undefined} onClick={r.transactionRef ? () => navigate(`/transactions/${encodeURIComponent(String(r.transactionRef))}`) : undefined}>
            <td>{new Date(r.occurredAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <td>{r.stateCode}</td>
            <td><StatusPill status={kind(r)} /></td>
            <td>{humanize(r.action)}</td>
            <td><strong>{formatCell(r.transactionRef)}</strong></td>
            <td>{formatCell(r.actor)}</td>
            <td className="ad-detail">{formatCell(r.detail)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

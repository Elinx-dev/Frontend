import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const query = period === 'CUSTOM' ? { state, period, from: applied.from, to: applied.to } : { state, period }
      setData(await get<DashboardData>(`/api/admin/dashboard${qs(query)}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [state, period, applied])

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
          <div className="ad-segment" role="tablist">
            {PERIODS.map((p) => <button key={p.value} role="tab" aria-selected={period === p.value} className={period === p.value ? 'active' : undefined} onClick={() => setPeriod(p.value)}>{p.label}</button>)}
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

      <Banner kind="error" message={error} />
      {data === null ? <p className="muted">{loading ? 'Loading dashboard…' : 'No data.'}</p> : <DashboardBody data={data} />}
    </div>
  )
}

function DashboardBody({ data }: { data: DashboardData }) {
  const s = data.summary
  const f = data.failures
  const totalFailures = num(f.ruleDiscrepancies) + num(f.exceptionsRaised) + num(f.failedActions) + num(f.vaoObjections) + num(f.surveyOutOfTolerance)
  const kpis = [
    { label: 'Transactions', value: num(s.transactionsInitiated).toLocaleString('en-IN'), note: 'Initiated in period', tone: 'navy' },
    { label: 'Registered', value: num(s.transactionsRegistered).toLocaleString('en-IN'), note: `${percent(num(s.transactionsRegistered), num(s.transactionsInitiated))} of initiated`, tone: 'success' },
    { label: 'New Properties', value: num(s.propertiesAdded).toLocaleString('en-IN'), note: 'Minted in period', tone: 'gold' },
    { label: 'Revenue Approved', value: num(s.mutationsApproved).toLocaleString('en-IN'), note: 'Mutations by Tahsildar', tone: 'info' },
    { label: 'Fees Collected', value: `₹ ${num(s.feesCollected).toLocaleString('en-IN')}`, note: 'Successful payments', tone: 'gold', money: true },
    { label: 'Failures & Holds', value: totalFailures.toLocaleString('en-IN'), note: 'Rule, VAO, survey, API', tone: 'danger' },
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
        <Panel title="Transactions by Status">
          <Donut rows={data.transactionsByStatus.map((r) => ({ label: r.status, value: num(r.count), color: STATUS_COLORS[r.status] ?? '#9aa1a9' }))} centerLabel="Transactions" />
        </Panel>
      </div>

      <div className="ad-row">
        <Panel title="Failure Overview" actions={<span className="muted">Why transactions stalled or failed</span>}>
          <HorizontalBars rows={failureBars} />
          {f.failedActionsByType.length > 0 ? (
            <div className="ad-chips">
              <span>Failed actions</span>
              {f.failedActionsByType.map((a) => <span key={a.action} className="ad-chip">{humanize(a.action)}<b>{num(a.count)}</b></span>)}
            </div>
          ) : null}
        </Panel>
        <Panel title="Rule Check Outcomes by Engine" actions={<Legend items={Object.entries(OUTCOME_COLORS).map(([key, color]) => ({ label: humanize(key), color }))} />}>
          <RuleEngines rows={data.ruleChecks} />
        </Panel>
      </div>

      <div className="ad-row">
        <Panel title="VAO & Revenue Mutation Pipeline">
          <RevenuePipeline revenue={data.revenue} />
        </Panel>
        <Panel title="Top Rule Check Failure Reasons">
          {f.ruleReasons.length === 0 ? <p className="muted">No rule check discrepancies in this period.</p> : (
            <ol className="ad-reasons">
              {data.failures.ruleReasons.map((r, i) => (
                <li key={`${r.engine}-${r.reasonCode}-${r.outcome}`}>
                  <span className="ad-rank">{i + 1}</span>
                  <div><strong>{humanize(r.reasonCode)}</strong><small>{ENGINE_LABELS[r.engine] ?? r.engine} · {humanize(r.outcome)}</small></div>
                  <b>{num(r.count)}</b>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="ad-row">
        {data.filter.stateCode === 'ALL' ? (
          <Panel title="State Comparison">
            <StateComparison rows={data.byState} />
          </Panel>
        ) : (
          <Panel title="Deed Type Mix">
            <HorizontalBars rows={data.transactionsByDeedType.map((d, i) => ({ label: d.name, value: num(d.count), color: ['#0f2a4a', '#b8923d', '#2e6fb0', '#1c7a4e', '#7a9cc6', '#d9a75a', '#5f6670', '#16304f'][i % 8] }))} empty="No transactions in this period." />
          </Panel>
        )}
        <Panel title="Top Sub-Registrar Offices">
          <OfficeTable rows={data.byOffice} showState={data.filter.stateCode === 'ALL'} />
        </Panel>
      </div>

      <Panel title="Recent Failures & Exceptions" actions={<span className="muted">Latest 10 in period</span>}>
        <RecentIssues rows={data.recentIssues} />
      </Panel>
      <p className="ad-footnote">Rule check findings are advisory in the pilot; counts reflect recorded engine results, workflow audit events and VAO objections within the selected window. Generated {new Date(data.generatedAt).toLocaleString('en-IN')}.</p>
    </>
  )
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="ad-legend">
      {items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>)}
    </div>
  )
}

function TrendChart({ points, bucket }: { points: TrendPoint[]; bucket: 'HOUR' | 'DAY' }) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 720
  const height = 260
  const pad = { top: 16, right: 16, bottom: 30, left: 40 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = Math.max(1, ...points.flatMap((p) => SERIES.map((s) => num(p[s.key]))))
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4)
  const x = (i: number) => pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => pad.top + innerH - (v / niceMax) * innerH
  const labelEvery = Math.max(1, Math.ceil(points.length / 8))
  const ticks = [0, 1, 2, 3, 4].map((t) => (niceMax / 4) * t)

  if (points.length === 0) return <p className="muted">No activity in this period.</p>

  const line = (key: (typeof SERIES)[number]['key']) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(num(p[key])).toFixed(1)}`).join(' ')
  const area = `${line('transactions')} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
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
        {SERIES.map((s) => <path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth={s.key === 'transactions' ? 2.4 : 1.8} strokeDasharray={s.key === 'failures' ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="ad-hoverline" /> : null}
        {hover !== null ? SERIES.map((s) => <circle key={s.key} cx={x(hover)} cy={y(num(points[hover][s.key]))} r={3.5} fill="#fff" stroke={s.color} strokeWidth={2} />) : null}
        {points.map((p, i) => {
          const step = points.length <= 1 ? innerW : innerW / (points.length - 1)
          return <rect key={p.bucket} x={x(i) - step / 2} y={pad.top} width={step} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
        })}
      </svg>
      {active !== null ? (
        <div className="ad-tooltip">
          <strong>{bucket === 'HOUR' ? `${formatBucket(active.bucket, 'DAY')} ${formatBucket(active.bucket, 'HOUR')}` : formatBucket(active.bucket, 'DAY')}</strong>
          {SERIES.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}<b>{num(active[s.key])}</b></span>)}
        </div>
      ) : null}
    </div>
  )
}

function Donut({ rows, centerLabel }: { rows: { label: string; value: number; color: string }[]; centerLabel: string }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const segments = useMemo(() => {
    const lengths = rows.map((r) => (total === 0 ? 0 : (r.value / total) * circumference))
    return rows.map((r, i) => ({ ...r, length: lengths[i], offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0) }))
  }, [rows, total, circumference])

  if (total === 0) return <p className="muted">No transactions in this period.</p>

  return (
    <div className="ad-donut">
      <svg viewBox="0 0 200 200" role="img" aria-label="Transactions by status">
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
          <li key={r.label}><i style={{ background: r.color }} /><span>{humanize(r.label)}</span><b>{r.value}</b><small>{percent(r.value, total)}</small></li>
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

function OfficeTable({ rows, showState }: { rows: DashboardData['byOffice']; showState: boolean }) {
  const max = Math.max(1, ...rows.map((r) => num(r.transactions)))
  if (rows.length === 0) return <p className="muted">No transactions in this period.</p>
  return (
    <table className="grid ad-office">
      <thead><tr><th>Office</th>{showState ? <th>State</th> : null}<th>Volume</th><th>Registered</th><th>Exceptions</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.stateCode}-${r.sroCode}`}>
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

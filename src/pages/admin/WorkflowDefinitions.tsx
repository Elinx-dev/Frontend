import { useMemo, useState } from 'react'

import { get, put } from '../../api'
import { Banner, Panel } from '../../ui'
import { errorText, formatDate, humanize, useAdminSnapshot, type WorkflowDefinition } from './adminConfig'
import { AdminHeader, SearchBox, Segmented, StatCard } from './shared'

interface WorkflowStage {
  seq: number
  stage_code: string
  stage_label: string
  status_on_enter?: string | null
  owner_role?: string | null
  optional: boolean
  skip_condition?: string | null
}

interface WorkflowTransition {
  from_status: string
  to_status: string
  action_code: string
  allowed_roles?: string[] | null
  requires_reason: boolean
}

interface WorkflowDetail {
  workflowId: number
  workflowCode: string
  version: number
  stages: WorkflowStage[]
  transitions: WorkflowTransition[]
}

const STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'RETIRED', label: 'Retired' },
] as const

const FILTERS = [{ value: 'ALL', label: 'All' }, ...STATUSES] as const

export default function WorkflowDefinitions() {
  const { snapshot, error: loadError, reload } = useAdminSnapshot()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('ALL')
  const [info, setInfo] = useState('')

  const workflows = useMemo(() => snapshot?.workflows ?? [], [snapshot])
  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const byDeed = new Map<string, WorkflowDefinition[]>()
    for (const w of workflows) {
      if (filter !== 'ALL' && w.status !== filter) continue
      if (term.length > 0 && ![w.deed_type_code, humanize(w.deed_type_code), w.workflow_code].some((v) => v.toLowerCase().includes(term))) continue
      byDeed.set(w.deed_type_code, [...(byDeed.get(w.deed_type_code) ?? []), w])
    }
    return [...byDeed.entries()]
  }, [workflows, search, filter])

  const count = (status: string) => workflows.filter((w) => w.status === status).length

  return (
    <div className="dashboard-page adm-page">
      <AdminHeader
        title="Workflow definitions"
        stateName={snapshot?.state?.state_name}
        subtitle="Versioned workflows per deed type. Publish, retire or keep a version as draft."
      />
      <Banner kind="error" message={loadError} />
      <Banner kind="success" message={info} />

      <div className="adm-stats">
        <StatCard label="Deed types" value={new Set(workflows.map((w) => w.deed_type_code)).size} />
        <StatCard label="Published" value={count('PUBLISHED')} tone="success" />
        <StatCard label="Draft" value={count('DRAFT')} tone="gold" />
        <StatCard label="Retired" value={count('RETIRED')} tone="danger" />
      </div>

      <Panel title="Workflows by deed type" actions={<span className="muted">{groups.length} deed {groups.length === 1 ? 'type' : 'types'} shown</span>}>
        <div className="adm-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search deed type or workflow code" />
          <div className="ad-filter">
            <span>Status</span>
            <Segmented label="Workflow status filter" value={filter} options={FILTERS} onChange={setFilter} />
          </div>
        </div>
        <p className="adm-note">Stages and transitions are versioned in the database. To change a published workflow, create a new version and publish it; the stages shown are those of the published version.</p>
        {snapshot === null && loadError.length === 0 ? <p className="muted">Loading workflows…</p> : groups.length === 0 ? (
          <p className="adm-empty">No workflows match these filters.</p>
        ) : (
          <div className="adm-wf-list">
            {groups.map(([deed, versions]) => (
              <DeedWorkflows key={deed} deed={deed} versions={versions} onSaved={async (message) => { setInfo(message); await reload() }} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function DeedWorkflows({ deed, versions, onSaved }: { deed: string; versions: WorkflowDefinition[]; onSaved: (message: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<WorkflowDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const published = versions.find((v) => v.status === 'PUBLISHED')

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && detail === null && published !== undefined) {
      try {
        setDetail(await get<WorkflowDetail>(`/api/config/workflows/${encodeURIComponent(deed)}`))
        setDetailError('')
      } catch (e) {
        setDetailError(errorText(e))
      }
    }
  }

  return (
    <article className="adm-wf">
      <header className="adm-wf-head">
        <div>
          <h3>{humanize(deed)}</h3>
          <span className="cell-subtext">{deed} · {versions.length} {versions.length === 1 ? 'version' : 'versions'}</span>
        </div>
        {published !== undefined ? <span className="adm-badge on">v{published.version} published</span> : <span className="adm-badge">No published version</span>}
        <button type="button" className="link" aria-expanded={open} onClick={() => void toggle()} disabled={published === undefined}>{open ? 'Hide stages' : 'View stages'}</button>
      </header>
      <table className="grid adm-wf-table">
        <thead><tr><th>Version</th><th>Workflow</th><th>Effective</th><th>Published</th><th>Status</th><th /></tr></thead>
        <tbody>{versions.map((w) => <VersionRow key={`${w.id}:${w.status}`} workflow={w} onSaved={onSaved} />)}</tbody>
      </table>
      {open ? (
        <div className="adm-wf-stages">
          <Banner kind="error" message={detailError} />
          {detail === null && detailError.length === 0 ? <p className="muted">Loading stages…</p> : null}
          {detail !== null ? (
            <ol>
              {detail.stages.map((s) => (
                <li key={s.seq}>
                  <span className="adm-step">{s.seq}</span>
                  <div>
                    <strong>{s.stage_label}</strong>
                    <span className="cell-subtext">
                      {s.owner_role ? humanize(s.owner_role) : 'Any role'}
                      {s.status_on_enter ? ` · enters ${humanize(s.status_on_enter)}` : ''}
                      {s.optional ? ' · optional' : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
          {detail !== null ? <p className="muted">{detail.transitions.length} transitions defined in {detail.workflowCode} v{detail.version}.</p> : null}
        </div>
      ) : null}
    </article>
  )
}

function VersionRow({ workflow, onSaved }: { workflow: WorkflowDefinition; onSaved: (message: string) => Promise<void> }) {
  const [status, setStatus] = useState(workflow.status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = status !== workflow.status

  const save = async () => {
    if (status === 'RETIRED' && !window.confirm(`Retire ${workflow.workflow_code} v${workflow.version} for ${humanize(workflow.deed_type_code)}?`)) return
    setSaving(true)
    setError('')
    try {
      await put(`/api/config/admin/workflows/${workflow.id}`, { status })
      await onSaved(`${humanize(workflow.deed_type_code)} v${workflow.version} set to ${humanize(status)}.`)
    } catch (e) {
      setError(errorText(e))
      setSaving(false)
    }
  }

  return (
    <tr className={dirty ? 'dirty' : undefined}>
      <td><strong>v{workflow.version}</strong></td>
      <td>{workflow.workflow_code}</td>
      <td>{formatDate(workflow.effective_from)}<span className="cell-subtext">{workflow.effective_to === undefined || workflow.effective_to === null ? 'No end date' : `until ${formatDate(workflow.effective_to)}`}</span></td>
      <td>{formatDate(workflow.published_at)}</td>
      <td>
        <Segmented label={`Status of version ${workflow.version}`} value={status} options={STATUSES} onChange={setStatus} />
        {error.length > 0 ? <span className="field-error">{error}</span> : null}
      </td>
      <td className="num">
        {dirty ? (
          <div className="adm-row-actions">
            <button type="button" onClick={() => setStatus(workflow.status)} disabled={saving}>Cancel</button>
            <button type="button" className="primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        ) : null}
      </td>
    </tr>
  )
}

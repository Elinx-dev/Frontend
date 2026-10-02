import { useMemo, useState } from 'react'

import { put } from '../../api'
import { Banner, Panel } from '../../ui'
import { errorText, humanize, useAdminSnapshot } from './adminConfig'
import { AdminHeader, SaveBar, SearchBox, Segmented, StatCard, Switch } from './shared'

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'ON', label: 'On' },
  { value: 'OFF', label: 'Off' },
] as const

export default function FeatureFlags() {
  const { snapshot, error: loadError, reload, stateCode, centralAdmin, selectState } = useAdminSnapshot()
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('ALL')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const flags = useMemo(() => snapshot?.featureFlags ?? [], [snapshot])
  const valueOf = (code: string, saved: boolean) => pending[code] ?? saved
  const changes = Object.keys(pending)

  const visible = flags.filter((f) => {
    const term = search.trim().toLowerCase()
    const on = valueOf(f.flag_code, f.enabled)
    return (filter === 'ALL' || (filter === 'ON') === on)
      && (term.length === 0 || f.flag_code.toLowerCase().includes(term) || humanize(f.flag_code).toLowerCase().includes(term)
        || (f.description ?? '').toLowerCase().includes(term))
  })

  const toggle = (code: string, saved: boolean, next: boolean) => {
    setInfo('')
    setPending((current) => {
      const copy = { ...current }
      if (next === saved) delete copy[code]
      else copy[code] = next
      return copy
    })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    const done: string[] = []
    try {
      for (const code of changes) {
        await put(`/api/config/admin/feature-flags/${encodeURIComponent(code)}`, { enabled: pending[code] })
        done.push(code)
      }
      setPending({})
      setInfo(`${done.length} feature ${done.length === 1 ? 'flag' : 'flags'} updated.`)
    } catch (e) {
      setPending((current) => Object.fromEntries(Object.entries(current).filter(([code]) => !done.includes(code))))
      setError(errorText(e))
    } finally {
      setSaving(false)
      await reload()
    }
  }

  return (
    <div className="dashboard-page adm-page">
      <AdminHeader
        title="Feature flags"
        stateName={snapshot?.state?.state_name}
        centralAdmin={centralAdmin}
        stateCode={stateCode}
        states={snapshot?.states}
        onStateChange={(nextState) => {
          setPending({})
          selectState(nextState)
        }}
        subtitle="Switch platform behaviours on or off. Changes apply as soon as they are saved."
      />
      <Banner kind="error" message={loadError || error} />
      <Banner kind="success" message={info} />

      <div className="adm-stats">
        <StatCard label="Flags" value={flags.length} />
        <StatCard label="Switched on" value={flags.filter((f) => f.enabled).length} tone="success" />
        <StatCard label="Switched off" value={flags.filter((f) => !f.enabled).length} tone="warning" />
      </div>

      <Panel title="Platform flags" actions={<span className="muted">{visible.length} of {flags.length} shown</span>}>
        <div className="adm-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search flags by name or description" />
          <div className="ad-filter">
            <span>Show</span>
            <Segmented label="Flag filter" value={filter} options={FILTERS} onChange={setFilter} />
          </div>
        </div>
        {snapshot === null && loadError.length === 0 ? <p className="muted">Loading feature flags…</p> : visible.length === 0 ? (
          <p className="adm-empty">No feature flags match these filters.</p>
        ) : (
          <ul className="adm-flag-list">
            {visible.map((f) => {
              const on = valueOf(f.flag_code, f.enabled)
              const changed = f.flag_code in pending
              return (
                <li key={f.id} className={changed ? 'dirty' : undefined}>
                  <div>
                    <strong>{humanize(f.flag_code)}{changed ? <b className="adm-dirty">Unsaved</b> : null}</strong>
                    <p>{f.description ?? 'No description.'}</p>
                    <code>{f.flag_code}</code>
                  </div>
                  <Switch label={humanize(f.flag_code)} checked={on} disabled={saving} onChange={(next) => toggle(f.flag_code, f.enabled, next)} />
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <SaveBar count={changes.length} saving={saving} onDiscard={() => setPending({})} onSave={() => void save()} />
    </div>
  )
}

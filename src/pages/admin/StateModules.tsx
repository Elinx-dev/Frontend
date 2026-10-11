import { useState } from 'react'

import { put } from '../../api'
import { Banner } from '../../ui'
import { DEPARTMENTS, errorText, formatDate, humanize, useAdminSnapshot, type ModuleConfig } from './adminConfig'
import { AdminHeader, Segmented, StatCard, Switch } from './shared'

interface ModuleDraft {
  enabled: boolean
  mode: string
  ownerDepartment: string
  slaDays: string
  notes: string
}

const MODULE_INFO: Record<string, string> = {
  REGISTRATION: 'Deed intake, fee payment and registration at Sub-Registrar offices.',
  SURVEY: 'Boundary survey and FMB updates for sub-division transactions.',
  REVENUE: 'VAO verification, objections and Tahsildar mutation orders.',
  RULE_CHECK: 'Automated rule engines run against every transaction.',
  BLOCKCHAIN: 'Anchoring transaction evidence on the Besu network.',
  PUBLIC_VIEW: 'Citizen-facing public property view.',
}

const MODES = [
  { value: 'FACILITATE', label: 'Facilitate', help: 'SLATE drives this step: officers complete it inside the application.' },
  { value: 'RECORD', label: 'Record', help: "The department's own system performs this step; SLATE records the outcome." },
  { value: 'DISABLED', label: 'Disabled', help: 'This step is not used in this state.' },
] as const

const toDraft = (m: ModuleConfig): ModuleDraft => ({
  enabled: m.enabled,
  mode: m.mode,
  ownerDepartment: m.owner_department ?? '',
  slaDays: m.sla_days === undefined || m.sla_days === null ? '' : String(m.sla_days),
  notes: m.notes ?? '',
})

const same = (a: ModuleDraft, b: ModuleDraft) =>
  a.enabled === b.enabled && a.mode === b.mode && a.ownerDepartment === b.ownerDepartment
  && a.slaDays.trim() === b.slaDays.trim() && a.notes.trim() === b.notes.trim()

export default function StateModules() {
  const { snapshot, error: loadError, reload, stateCode, centralAdmin, selectState } = useAdminSnapshot()
  const [info, setInfo] = useState('')
  const modules = snapshot?.modules ?? []

  return (
    <div className="dashboard-page adm-page">
      <AdminHeader
        title="State modules"
        stateName={snapshot?.state?.state_name}
        centralAdmin={centralAdmin}
        stateCode={stateCode}
        states={snapshot?.states}
        onStateChange={selectState}
        subtitle="Choose how each platform module runs, who owns it and its service level."
      />
      <Banner kind="error" message={loadError} />
      <Banner kind="success" message={info} />

      <div className="adm-stats">
        <StatCard label="Modules" value={modules.length} />
        <StatCard label="Facilitated" value={modules.filter((m) => m.enabled && m.mode === 'FACILITATE').length} tone="success" />
        <StatCard label="Record only" value={modules.filter((m) => m.enabled && m.mode === 'RECORD').length} tone="gold" />
        <StatCard label="Off or disabled" value={modules.filter((m) => !m.enabled || m.mode === 'DISABLED').length} tone="danger" />
      </div>

      {snapshot === null && loadError.length === 0 ? <p className="muted">Loading modules…</p> : null}
      <div className="adm-card-grid">
        {modules.map((m) => (
          <ModuleCard key={`${stateCode}:${m.id}:${JSON.stringify(m)}`} module={m} onSaved={async (message) => { setInfo(message); await reload() }} />
        ))}
      </div>
    </div>
  )
}

function ModuleCard({ module, onSaved }: { module: ModuleConfig; onSaved: (message: string) => Promise<void> }) {
  const [draft, setDraft] = useState<ModuleDraft>(() => toDraft(module))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const original = toDraft(module)
  const dirty = !same(draft, original)

  const change = <K extends keyof ModuleDraft>(key: K, value: ModuleDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const slaInvalid = draft.slaDays.trim().length > 0 && !/^\d{1,3}$/.test(draft.slaDays.trim())
  const mode = MODES.find((m) => m.value === draft.mode)

  const save = async () => {
    if (slaInvalid) return
    setSaving(true)
    setError('')
    try {
      await put(`/api/config/admin/modules/${encodeURIComponent(module.module)}`, {
        enabled: draft.enabled,
        mode: draft.mode,
        ownerDepartment: draft.ownerDepartment.length === 0 ? null : draft.ownerDepartment,
        slaDays: draft.slaDays.trim().length === 0 ? null : Number(draft.slaDays.trim()),
        notes: draft.notes.trim().length === 0 ? null : draft.notes.trim(),
      })
      await onSaved(`${humanize(module.module)} module saved.`)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`panel adm-card${draft.enabled ? '' : ' muted-card'}${dirty ? ' dirty' : ''}`}>
      <header className="adm-card-head">
        <div>
          <h2>{humanize(module.module)}</h2>
          <p>{MODULE_INFO[module.module] ?? module.module}</p>
        </div>
        <Switch label={`${humanize(module.module)} enabled`} checked={draft.enabled} onChange={(v) => change('enabled', v)} />
      </header>
      <div className="adm-card-body">
        <Banner kind="error" message={error} />
        <div className="field">
          <span>Operating mode</span>
          <Segmented label={`${humanize(module.module)} mode`} value={draft.mode} options={MODES} onChange={(v) => change('mode', v)} />
          {mode !== undefined ? <small className="adm-hint">{mode.help}</small> : null}
        </div>
        <div className="form-grid two">
          <label className="field">
            <span>Owner department</span>
            <select value={draft.ownerDepartment} onChange={(e) => change('ownerDepartment', e.target.value)}>
              <option value="">Not assigned</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{humanize(d)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Service level (SLA)</span>
            <div className="adm-input-suffix">
              <input inputMode="numeric" value={draft.slaDays} placeholder="No SLA" aria-invalid={slaInvalid} onChange={(e) => change('slaDays', e.target.value)} />
              <em>days</em>
            </div>
            {slaInvalid ? <span className="field-error">Enter whole days (0–999).</span> : null}
          </label>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={draft.notes} placeholder="Add context for other administrators" onChange={(e) => change('notes', e.target.value)} />
        </label>
      </div>
      <footer className="adm-card-foot">
        <span className="muted">{dirty ? <b className="adm-dirty">Unsaved changes</b> : `Effective from ${formatDate(module.effective_from)}`}</span>
        <div>
          <button type="button" onClick={() => { setDraft(original); setError('') }} disabled={!dirty || saving}>Reset</button>
          <button type="button" className="primary" onClick={() => void save()} disabled={!dirty || saving || slaInvalid}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </footer>
    </section>
  )
}

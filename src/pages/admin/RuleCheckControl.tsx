import { useMemo, useState } from 'react'

import { put } from '../../api'
import { Banner, Panel } from '../../ui'
import { errorText, humanize, useAdminSnapshot, type RuleEnginePolicy } from './adminConfig'
import { AdminHeader, SaveBar, StatCard, Switch } from './shared'

const OUTCOMES = ['NO_DISCREPANCY_DETECTED', 'NOT_CHECKED', 'REVIEW_REQUIRED', 'DISCREPANCY_DETECTED']

const ENGINE_LABELS: Record<string, string> = {
  EC: 'Encumbrance Certificate (EC) API',
  REVENUE_OWNERSHIP: 'Revenue / Patta ownership API',
}

const OUTCOME_HELP: Record<string, string> = {
  NO_DISCREPANCY_DETECTED: 'Everything matched. Always allowed to proceed.',
  NOT_CHECKED: 'The API was unavailable or the data was incomplete, so nothing was compared.',
  REVIEW_REQUIRED: 'Something could not be confirmed and needs a manual review.',
  DISCREPANCY_DETECTED: 'The API data contradicts the transaction, e.g. an open mortgage or an owner mismatch.',
}

type Draft = { allowedOutcomes: string[]; blockingReasonCodes: string[] }

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((value) => b.includes(value))

export default function RuleCheckControl() {
  const { snapshot, error: loadError, reload, stateCode, centralAdmin, selectState } = useAdminSnapshot()
  const [pending, setPending] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const engines = useMemo(() => snapshot?.ruleEngines ?? [], [snapshot])
  const outcomes = snapshot?.ruleCheckCatalog?.outcomes ?? OUTCOMES
  const reasonCodes = snapshot?.ruleCheckCatalog?.reasonCodes ?? {}
  const changes = Object.keys(pending)

  const draftOf = (engine: RuleEnginePolicy): Draft =>
    pending[engine.engine] ?? { allowedOutcomes: engine.allowedOutcomes, blockingReasonCodes: engine.blockingReasonCodes }

  const update = (engine: RuleEnginePolicy, next: Draft) => {
    setInfo('')
    setPending((current) => {
      const copy = { ...current }
      if (sameSet(next.allowedOutcomes, engine.allowedOutcomes) && sameSet(next.blockingReasonCodes, engine.blockingReasonCodes)) {
        delete copy[engine.engine]
      } else {
        copy[engine.engine] = next
      }
      return copy
    })
  }

  const toggle = (list: string[], value: string, on: boolean) =>
    on ? (list.includes(value) ? list : [...list, value]) : list.filter((item) => item !== value)

  const save = async () => {
    setSaving(true)
    setError('')
    const done: string[] = []
    try {
      for (const engine of changes) {
        await put(`/api/config/admin/rule-engines/${encodeURIComponent(engine)}`, pending[engine])
        done.push(engine)
      }
      setPending({})
      setInfo(`Rule check control updated for ${done.map((engine) => ENGINE_LABELS[engine] ?? engine).join(' and ')}.`)
    } catch (e) {
      setPending((current) => Object.fromEntries(Object.entries(current).filter(([engine]) => !done.includes(engine))))
      setError(errorText(e))
    } finally {
      setSaving(false)
      await reload()
    }
  }

  return (
    <div className="dashboard-page adm-page">
      <AdminHeader
        title="Rule check control"
        stateName={snapshot?.state?.state_name}
        centralAdmin={centralAdmin}
        stateCode={stateCode}
        states={snapshot?.states}
        onStateChange={(nextState) => {
          setPending({})
          selectState(nextState)
        }}
        subtitle="Choose which rule check results let a transaction continue past the Rule checks step. Any other result stops the transaction there, on Initiate Transaction and Transaction Detail. Changes apply as soon as they are saved."
      />
      <Banner kind="error" message={loadError || error} />
      <Banner kind="success" message={info} />

      <div className="adm-stats">
        {engines.map((engine) => (
          <StatCard
            key={engine.engine}
            label={`${humanize(engine.engine)} · allowed to proceed`}
            value={`${engine.allowedOutcomes.length} of ${outcomes.length}`}
            tone={engine.allowedOutcomes.length === outcomes.length ? 'warning' : 'navy'}
          />
        ))}
      </div>

      {snapshot === null && loadError.length === 0 ? <p className="muted">Loading rule check control…</p> : null}
      {snapshot !== null && engines.length === 0 ? <p className="adm-empty">No rule engines are configured for this state.</p> : null}

      {engines.map((engine) => {
        const draft = draftOf(engine)
        const changed = engine.engine in pending
        const reasons = Array.from(new Set([...(reasonCodes[engine.engine] ?? []), ...draft.blockingReasonCodes]))
        return (
          <Panel
            key={engine.engine}
            title={ENGINE_LABELS[engine.engine] ?? humanize(engine.engine)}
            actions={changed ? <b className="adm-dirty">Unsaved</b> : <code>{engine.engine}</code>}
          >
            <h3 className="adm-rule-heading">Outcomes allowed to proceed</h3>
            <ul className="adm-flag-list">
              {outcomes.map((outcome) => {
                const allowed = draft.allowedOutcomes.includes(outcome)
                const locked = outcome === 'NO_DISCREPANCY_DETECTED'
                return (
                  <li key={outcome}>
                    <div>
                      <strong>
                        {humanize(outcome)}
                        <b className={allowed ? 'adm-rule-tag proceed' : 'adm-rule-tag stop'}>{allowed ? 'Proceeds' : 'Stops transaction'}</b>
                      </strong>
                      <p>{OUTCOME_HELP[outcome] ?? ''}</p>
                      <code>{outcome}</code>
                    </div>
                    <Switch
                      label={`${humanize(outcome)} allowed to proceed`}
                      checked={allowed}
                      disabled={saving || locked}
                      onChange={(next) => update(engine, { ...draft, allowedOutcomes: toggle(draft.allowedOutcomes, outcome, next) })}
                    />
                  </li>
                )
              })}
            </ul>

            <h3 className="adm-rule-heading">
              Always stop on these reasons <span className="muted">even when their outcome is allowed · {draft.blockingReasonCodes.length} selected</span>
            </h3>
            <div className="adm-role-grid">
              {reasons.map((code) => {
                const selected = draft.blockingReasonCodes.includes(code)
                return (
                  <label key={code} className={selected ? 'adm-role selected' : 'adm-role'}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={saving}
                      onChange={() => update(engine, { ...draft, blockingReasonCodes: toggle(draft.blockingReasonCodes, code, !selected) })}
                    />
                    <span>
                      <strong>{humanize(code)}</strong>
                      <small>{code}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </Panel>
        )
      })}

      <SaveBar count={changes.length} saving={saving} onDiscard={() => setPending({})} onSave={() => void save()} />
    </div>
  )
}

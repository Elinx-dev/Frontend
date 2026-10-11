import type { ReactNode } from 'react'

export function AdminHeader({ title, subtitle, stateName, actions, centralAdmin = false, stateCode, states = [], onStateChange }: {
  title: string
  subtitle: string
  stateName?: string
  actions?: ReactNode
  centralAdmin?: boolean
  stateCode?: string
  states?: { code: string; name: string }[]
  onStateChange?: (stateCode: string) => void
}) {
  return (
    <div className="dashboard-titlebar">
      <div>
        <span className="eyebrow">{centralAdmin ? 'Central administration · State configuration' : 'State administration · Users and configuration'}</span>
        <h1>{title}</h1>
        <p className="ad-subtitle">{stateName !== undefined && stateName.length > 0 ? `${stateName} · ` : ''}{subtitle}</p>
      </div>
      {actions !== undefined || (centralAdmin && states.length > 0) ? (
        <div className="dashboard-actions">
          {centralAdmin && states.length > 0 ? (
            <label className="ad-filter">
              <span>State</span>
              <select value={stateCode ?? ''} onChange={(event) => onStateChange?.(event.target.value)}>
                {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
              </select>
            </label>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function Switch({ checked, onChange, label, disabled = false }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={checked ? 'adm-switch on' : 'adm-switch'}
      onClick={() => onChange(!checked)}
    >
      <span className="adm-switch-track"><span className="adm-switch-thumb" /></span>
      <span className="adm-switch-text">{checked ? 'On' : 'Off'}</span>
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: NoInfer<T>) => void
  label: string
}) {
  return (
    <div className="ad-segment" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? 'active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="adm-search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value.length > 0 ? <button type="button" className="adm-search-clear" aria-label="Clear search" onClick={() => onChange('')}>×</button> : null}
    </label>
  )
}

export function StatCard({ label, value, tone = 'navy' }: { label: string; value: number | string; tone?: 'navy' | 'success' | 'warning' | 'danger' | 'gold' }) {
  return (
    <div className={`adm-stat ad-tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function SaveBar({ count, saving, onDiscard, onSave }: {
  count: number
  saving: boolean
  onDiscard: () => void
  onSave: () => void
}) {
  if (count === 0) return null
  return (
    <div className="adm-savebar" role="status">
      <span><b>{count}</b> unsaved {count === 1 ? 'change' : 'changes'}</span>
      <div>
        <button type="button" onClick={onDiscard} disabled={saving}>Discard</button>
        <button type="button" className="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  )
}

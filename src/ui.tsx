import type { ChangeEvent, ReactNode } from 'react'

import type { Row } from './types'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="login-brand-inner">
          <div className="login-mark">S</div>
          <div className="login-brand-text">
            <div className="login-wordmark">SLATE</div>
            <div className="login-tagline">Secured Land Asset Token Exchange</div>
          </div>
          <div className="login-rule" />
        </div>
      </aside>
      <div className="login-form-side">{children}</div>
    </div>
  )
}

export function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        <div className="panel-actions">{actions}</div>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  options,
  required = false,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
}) {
  const handle = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(e.target.value)
  return (
    <label className="field">
      <span>
        {label}
        {required ? <b className="req"> *</b> : null}
      </span>
      {options === undefined ? (
        <input type={type} value={value} onChange={handle} placeholder={placeholder} />
      ) : (
        <select value={value} onChange={handle}>
          <option value="">— select —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </label>
  )
}

export function DataTable({
  rows,
  columns,
  empty = 'Nothing here yet.',
  onRowClick,
}: {
  rows: Row[]
  columns: { key: string; label: string }[]
  empty?: string
  onRowClick?: (row: Row) => void
}) {
  if (rows.length === 0) {
    return <p className="muted">{empty}</p>
  }
  return (
    <table className="grid">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={index}
            onClick={onRowClick === undefined ? undefined : () => onRowClick(row)}
            className={onRowClick === undefined ? undefined : 'clickable'}
          >
            {columns.map((c) => (
              <td key={c.key}>{formatCell(row[c.key])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status.toLowerCase().replace(/_/g, '-')}`}>{status}</span>
}

export function Banner({ kind, message }: { kind: 'error' | 'info' | 'success'; message: string }) {
  if (message.length === 0) return null
  return <div className={`banner banner-${kind}`}>{message}</div>
}

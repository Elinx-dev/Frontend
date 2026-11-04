import { useState, type ChangeEvent, type ReactNode } from 'react'

import type { Row } from './types'
import loginArt from './assets/login-art.jpg'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <aside
        className="login-art"
        role="img"
        aria-label="SLATE, Secured Land Asset Token Exchange. Secure. Verify. Record."
        style={{ backgroundImage: `url(${loginArt})` }}
      />
      <div className="login-form-side">{children}</div>
    </div>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <path d="M3 3l18 18" />}
    </svg>
  )
}

export function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      {title.length > 0 || actions !== undefined ? (
        <header className="panel-head">
          {title.length > 0 ? <h2>{title}</h2> : null}
          {actions !== undefined ? <div className="panel-actions">{actions}</div> : null}
        </header>
      ) : null}
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
  readOnly = false,
  icon,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  readOnly?: boolean
  icon?: ReactNode
}) {
  const [revealed, setRevealed] = useState(false)
  const handle = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(e.target.value)
  return (
    <label className="field">
      <span>
        {label}
        {required ? <b className="req"> *</b> : null}
      </span>
      {options === undefined && icon !== undefined ? (
        <div className="field-input">
          {icon}
          <input type={type === 'password' && revealed ? 'text' : type} value={value} onChange={handle} placeholder={placeholder} readOnly={readOnly} />
          {type === 'password' ? (
            <button
              type="button"
              className="field-reveal"
              aria-label={revealed ? 'Hide password' : 'Show password'}
              onClick={(e) => {
                e.preventDefault()
                setRevealed(!revealed)
              }}
            >
              <EyeIcon open={revealed} />
            </button>
          ) : null}
        </div>
      ) : options === undefined ? (
        <input type={type} value={value} onChange={handle} placeholder={placeholder} readOnly={readOnly} />
      ) : (
        <select value={value} onChange={handle} disabled={readOnly}>
          <option value="">Select</option>
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
  columns: { key: string; label: string; className?: string; render?: (row: Row) => ReactNode }[]
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
            <th key={c.key} className={c.className}>{c.label}</th>
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
              <td key={c.key} className={c.className}>{c.render === undefined ? formatCell(row[c.key]) : c.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '-'
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

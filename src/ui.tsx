import { useState, type ChangeEvent, type ReactNode } from 'react'

import type { Row } from './types'
import slateLogo from './assets/slate-logo.png'
import slateLogoLight from './assets/slate-logo-light.png'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <aside className="login-brand">
        <svg className="login-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="login-navy" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0" stopColor="#0a1628" />
              <stop offset="0.55" stopColor="#0f2a4a" />
              <stop offset="1" stopColor="#0d3b45" />
            </linearGradient>
            <linearGradient id="login-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2fa36f" stopOpacity="0.95" />
              <stop offset="1" stopColor="#1c7a4e" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path d="M0,0 H100 C84,28 74,62 66,100 H0 Z" fill="url(#login-edge)" />
          <path d="M0,0 H93 C77,28 67,62 59,100 H0 Z" fill="url(#login-navy)" />
        </svg>
        <div className="login-brand-inner">
          <img className="login-logo" src={slateLogoLight} alt="SLATE, Secured Land Asset Token Exchange" />
          <div className="login-rule" />
          <h2 className="login-headline">Secure. Verify. Record.</h2>
          <p className="login-lead">A trusted blockchain layer for land transactions and ownership.</p>
        </div>
        <ParcelArt />
      </aside>
      <div className="login-form-side">
        <img className="login-mobile-logo" src={slateLogo} alt="SLATE, Secured Land Asset Token Exchange" />
        {children}
      </div>
    </div>
  )
}

function ParcelArt() {
  const rows = [0, 1, 2, 3, 4, 5, 6]
  const cols = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]
  const y = (i: number) => 40 + i * i * 6 + i * 14
  return (
    <svg className="login-parcel" viewBox="0 0 600 340" aria-hidden="true">
      <defs>
        <radialGradient id="parcel-glow" cx="0.45" cy="0.55" r="0.5">
          <stop offset="0" stopColor="#2fa36f" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2fa36f" stopOpacity="0" />
        </radialGradient>
        <filter id="parcel-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse cx="270" cy="200" rx="260" ry="120" fill="url(#parcel-glow)" />
      <g stroke="#5fc79a" strokeOpacity="0.22" strokeWidth="1" fill="none">
        {rows.map((i) => <line key={`r${i}`} x1="0" y1={y(i)} x2="600" y2={y(i) - 40} />)}
        {cols.map((c) => <line key={`c${c}`} x1={300 + c * 22} y1="20" x2={300 + c * 110} y2="340" />)}
        <path d="M0 120 C120 90 220 140 340 110 S520 70 600 90" strokeOpacity="0.3" />
        <path d="M0 150 C140 120 240 170 360 140 S520 100 600 120" strokeOpacity="0.18" />
      </g>
      <polygon points="150,230 330,170 400,225 220,295" fill="#2fa36f" fillOpacity="0.18" />
      <polygon points="150,230 330,170 400,225 220,295" fill="none" stroke="#7ff0bd" strokeWidth="6" strokeOpacity="0.45" filter="url(#parcel-blur)" />
      <polygon points="150,230 330,170 400,225 220,295" fill="none" stroke="#c9ffe6" strokeWidth="2" />
      <g transform="translate(275 150)">
        <ellipse cx="0" cy="78" rx="16" ry="5" fill="#2fa36f" fillOpacity="0.5" />
        <path d="M0 76 C-6 60 -22 46 -22 28 A22 22 0 1 1 22 28 C22 46 6 60 0 76 Z" fill="#ffffff" />
        <circle cx="0" cy="28" r="8" fill="#1c7a4e" />
      </g>
    </svg>
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

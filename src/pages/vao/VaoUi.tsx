import type { ReactNode } from 'react'

import { VAO_PORTAL } from './portal'
import type { Portal } from './portal'
import type { VaoRecord } from './vaoShared'

export function StagePill({ record, portal = VAO_PORTAL }: { record: Pick<VaoRecord, 'stage' | 'stage_label'>; portal?: Portal }) {
  return <span className={`vao-stage vao-stage-${portal.tones[record.stage] ?? 'waiting'}`}>{record.stage_label}</span>
}

export function CheckIns({ record, portal = VAO_PORTAL }: { record: VaoRecord; portal?: Portal }) {
  const self = portal.selfCheckin(record)
  return (
    <span className="vao-checkins">
      <span className={self == null ? 'vao-check' : 'vao-check done'}>
        {self == null ? '' : '✓ '}You
      </span>
    </span>
  )
}

export function VaoHeading({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="vao-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions === undefined ? null : <div className="vao-heading-actions">{actions}</div>}
    </div>
  )
}

export function VaoModal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="vao-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={wide ? 'vao-modal wide' : 'vao-modal'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="vao-modal-head">
          <h2>{title}</h2>
          <button className="vao-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="vao-modal-body">{children}</div>
      </div>
    </div>
  )
}

export function UlpinCell({ record }: { record: Pick<VaoRecord, 'ulpin' | 'property_ref' | 'txn_ref'> }) {
  return (
    <div className="vao-ulpin">
      <strong>{record.ulpin ?? record.property_ref}</strong>
      <small>{record.txn_ref}</small>
    </div>
  )
}

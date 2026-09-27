import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { get, post } from './api'
import type { Row } from './types'
import { DataTable, Panel } from './ui'

export interface AuditPage {
  rows: Row[]
  page: number
  size: number
  total: number
  totalPages: number
  scope: 'STATE' | 'SELF'
}

export interface AuditFacets {
  actions: string[]
  entityTypes: string[]
  categories: string[]
  actors: Row[]
  outcomes: string[]
  decisions: string[]
  scope: 'STATE' | 'SELF'
}

export interface AuditSummary {
  byCategory: Row[]
  byOutcome: Row[]
  byDecision: Row[]
  byActor: Row[]
}

interface UiEvent {
  action: string
  page: string
  entityType?: string
  entityId?: string
  transactionRef?: string
  propertyRef?: string
  detail?: string
}

/**
 * Sends a user action that never reaches another endpoint - opening a screen,
 * exporting - to the audit trail. It never fails the caller: a screen must
 * still work when the trail cannot be written.
 */
export function recordUiEvent(event: UiEvent): void {
  void post('/api/audit/events', event).catch(() => undefined)
}

/** Audits a screen view once per set of references. */
export function usePageAudit(action: string, page: string, refs?: { transactionRef?: string; propertyRef?: string }) {
  const transactionRef = refs?.transactionRef
  const propertyRef = refs?.propertyRef
  useEffect(() => {
    recordUiEvent({ action, page, transactionRef, propertyRef })
  }, [action, page, transactionRef, propertyRef])
}

/** Audit history of one transaction or property, shown on its detail screen. */
export function AuditTimeline({
  transactionRef,
  propertyRef,
  title = 'Audit trail',
}: {
  transactionRef?: string
  propertyRef?: string
  title?: string
}) {
  const [rows, setRows] = useState<Row[]>([])

  const load = useCallback(async () => {
    const path =
      transactionRef === undefined
        ? `/api/audit/properties/${encodeURIComponent(propertyRef ?? '')}`
        : `/api/audit/transactions/${encodeURIComponent(transactionRef)}`
    try {
      setRows(await get<Row[]>(`${path}?size=50`))
    } catch {
      setRows([])
    }
  }, [transactionRef, propertyRef])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Panel
      title={title}
      actions={
        <>
          <button onClick={() => void load()}>Refresh</button>
          <Link className="link" to={auditLink({ transactionRef, propertyRef })}>
            Open in audit trail
          </Link>
        </>
      }
    >
      <DataTable
        rows={rows}
        columns={[
          { key: 'occurred_at', label: 'When' },
          { key: 'actor_username', label: 'Who' },
          { key: 'action', label: 'Action' },
          { key: 'from_status', label: 'From' },
          { key: 'to_status', label: 'To' },
          { key: 'decision', label: 'Decision' },
          { key: 'outcome', label: 'Outcome' },
          { key: 'detail', label: 'Detail' },
        ]}
        empty="No audited activity yet."
      />
    </Panel>
  )
}

export function auditLink(refs: { transactionRef?: string; propertyRef?: string }): string {
  const search = new URLSearchParams()
  if (refs.transactionRef !== undefined) search.set('transactionRef', refs.transactionRef)
  if (refs.propertyRef !== undefined) search.set('propertyRef', refs.propertyRef)
  const encoded = search.toString()
  return encoded.length === 0 ? '/audit' : `/audit?${encoded}`
}

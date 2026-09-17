import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, get, post, qs } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner, DataTable, Field, Panel, formatCell } from '../ui'

export default function RevenueQueue({ role }: { role: 'VAO' | 'TAHSILDAR' }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Row | null>(null)
  const [remarks, setRemarks] = useState('')
  const [objector, setObjector] = useState('')
  const [objectionReason, setObjectionReason] = useState('')
  const [registerNumber, setRegisterNumber] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const statusFilter = role === 'VAO' ? 'VAO_PENDING' : 'TAHSILDAR_PENDING'

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await get<Row[]>(`/api/revenue/mutations${qs({ status: statusFilter })}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const open = async (mutationId: number) => {
    setError('')
    try {
      setSelected(await get<Row>(`/api/revenue/mutations/${mutationId}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  const guard = async (action: () => Promise<unknown>, message: string) => {
    setError('')
    setInfo('')
    try {
      await action()
      setInfo(message)
      await load()
      if (selected !== null) {
        await open(Number(selected.id))
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  const mutationId = selected === null ? 0 : Number(selected.id)

  return (
    <>
      <Panel
        title={role === 'VAO' ? 'VAO field verification queue' : 'Tahsildar approval queue'}
        actions={<button onClick={() => void load()}>Refresh</button>}
      >
        <Banner kind="error" message={error} />
        <Banner kind="success" message={info} />
        <p className="muted">
          Signed in as {user?.fullName ?? ''}. Only the Tahsildar issues the authoritative revenue decision.
        </p>
        <DataTable
          rows={rows}
          onRowClick={(row) => void open(Number(row.id))}
          columns={[
            { key: 'id', label: 'Mutation' },
            { key: 'txn_ref', label: 'Transaction' },
            { key: 'property_ref', label: 'Property' },
            { key: 'deed_type_code', label: 'Deed type' },
            { key: 'mutation_type', label: 'Mutation type' },
            { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'Created' },
          ]}
          empty="Queue is empty."
        />
      </Panel>

      {selected === null ? null : (
        <Panel title={`Mutation #${formatCell(selected.id)} — ${formatCell(selected.txn_ref)}`}>
          <dl className="kv">
            <dt>Property</dt>
            <dd>
              <Link to={`/properties/${formatCell(selected.property_ref)}`}>{formatCell(selected.property_ref)}</Link>
            </dd>
            <dt>Status</dt>
            <dd>{formatCell(selected.status)}</dd>
            <dt>Proposed owner set</dt>
            <dd>{formatCell(selected.proposed_owner_set)}</dd>
            <dt>VAO remarks</dt>
            <dd>{formatCell(selected.vao_remarks)}</dd>
          </dl>

          <DataTable
            rows={(selected.objections as Row[]) ?? []}
            columns={[
              { key: 'objector_name', label: 'Objector' },
              { key: 'objection_reason', label: 'Reason' },
              { key: 'status', label: 'Status' },
              { key: 'disposal_decision', label: 'Disposal' },
            ]}
            empty="No objections recorded."
          />

          {role === 'VAO' ? (
            <>
              <div className="row">
                <Field label="Verification remarks" value={remarks} onChange={setRemarks} />
                <button
                  className="primary"
                  onClick={() =>
                    void guard(
                      () => post(`/api/revenue/mutations/${mutationId}/verify`, { remarks }, true),
                      'Verified and forwarded to the Tahsildar.',
                    )
                  }
                >
                  Verify &amp; forward
                </button>
              </div>
              <div className="row">
                <Field label="Objector name" value={objector} onChange={setObjector} />
                <Field label="Objection reason" value={objectionReason} onChange={setObjectionReason} />
                <button
                  onClick={() =>
                    void guard(
                      () =>
                        post(`/api/revenue/mutations/${mutationId}/objections`, {
                          objectorName: objector,
                          objectionDate: new Date().toISOString().slice(0, 10),
                          objectionReason,
                        }),
                      'Objection recorded.',
                    )
                  }
                >
                  Raise objection
                </button>
                <button
                  onClick={() =>
                    void guard(
                      () =>
                        post(`/api/revenue/mutations/${mutationId}/objections/dispose`, {
                          disposalDecision: 'REJECTED',
                          remarks,
                        }),
                      'Objection disposed.',
                    )
                  }
                >
                  Dispose objection
                </button>
              </div>
            </>
          ) : (
            <div className="row">
              <Field label="Mutation register number" value={registerNumber} onChange={setRegisterNumber} required />
              <Field label="Remarks" value={remarks} onChange={setRemarks} />
              <button
                className="primary"
                onClick={() =>
                  void guard(
                    () =>
                      post(
                        `/api/revenue/mutations/${mutationId}/approve`,
                        { mutationRegisterNumber: registerNumber, remarks },
                        true,
                      ),
                    'Mutation approved; revenue record updated.',
                  )
                }
              >
                Approve mutation
              </button>
            </div>
          )}

          <DataTable
            rows={(selected.approvedRecord as Row[]) ?? []}
            columns={[
              { key: 'revenue_record_number', label: 'Revenue record' },
              { key: 'mutation_register_number', label: 'Mutation register' },
              { key: 'approved_at', label: 'Approved at' },
            ]}
            empty="Not approved yet."
          />
        </Panel>
      )}
    </>
  )
}

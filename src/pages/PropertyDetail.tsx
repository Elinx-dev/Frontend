import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ApiError, get, post } from '../api'
import { useAuth } from '../auth'
import type { Bootstrap, Row } from '../types'
import { Banner, DataTable, Field, Panel, formatCell } from '../ui'

export default function PropertyDetail() {
  const { propertyRef = '' } = useParams()
  const navigate = useNavigate()
  const { bootstrap, user } = useAuth()
  const [property, setProperty] = useState<Row | null>(null)
  const [error, setError] = useState('')
  const [deedTypeCode, setDeedTypeCode] = useState('')
  const [transferScope, setTransferScope] = useState('')

  const load = useCallback(async () => {
    try {
      setProperty(await get<Row>(`/api/properties/${propertyRef}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [propertyRef])

  useEffect(() => {
    void load()
  }, [load])

  const startTransaction = async () => {
    setError('')
    try {
      const created = await post<Row>(
        '/api/transactions',
        { propertyRef, deedTypeCode, transferScope: transferScope.length === 0 ? undefined : transferScope },
        true,
      )
      navigate(`/transactions/${String(created.txn_ref)}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  if (property === null) {
    return <Banner kind="error" message={error.length === 0 ? 'Loading…' : error} />
  }

  const deedTypes = (bootstrap as Bootstrap | null)?.deedTypes ?? []
  const canCreate = user?.permissions.includes('TXN_CREATE') === true

  return (
    <>
      <Panel title={`Property ${formatCell(property.property_ref)}`}>
        <Banner kind="error" message={error} />
        <dl className="kv">
          <dt>ULPIN</dt>
          <dd>{formatCell(property.ulpin)}</dd>
          <dt>Survey / subdivision</dt>
          <dd>
            {formatCell(property.survey_no)} / {formatCell(property.subdivision_no)}
          </dd>
          <dt>Extent</dt>
          <dd>
            {formatCell(property.extent_value)} {formatCell(property.extent_unit)}
          </dd>
          <dt>Village / SRO</dt>
          <dd>
            {formatCell(property.village_code)} / {formatCell(property.sro_code)}
          </dd>
          <dt>Status</dt>
          <dd>{formatCell(property.status)}</dd>
          <dt>Token</dt>
          <dd>{formatCell(property.token_ref)}</dd>
        </dl>
      </Panel>

      <Panel title="Registered owners (registration record)">
        <DataTable
          rows={(property.registeredOwners as Row[]) ?? []}
          columns={[
            { key: 'owner_name', label: 'Owner' },
            { key: 'share_pct', label: 'Share %' },
            { key: 'source', label: 'Source' },
            { key: 'effective_from', label: 'Effective from' },
          ]}
        />
      </Panel>

      <Panel title="Revenue ownership (separate record)">
        <DataTable
          rows={(property.revenueOwners as Row[]) ?? []}
          columns={[
            { key: 'revenue_record_ref', label: 'Revenue record' },
            { key: 'owners', label: 'Owners' },
            { key: 'extent_value', label: 'Extent' },
            { key: 'fetched_at', label: 'Fetched at' },
          ]}
          empty="No revenue snapshot fetched for this property."
        />
      </Panel>

      <Panel title="Chain of title">
        <DataTable
          rows={(property.chainOfTitle as Row[]) ?? []}
          columns={[
            { key: 'seq', label: '#' },
            { key: 'executor_name', label: 'Executor' },
            { key: 'claimant_name', label: 'Claimant' },
            { key: 'transaction_date', label: 'Date' },
            { key: 'nature_of_transaction', label: 'Nature' },
            { key: 'reference_no', label: 'Reference' },
          ]}
        />
      </Panel>

      <Panel title="Transactions">
        <DataTable
          rows={(property.transactions as Row[]) ?? []}
          onRowClick={(row) => navigate(`/transactions/${String(row.txn_ref)}`)}
          columns={[
            { key: 'txn_ref', label: 'Transaction' },
            { key: 'deed_type_code', label: 'Deed type' },
            { key: 'status', label: 'Status' },
            { key: 'current_stage_code', label: 'Stage' },
            { key: 'initiated_at', label: 'Initiated' },
          ]}
        />
      </Panel>

      {canCreate ? (
        <Panel title="Start a new transaction">
          <div className="row">
            <Field
              label="Deed type"
              value={deedTypeCode}
              onChange={setDeedTypeCode}
              required
              options={deedTypes.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
            />
            <Field
              label="Transfer scope"
              value={transferScope}
              onChange={setTransferScope}
              options={[
                { value: 'FULL_PROPERTY', label: 'Full property' },
                { value: 'UNDIVIDED_SHARE', label: 'Undivided share' },
                {
                  value: 'PHYSICAL_PARTIAL_EXTENT_SUBDIVISION',
                  label: 'Physical partial extent / subdivision',
                },
              ]}
            />
          </div>
          <button className="primary" disabled={deedTypeCode.length === 0} onClick={() => void startTransaction()}>
            Create transaction
          </button>
        </Panel>
      ) : null}
    </>
  )
}

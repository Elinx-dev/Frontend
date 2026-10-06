import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ApiError, get } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner, DataTable, Panel, formatCell } from '../ui'

export default function PropertyDetail() {
  const { propertyRef = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [property, setProperty] = useState<Row | null>(null)
  const [error, setError] = useState('')

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

  if (property === null) {
    return <Banner kind="error" message={error.length === 0 ? 'Loading…' : error} />
  }

  const canCreate = user?.permissions.includes('TXN_CREATE') === true

  return (
    <>
      <Panel
        title={`Property ${formatCell(property.property_ref)}`}
        actions={canCreate ? (
          <button
            className="primary"
            onClick={() => navigate(`/transactions/new?propertyRef=${encodeURIComponent(propertyRef)}`)}
          >
            Initiate transaction
          </button>
        ) : undefined}
      >
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
            { key: 'owner_type_code', label: 'Owner type' },
            { key: 'owner_name', label: 'Owner' },
            { key: 'registration_no', label: 'CIN / LLPIN / Reg. no.' },
            { key: 'representative_name', label: 'Representative' },
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
            { key: 'executor_name', label: 'Executor / seller' },
            { key: 'claimant_name', label: 'Claimant / purchaser' },
            { key: 'transaction_date', label: 'Transaction date' },
            { key: 'nature_of_transaction', label: 'Nature of transaction' },
            { key: 'reference_no', label: 'Registration / reference no.' },
            { key: 'survey_no', label: 'Survey no.' },
          ]}
          empty="No prior title history recorded."
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

    </>
  )
}

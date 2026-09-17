import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, get, qs } from '../api'
import type { Row } from '../types'
import { Banner, DataTable, Field, Panel } from '../ui'

export default function TransactionQueue() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await get<Row[]>(`/api/transactions${qs({ status })}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Panel
      title="Registration queue"
      actions={
        <>
          <button onClick={() => void load()}>Refresh</button>
          <button className="primary" onClick={() => navigate('/properties')}>
            New transaction
          </button>
        </>
      }
    >
      <Banner kind="error" message={error} />
      <Field
        label="Status filter"
        value={status}
        onChange={setStatus}
        options={[
          'DRAFT',
          'CONSENT_PENDING',
          'RULE_CHECK_PENDING',
          'EXCEPTION',
          'FEE_PAYMENT_PENDING',
          'REGISTERED',
          'SURVEY_PENDING',
          'VAO_PENDING',
          'OBJECTION_PENDING',
          'TAHSILDAR_PENDING',
          'REVENUE_APPROVED',
        ].map((s) => ({ value: s, label: s }))}
      />
      <DataTable
        rows={rows}
        onRowClick={(row) => navigate(`/transactions/${String(row.txn_ref)}`)}
        columns={[
          { key: 'txn_ref', label: 'Transaction' },
          { key: 'property_ref', label: 'Property' },
          { key: 'deed_type_code', label: 'Deed type' },
          { key: 'status', label: 'Status' },
          { key: 'current_stage_code', label: 'Stage' },
          { key: 'survey_required', label: 'Survey' },
          { key: 'initiated_at', label: 'Initiated' },
        ]}
        empty="No transactions in this queue."
      />
    </Panel>
  )
}

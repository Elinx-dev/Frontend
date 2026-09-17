import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, get, qs } from '../api'
import type { Row } from '../types'
import { Banner, DataTable, Panel } from '../ui'

export default function SurveyorQueue() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await get<Row[]>(`/api/transactions${qs({ status: 'SURVEY_PENDING' })}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Panel title="Survey queue" actions={<button onClick={() => void load()}>Refresh</button>}>
      <Banner kind="error" message={error} />
      <DataTable
        rows={rows}
        onRowClick={(row) => navigate(`/survey/${String(row.txn_ref)}`)}
        columns={[
          { key: 'txn_ref', label: 'Transaction' },
          { key: 'property_ref', label: 'Property' },
          { key: 'deed_type_code', label: 'Deed type' },
          { key: 'current_stage_code', label: 'Stage' },
          { key: 'initiated_at', label: 'Initiated' },
        ]}
        empty="No surveys pending."
      />
    </Panel>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, get, qs } from '../api'
import type { Row } from '../types'
import { Banner, DataTable, Field, Panel } from '../ui'

export default function PropertySearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [villageCode, setVillageCode] = useState('')
  const [surveyNo, setSurveyNo] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  const search = useCallback(async () => {
    setError('')
    try {
      setRows(await get<Row[]>(`/api/properties${qs({ query, villageCode, surveyNo })}`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [query, villageCode, surveyNo])

  useEffect(() => {
    void search()
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Panel title="Property register" actions={<button onClick={() => void search()}>Search</button>}>
      <Banner kind="error" message={error} />
      <div className="row">
        <Field label="Reference / ULPIN / survey / door no" value={query} onChange={setQuery} />
        <Field label="Village code" value={villageCode} onChange={setVillageCode} />
        <Field label="Survey no" value={surveyNo} onChange={setSurveyNo} />
      </div>
      <DataTable
        rows={rows}
        onRowClick={(row) => navigate(`/properties/${String(row.property_ref)}`)}
        columns={[
          { key: 'property_ref', label: 'Property reference' },
          { key: 'ulpin', label: 'ULPIN' },
          { key: 'survey_no', label: 'Survey no' },
          { key: 'subdivision_no', label: 'Subdivision' },
          { key: 'extent_value', label: 'Extent' },
          { key: 'extent_unit', label: 'Unit' },
          { key: 'village_code', label: 'Village' },
          { key: 'sro_code', label: 'SRO' },
          { key: 'status', label: 'Status' },
        ]}
        empty="No properties match the filters."
      />
    </Panel>
  )
}

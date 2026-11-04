import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, get, qs } from '../api'
import type { Row } from '../types'
import { Banner, DataTable, Panel, formatCell } from '../ui'
import LookupField from './LookupField'
import PublicShell from './PublicShell'
import { PLACE_PATTERN, REF_PATTERN, SURVEY_PATTERN, fieldError } from './publicSearch'

type Mode = 'id' | 'survey'

const EMPTY_LOCATION = { district: '', taluk: '', village: '', surveyNo: '', subdivisionNo: '' }

export default function PublicView() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('id')
  const [propertyRef, setPropertyRef] = useState('')
  const [ulpin, setUlpin] = useState('')
  const [location, setLocation] = useState(EMPTY_LOCATION)
  const [submitted, setSubmitted] = useState(false)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  const set = (key: keyof typeof EMPTY_LOCATION) => (value: string) => setLocation((current) => ({ ...current, [key]: value }))

  const errors: Record<string, string> = mode === 'id'
    ? {
        propertyRef: fieldError(propertyRef, REF_PATTERN, 'Property ID', false),
        ulpin: fieldError(ulpin, REF_PATTERN, 'ULPIN', false),
        either: propertyRef.trim() || ulpin.trim() ? '' : 'Enter the Property ID or the ULPIN',
      }
    : {
        district: fieldError(location.district, PLACE_PATTERN, 'District', true),
        taluk: fieldError(location.taluk, PLACE_PATTERN, 'Taluk', true),
        village: fieldError(location.village, PLACE_PATTERN, 'Village', true),
        surveyNo: fieldError(location.surveyNo, SURVEY_PATTERN, 'Survey no', true),
        subdivisionNo: fieldError(location.subdivisionNo, SURVEY_PATTERN, 'Subdivision', true),
      }
  const valid = Object.values(errors).every((e) => e.length === 0)
  const shown = (key: string) => (submitted ? errors[key] ?? '' : '')

  const reset = (next: Mode) => {
    setMode(next)
    setSubmitted(false)
    setSearched(false)
    setRows([])
    setError('')
  }

  const clear = () => {
    setPropertyRef('')
    setUlpin('')
    setLocation(EMPTY_LOCATION)
    reset(mode)
  }

  const search = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setError('')
    if (!valid) return
    const params = mode === 'id'
      ? { propertyRef: propertyRef.trim(), ulpin: ulpin.trim() }
      : Object.fromEntries(Object.entries(location).map(([k, v]) => [k, v.trim()]))
    setLoading(true)
    try {
      setRows((await get<Row[]>(`/api/public/properties${qs(params)}`)).slice(0, 1))
      setSearched(true)
    } catch (err) {
      setRows([])
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const open = (row: Row) => navigate(`/public/properties/${encodeURIComponent(String(row.property_ref))}`)

  return (
    <PublicShell title="Public Property Search">
      <Panel title="Find a property record">
        <p className="muted">
          Search one property at a time, by its Property ID / ULPIN or by its full survey and location details.
          Public records exclude Aadhaar, consideration, contact details and rule-check findings.
        </p>
        <div className="vao-tabs inline public-mode" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'id'} className={mode === 'id' ? 'active' : ''} onClick={() => reset('id')}>By Property ID</button>
          <button type="button" role="tab" aria-selected={mode === 'survey'} className={mode === 'survey' ? 'active' : ''} onClick={() => reset('survey')}>By survey and location</button>
        </div>
        <form className="public-search" onSubmit={(e) => void search(e)} noValidate>
          {mode === 'id' ? (
            <div className="public-grid">
              <label className="field public-field">
                <span>Property ID</span>
                <input value={propertyRef} maxLength={40} autoComplete="off" placeholder="e.g. TN-CHN-00000001" aria-invalid={shown('propertyRef').length > 0} onChange={(e) => setPropertyRef(e.target.value)} />
                {shown('propertyRef') ? <small className="public-field-error">{shown('propertyRef')}</small> : null}
              </label>
              <label className="field public-field">
                <span>ULPIN</span>
                <input value={ulpin} maxLength={40} autoComplete="off" placeholder="14-character land parcel number" aria-invalid={shown('ulpin').length > 0} onChange={(e) => setUlpin(e.target.value)} />
                {shown('ulpin') ? <small className="public-field-error">{shown('ulpin')}</small> : null}
              </label>
            </div>
          ) : (
            <div className="public-grid">
              <LookupField label="District" value={location.district} onChange={set('district')} path="/api/public/lookups/districts" error={shown('district')} />
              <LookupField label="Taluk" value={location.taluk} onChange={set('taluk')} path="/api/public/lookups/taluks" params={{ district: location.district.trim() }} error={shown('taluk')} />
              <LookupField label="Village" value={location.village} onChange={set('village')} path="/api/public/lookups/villages" params={{ district: location.district.trim(), taluk: location.taluk.trim() }} error={shown('village')} />
              <label className="field public-field">
                <span>Survey no <b className="req">*</b></span>
                <input value={location.surveyNo} maxLength={20} autoComplete="off" placeholder="e.g. 112" aria-invalid={shown('surveyNo').length > 0} onChange={(e) => set('surveyNo')(e.target.value)} />
                {shown('surveyNo') ? <small className="public-field-error">{shown('surveyNo')}</small> : null}
              </label>
              <label className="field public-field">
                <span>Subdivision <b className="req">*</b></span>
                <input value={location.subdivisionNo} maxLength={20} autoComplete="off" placeholder="e.g. 2A" aria-invalid={shown('subdivisionNo').length > 0} onChange={(e) => set('subdivisionNo')(e.target.value)} />
                {shown('subdivisionNo') ? <small className="public-field-error">{shown('subdivisionNo')}</small> : null}
              </label>
            </div>
          )}
          {shown('either') ? <Banner kind="error" message={shown('either')} /> : null}
          <Banner kind="error" message={error} />
          <div className="public-actions">
            <button type="button" className="outline" onClick={clear}>Clear</button>
            <button type="submit" className="primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
          </div>
        </form>
        {searched ? (
          <div className="public-result">
          <DataTable
            rows={rows}
            onRowClick={open}
            columns={[
              { key: 'property_ref', label: 'Property ID' },
              { key: 'ulpin', label: 'ULPIN' },
              { key: 'survey', label: 'Survey / Subdivision', render: (row) => [row.survey_no, row.subdivision_no].filter((v) => v != null && v !== '').join(' / ') },
              { key: 'district', label: 'District', render: (row) => formatCell(row.district_name ?? row.district_code) },
              { key: 'taluk', label: 'Taluk', render: (row) => formatCell(row.taluk_name ?? row.taluk_code) },
              { key: 'village', label: 'Village', render: (row) => formatCell(row.village_name ?? row.village_code) },
              { key: 'extent', label: 'Extent', render: (row) => `${formatCell(row.extent_value)} ${row.extent_unit ?? ''}`.trim() },
              { key: 'property_status', label: 'Status' },
              { key: 'view', label: '', render: (row) => <button type="button" className="outline" onClick={(e) => { e.stopPropagation(); open(row) }}>View details</button> },
            ]}
            empty="No property matches these details. Check every field and try again."
          />
          </div>
        ) : null}
      </Panel>
    </PublicShell>
  )
}

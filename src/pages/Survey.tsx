import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, get, post } from '../api'
import type { Row, TransactionDetail as Txn } from '../types'
import { Banner, DataTable, Field, Panel, formatCell } from '../ui'

interface ParcelForm {
  extentValue: string
  ownerName: string
}

export default function Survey() {
  const { txnRef = '' } = useParams()
  const [txn, setTxn] = useState<Txn | null>(null)
  const [visits, setVisits] = useState<Row[]>([])
  const [submissions, setSubmissions] = useState<Row[]>([])
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10))
  const [visitTime, setVisitTime] = useState('10:00:00')
  const [measuredExtent, setMeasuredExtent] = useState('')
  const [fmbSketchReference, setFmbSketchReference] = useState('')
  const [parcels, setParcels] = useState<ParcelForm[]>([
    { extentValue: '', ownerName: '' },
    { extentValue: '', ownerName: '' },
  ])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const load = useCallback(async () => {
    try {
      setTxn(await get<Txn>(`/api/transactions/${txnRef}`))
      setVisits(await get<Row[]>(`/api/transactions/${txnRef}/survey/visits`))
      setSubmissions(await get<Row[]>(`/api/transactions/${txnRef}/survey/submissions`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [txnRef])

  useEffect(() => {
    void load()
  }, [load])

  const guard = async (action: () => Promise<unknown>, message: string) => {
    setError('')
    setInfo('')
    try {
      await action()
      setInfo(message)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  const proposeVisit = () =>
    guard(() => post(`/api/transactions/${txnRef}/survey/visits`, { visitDate, visitTime }), 'Visit proposed.')

  const acceptVisit = (visitId: number) =>
    guard(() => post(`/api/transactions/${txnRef}/survey/visits/${visitId}/accept`, {}), 'Visit accepted.')

  const checkIn = (visitId: number) =>
    guard(() => post(`/api/transactions/${txnRef}/survey/visits/${visitId}/check-in`, {}), 'Checked in on site.')

  const submit = () =>
    guard(
      () =>
        post(
          `/api/transactions/${txnRef}/survey/submissions`,
          {
            measuredExtent: Number(measuredExtent),
            extentUnit: formatCell(txn?.property.extent_unit),
            fmbSketchReference,
            surveyDate: visitDate,
            parcels: parcels
              .filter((p) => p.extentValue.trim().length > 0)
              .map((p) => ({
                extentValue: Number(p.extentValue),
                extentUnit: formatCell(txn?.property.extent_unit),
                owners: [{ name: p.ownerName, sharePct: 100 }],
              })),
          },
          true,
        ),
      'Survey submitted; child parcels and tokens created where applicable.',
    )

  if (txn === null) {
    return <Banner kind="error" message={error.length === 0 ? 'Loading…' : error} />
  }

  return (
    <>
      <Panel title={`Survey for ${txn.txn_ref}`} actions={<Link to={`/transactions/${txn.txn_ref}`}>Open transaction</Link>}>
        <Banner kind="error" message={error} />
        <Banner kind="success" message={info} />
        <dl className="kv">
          <dt>Property</dt>
          <dd>{formatCell(txn.property.property_ref)}</dd>
          <dt>Recorded extent</dt>
          <dd>
            {formatCell(txn.property.extent_value)} {formatCell(txn.property.extent_unit)}
          </dd>
          <dt>Status</dt>
          <dd>{txn.status}</dd>
        </dl>
      </Panel>

      <Panel title="Site visits" actions={<button onClick={() => void proposeVisit()}>Propose visit</button>}>
        <div className="row">
          <Field label="Visit date" value={visitDate} onChange={setVisitDate} type="date" />
          <Field label="Visit time" value={visitTime} onChange={setVisitTime} />
        </div>
        <DataTable
          rows={visits}
          columns={[
            { key: 'id', label: 'Id' },
            { key: 'visit_date', label: 'Date' },
            { key: 'visit_time', label: 'Time' },
            { key: 'status', label: 'Status' },
            { key: 'checked_in_at', label: 'Checked in' },
          ]}
          empty="No visits proposed."
        />
        <div className="actions">
          {visits.map((v) => (
            <span key={String(v.id)}>
              <button onClick={() => void acceptVisit(Number(v.id))}>Accept #{formatCell(v.id)}</button>
              <button onClick={() => void checkIn(Number(v.id))}>Check in #{formatCell(v.id)}</button>
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="Measurement and subdivision" actions={<button className="primary" onClick={() => void submit()}>Submit survey</button>}>
        <div className="row">
          <Field label="Measured extent" value={measuredExtent} onChange={setMeasuredExtent} type="number" required />
          <Field label="FMB sketch reference" value={fmbSketchReference} onChange={setFmbSketchReference} />
          <button onClick={() => setParcels([...parcels, { extentValue: '', ownerName: '' }])}>Add parcel</button>
        </div>
        {parcels.map((parcel, index) => (
          <div className="row" key={index}>
            <Field
              label={`Parcel ${index + 1} extent`}
              value={parcel.extentValue}
              onChange={(v) => setParcels(parcels.map((p, i) => (i === index ? { ...p, extentValue: v } : p)))}
              type="number"
            />
            <Field
              label={`Parcel ${index + 1} owner`}
              value={parcel.ownerName}
              onChange={(v) => setParcels(parcels.map((p, i) => (i === index ? { ...p, ownerName: v } : p)))}
            />
          </div>
        ))}
        <DataTable
          rows={submissions}
          columns={[
            { key: 'measured_extent', label: 'Measured' },
            { key: 'variance_pct', label: 'Variance %' },
            { key: 'within_tolerance', label: 'Within tolerance' },
            { key: 'submitted_at', label: 'Submitted' },
          ]}
          empty="No survey submitted yet."
        />
        <DataTable
          rows={txn.surveyParcels}
          columns={[
            { key: 'seq', label: '#' },
            { key: 'extent_value', label: 'Extent' },
            { key: 'extent_unit', label: 'Unit' },
            { key: 'intended_owner_mapping', label: 'Intended owners' },
            { key: 'child_property_id', label: 'Child property id' },
            { key: 'child_token_id', label: 'Child token id' },
          ]}
          empty="No child parcels created."
        />
      </Panel>
    </>
  )
}

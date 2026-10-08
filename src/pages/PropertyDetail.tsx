import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ApiError, get } from '../api'
import { useAuth } from '../auth'
import { str, type Row } from '../types'
import { Banner, DataTable, Field, Panel } from '../ui'
import PropertyMap from './PropertyMap'
import RecordTimeline from './RecordTimeline'
import {
  boundaryPoints, classificationOptions, extentUnitFallback, jurisdictionOptions, labelFor, landTypeOptions,
  natureOfTitleOptions, optionsFrom, ownerLayout, ownerTypes, propertyTypeFallback, usePropertyMap,
  displayValue, maskAadhaar, type SelectOption,
} from './propertyShared'

const stages = ['Identification', 'Property owners', 'Location', 'Survey', 'Boundaries', 'Chain of Title', 'Guideline Value', 'Transactions', 'Timeline'] as const
const EMPTY_ROWS: Row[] = []
const noop = () => undefined

const display = displayValue
const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : EMPTY_ROWS)

function ViewField({ label, value, options }: { label: string; value: unknown; options?: SelectOption[] }) {
  const text = display(value)
  return <Field label={label} value={options && text !== '—' ? labelFor(options, text) : text} onChange={noop} readOnly />
}

export default function PropertyDetail() {
  const { propertyRef = '' } = useParams()
  const navigate = useNavigate()
  const { user, bootstrap } = useAuth()
  const [property, setProperty] = useState<Row | null>(null)
  const [error, setError] = useState('')
  const [activeStage, setActiveStage] = useState(0)

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

  const jurisdictionRows = bootstrap?.jurisdictions ?? EMPTY_ROWS
  const districtOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'district_code', 'district_name', []), [jurisdictionRows])
  const sroOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'sro_code', 'sro_name', []), [jurisdictionRows])
  const talukOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'taluk_code', 'taluk_name', []), [jurisdictionRows])
  const villageOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'village_code', 'village_name', []), [jurisdictionRows])
  const districtName = labelFor(districtOptions, str(property, 'district_code'))
  const talukName = labelFor(talukOptions, str(property, 'taluk_code'))
  const villageName = labelFor(villageOptions, str(property, 'village_code'))
  const { mapLocation, mapLocationName, mapStatus } = usePropertyMap({
    doorNo: str(property, 'door_no'), street: str(property, 'street'), village: villageName, taluk: talukName, district: districtName,
  })

  if (property === null) {
    return <Banner kind="error" message={error.length === 0 ? 'Loading…' : error} />
  }

  const canCreate = user?.permissions.includes('TXN_CREATE') === true
  const owners = rows(property.registeredOwners)
  const surveyRecords = rows(property.surveyRecords)
  const measurements = rows(property.boundaryMeasurements)
  const chainOfTitle = rows(property.chainOfTitle)
  const transactions = rows(property.transactions)
  const ownerTypeCode = str(property, 'owner_type_code') || str(owners[0], 'owner_type_code')
  const ownerTypeLabel = ownerTypes.find((type) => type.value === ownerTypeCode)?.label ?? ownerTypeCode
  const layout = ownerLayout(ownerTypeCode)
  const extentUnits = optionsFrom(bootstrap, 'EXTENT_UNIT', extentUnitFallback)
  const street = [str(property, 'street'), str(property, 'door_no')].filter(Boolean).join(' / ')
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
  const stageSummary = [
    display(property.status), count(owners.length, 'owner'), villageName || '—', count(surveyRecords.length, 'record'),
    count(measurements.length, 'measurement'), count(chainOfTitle.length, 'record'),
    property.guideline_value ? 'Recorded' : 'Not recorded', count(transactions.length, 'transaction'), 'Audit log',
  ]

  return (
    <div className="intake-page property-view-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Property record</span>
          <h1>Property {display(property.property_ref)}</h1>
          <p className="muted">View only. Details recorded when the property was minted cannot be edited here.</p>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={() => navigate('/properties')}>Back to property list</button>
          {canCreate ? <button type="button" className="primary" onClick={() => navigate(`/transactions/new?propertyRef=${encodeURIComponent(propertyRef)}`)}>Initiate transaction</button> : null}
        </div>
      </div>
      <Banner kind="error" message={error} />
      <div className="property-stage-layout">
        <div className="property-stage-content">
          <div className="property-stage-tabs" role="tablist" aria-label="Property sections">
            {stages.map((stage, index) => (
              <button type="button" role="tab" id={`property-view-tab-${index}`} aria-selected={activeStage === index} aria-controls={`property-view-panel-${index}`} className={activeStage === index ? 'active' : ''} onClick={() => setActiveStage(index)} key={stage}>
                <span className="property-tab-marker" aria-hidden="true">{index + 1}</span>
                <span className="property-tab-copy"><strong>{stage}</strong><small>{stageSummary[index]}</small></span>
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`property-view-panel-${activeStage}`} aria-labelledby={`property-view-tab-${activeStage}`}>
            {activeStage === 0 ? <Panel title="">
              <div className="form-grid three">
                <ViewField label="Property reference" value={property.property_ref} />
                <ViewField label="Property type" value={property.property_type_code} options={optionsFrom(bootstrap, 'PROPERTY_TYPE', propertyTypeFallback)} />
                <ViewField label="Nature of title" value={property.nature_of_title_code} options={natureOfTitleOptions} />
                <ViewField label="Land type" value={property.land_type_code} options={landTypeOptions} />
                <ViewField label="Classification" value={property.classification_code} options={classificationOptions} />
                <ViewField label="Status" value={property.status} />
                <ViewField label="Token" value={property.token_ref} />
                <ViewField label="Created at" value={property.created_at} />
              </div>
            </Panel> : null}
            {activeStage === 1 ? <Panel title="">
              <div className="owner-type-select"><ViewField label="Owner type" value={ownerTypeLabel} /></div>
              {owners.length === 0 ? <p className="chain-history-empty">No owners recorded.</p> : null}
              {owners.map((owner, index) => {
                const representative = layout.representative
                return <section className="owner-entry" key={index}>
                  <header className="chain-history-entry-heading"><h3>{owners.length > 1 ? `Owner ${index + 1}` : 'Owner details'}</h3></header>
                  <div className="owner-fields">
                    <ViewField label={layout.nameLabel} value={owner.owner_name} />
                    {layout.registration ? <ViewField label={layout.registration.label} value={owner.registration_no} /> : null}
                    {layout.aadhaar ? <ViewField label="Aadhaar" value={maskAadhaar(owner.aadhaar_number)} /> : null}
                    <ViewField label={layout.panLabel} value={owner.pan} />
                    {layout.mobile ? <ViewField label="Mobile" value={owner.mobile} /> : null}
                    <ViewField label={layout.addressLabel} value={owner.address} />
                    <ViewField label="Source" value={owner.source} />
                    <ViewField label="Effective from" value={owner.effective_from} />
                  </div>
                  {representative ? <div className="owner-representative">
                    <h4>{representative.title}</h4>
                    <div className="owner-fields">
                      <ViewField label="Name" value={owner.representative_name} />
                      {representative.designation ? <ViewField label="Designation" value={owner.representative_designation} /> : null}
                      <ViewField label="Aadhaar" value={maskAadhaar(owner.representative_aadhaar)} />
                      <ViewField label="PAN" value={owner.representative_pan} />
                      {representative.mobile ? <ViewField label="Mobile" value={owner.representative_mobile} /> : null}
                    </div>
                  </div> : null}
                </section>
              })}
            </Panel> : null}
            {activeStage === 2 ? <Panel title="">
              <div className="location-survey-layout">
                <div className="form-grid three">
                  <ViewField label="Registration district" value={property.district_code} options={districtOptions} />
                  <ViewField label="Sub-Registrar Office (SRO)" value={property.sro_code} options={sroOptions} />
                  <ViewField label="Taluk" value={property.taluk_code} options={talukOptions} />
                  <ViewField label="Revenue village" value={property.village_code} options={villageOptions} />
                  <ViewField label="Panchayat" value={property.panchayat} />
                  <ViewField label="Ward no." value={property.ward_no} />
                  <ViewField label="Street / door no." value={street} />
                </div>
                <PropertyMap location={mapLocation} name={mapLocationName} status={mapStatus} />
              </div>
            </Panel> : null}
            {activeStage === 3 ? <Panel title="">
              {surveyRecords.length === 0 ? <p className="chain-history-empty">No survey records.</p> : null}
              {surveyRecords.map((record, index) => <section className="owner-entry" key={index}>
                <header className="chain-history-entry-heading"><h3>{`Survey record ${display(record.seq ?? index + 1)}`}</h3></header>
                <div className="owner-fields">
                  <ViewField label="ULPIN" value={record.ulpin} />
                  <ViewField label="Survey no." value={record.survey_no} />
                  <ViewField label="Sub-division no." value={record.subdivision_no} />
                  <ViewField label="Extent" value={record.extent_value} />
                  <ViewField label="Extent unit" value={record.extent_unit} options={extentUnits} />
                </div>
              </section>)}
            </Panel> : null}
            {activeStage === 4 ? <Panel title="">
              <div className="form-grid four">
                <ViewField label="North boundary" value={property.boundary_north} />
                <ViewField label="South boundary" value={property.boundary_south} />
                <ViewField label="East boundary" value={property.boundary_east} />
                <ViewField label="West boundary" value={property.boundary_west} />
              </div>
              <div className="boundary-measurements">
                <div className="boundary-measurements-heading"><div><h3>Boundary measurements</h3><small className="muted">{count(measurements.length, 'measurement')}</small></div></div>
                {measurements.map((measurement, index) => <div className="form-grid four" key={index}>
                  <ViewField label="From" value={measurement.from_point} options={boundaryPoints} />
                  <ViewField label="To" value={measurement.to_point} options={boundaryPoints} />
                  <ViewField label="Extent" value={measurement.value} />
                  <ViewField label="Extent unit" value={measurement.unit} options={extentUnits} />
                </div>)}
              </div>
            </Panel> : null}
            {activeStage === 5 ? <Panel title="">
              {chainOfTitle.length === 0 ? <p className="chain-history-empty">No prior title history recorded.</p> : null}
              {chainOfTitle.map((entry, index) => <section className="chain-history-entry" key={index}>
                <header className="chain-history-entry-heading"><h3>{index === 0 ? 'Earliest known owner' : `Record ${index + 1}`}</h3></header>
                <div className="chain-history-fields">
                  <ViewField label="Executor / Seller" value={entry.executor_name} />
                  <ViewField label="Claimant / Purchaser" value={entry.claimant_name} />
                  <ViewField label="Transaction date" value={entry.transaction_date} />
                  <ViewField label="Nature of transaction" value={entry.nature_of_transaction} />
                  <ViewField label="Registration / Reference No." value={entry.reference_no} />
                  <ViewField label="Survey No." value={entry.survey_no} />
                </div>
              </section>)}
            </Panel> : null}
            {activeStage === 6 ? <Panel title="">
              <div className="form-grid three">
                <ViewField label="Guideline value" value={property.guideline_value} />
                <ViewField label="Notification / register reference" value={property.guideline_value_reference} />
                <ViewField label="Entry date" value={property.guideline_value_entry_date} />
              </div>
            </Panel> : null}
            {activeStage === 7 ? <>
              <Panel title="Transactions">
                <DataTable
                  rows={transactions}
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
              <Panel title="Revenue ownership (separate record)">
                <DataTable
                  rows={rows(property.revenueOwners)}
                  columns={[
                    { key: 'revenue_record_ref', label: 'Revenue record' },
                    { key: 'owners', label: 'Owners' },
                    { key: 'extent_value', label: 'Extent' },
                    { key: 'fetched_at', label: 'Fetched at' },
                  ]}
                  empty="No revenue snapshot fetched for this property."
                />
              </Panel>
            </> : null}
            {activeStage === 8 ? <Panel title="Timeline">
              <RecordTimeline path={`/api/audit/properties/${encodeURIComponent(propertyRef)}`} />
            </Panel> : null}
          </div>
          <div className="property-stage-actions">
            <button type="button" onClick={() => setActiveStage((current) => Math.max(0, current - 1))} disabled={activeStage === 0}>Previous section</button>
            <button type="button" className="primary" onClick={() => setActiveStage((current) => Math.min(stages.length - 1, current + 1))} disabled={activeStage === stages.length - 1}>Next section</button>
          </div>
        </div>
      </div>
    </div>
  )
}

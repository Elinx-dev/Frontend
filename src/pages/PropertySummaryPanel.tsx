import { useEffect, useMemo, useState } from 'react'

import { ApiError, get } from '../api'
import { useAuth } from '../auth'
import { str, type Row } from '../types'
import PropertyMap from './PropertyMap'
import {
  classificationOptions, displayValue, extentUnitFallback, jurisdictionOptions, labelFor, landTypeOptions, maskAadhaar,
  natureOfTitleOptions, optionsFrom, ownerLayout, ownerTypes, propertyTypeFallback, usePropertyMap, type SelectOption,
} from './propertyShared'

const EMPTY_ROWS: Row[] = []
const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : EMPTY_ROWS)

function Item({ label, value, options }: { label: string; value: unknown; options?: SelectOption[] }) {
  const text = displayValue(value)
  return <><dt>{label}</dt><dd>{options && text !== '—' ? labelFor(options, text) : text}</dd></>
}

export default function PropertySummaryPanel({ propertyRef }: { propertyRef: string }) {
  const { bootstrap } = useAuth()
  const [loaded, setLoaded] = useState<{ ref: string; property: Row | null; error: string }>({ ref: '', property: null, error: '' })

  useEffect(() => {
    let active = true
    get<Row>(`/api/properties/${encodeURIComponent(propertyRef)}`)
      .then((property) => { if (active) setLoaded({ ref: propertyRef, property, error: '' }) })
      .catch((e: unknown) => { if (active) setLoaded({ ref: propertyRef, property: null, error: e instanceof ApiError ? e.message : String(e) }) })
    return () => { active = false }
  }, [propertyRef])

  const property = loaded.ref === propertyRef ? loaded.property : null
  const jurisdictionRows = bootstrap?.jurisdictions ?? EMPTY_ROWS
  const districtOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'district_code', 'district_name', []), [jurisdictionRows])
  const sroOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'sro_code', 'sro_name', []), [jurisdictionRows])
  const talukOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'taluk_code', 'taluk_name', []), [jurisdictionRows])
  const villageOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'village_code', 'village_name', []), [jurisdictionRows])
  const { mapLocation, mapLocationName, mapStatus } = usePropertyMap({
    doorNo: str(property, 'door_no'),
    street: str(property, 'street'),
    village: labelFor(villageOptions, str(property, 'village_code')),
    taluk: labelFor(talukOptions, str(property, 'taluk_code')),
    district: labelFor(districtOptions, str(property, 'district_code')),
  })

  if (property === null) {
    return <aside className="property-summary-panel" aria-label="Property under transaction"><p className="muted">{loaded.ref === propertyRef && loaded.error ? loaded.error : 'Loading property…'}</p></aside>
  }

  const owners = rows(property.registeredOwners)
  const surveyRecords = rows(property.surveyRecords)
  const ownerTypeCode = str(property, 'owner_type_code') || str(owners[0], 'owner_type_code')
  const layout = ownerLayout(ownerTypeCode)
  const extentUnits = optionsFrom(bootstrap, 'EXTENT_UNIT', extentUnitFallback)
  const street = [str(property, 'street'), str(property, 'door_no')].filter(Boolean).join(' / ')

  return (
    <aside className="property-summary-panel" aria-label="Property under transaction">
      <header className="property-summary-head">
        <span className="eyebrow">Property under transaction</span>
        <strong>{displayValue(property.property_ref)}</strong>
        <small className="muted">View only</small>
      </header>
      <section className="property-summary-section">
        <h3>Identification</h3>
        <dl className="property-summary-list">
          <Item label="Property type" value={property.property_type_code} options={optionsFrom(bootstrap, 'PROPERTY_TYPE', propertyTypeFallback)} />
          <Item label="Nature of title" value={property.nature_of_title_code} options={natureOfTitleOptions} />
          <Item label="Land type" value={property.land_type_code} options={landTypeOptions} />
          <Item label="Classification" value={property.classification_code} options={classificationOptions} />
          <Item label="Status" value={property.status} />
        </dl>
      </section>
      <section className="property-summary-section">
        <h3>Property owners</h3>
        <dl className="property-summary-list">
          <Item label="Owner type" value={ownerTypes.find((type) => type.value === ownerTypeCode)?.label ?? ownerTypeCode} />
        </dl>
        {owners.length === 0 ? <p className="muted">No owners recorded.</p> : null}
        {owners.map((owner, index) => (
          <dl className="property-summary-list property-summary-entry" key={index}>
            {owners.length > 1 ? <><dt className="property-summary-entry-title">Owner {index + 1}</dt><dd /></> : null}
            <Item label={layout.nameLabel} value={owner.owner_name} />
            {layout.registration ? <Item label={layout.registration.label} value={owner.registration_no} /> : null}
            {layout.aadhaar || owner.aadhaar_number ? <Item label="Aadhaar" value={maskAadhaar(owner.aadhaar_number)} /> : null}
            <Item label={layout.panLabel} value={owner.pan} />
            {layout.mobile || owner.mobile ? <Item label="Mobile" value={owner.mobile} /> : null}
            <Item label={layout.addressLabel} value={owner.address} />
            {layout.representative ? <>
              <Item label={layout.representative.title} value={owner.representative_name} />
              {layout.representative.designation ? <Item label="Designation" value={owner.representative_designation} /> : null}
              <Item label={`${layout.representative.title} Aadhaar`} value={maskAadhaar(owner.representative_aadhaar)} />
              <Item label={`${layout.representative.title} PAN`} value={owner.representative_pan} />
              {layout.representative.mobile ? <Item label={`${layout.representative.title} mobile`} value={owner.representative_mobile} /> : null}
            </> : null}
          </dl>
        ))}
      </section>
      <section className="property-summary-section">
        <h3>Location</h3>
        <dl className="property-summary-list">
          <Item label="Registration district" value={property.district_code} options={districtOptions} />
          <Item label="SRO" value={property.sro_code} options={sroOptions} />
          <Item label="Taluk" value={property.taluk_code} options={talukOptions} />
          <Item label="Revenue village" value={property.village_code} options={villageOptions} />
          <Item label="Panchayat" value={property.panchayat} />
          <Item label="Ward no." value={property.ward_no} />
          <Item label="Street / door no." value={street} />
        </dl>
        <PropertyMap location={mapLocation} name={mapLocationName} status={mapStatus} />
      </section>
      <section className="property-summary-section">
        <h3>Survey</h3>
        {surveyRecords.length === 0 ? <p className="muted">No survey records.</p> : null}
        {surveyRecords.map((record, index) => (
          <dl className="property-summary-list property-summary-entry" key={index}>
            <dt className="property-summary-entry-title">Record {displayValue(record.seq ?? index + 1)}</dt><dd />
            <Item label="ULPIN" value={record.ulpin} />
            <Item label="Survey no." value={record.survey_no} />
            <Item label="Sub-division no." value={record.subdivision_no} />
            <Item label="Extent" value={[displayValue(record.extent_value), labelFor(extentUnits, str(record, 'extent_unit'))].join(' ')} />
          </dl>
        ))}
      </section>
      <section className="property-summary-section">
        <h3>Guideline value</h3>
        <dl className="property-summary-list">
          <Item label="Guideline value" value={property.guideline_value} />
          <Item label="Reference" value={property.guideline_value_reference} />
          <Item label="Entry date" value={property.guideline_value_entry_date} />
        </dl>
      </section>
    </aside>
  )
}

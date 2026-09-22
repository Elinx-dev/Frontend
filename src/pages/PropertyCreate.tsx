import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, post } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner, Field, Panel } from '../ui'

const initialProperty = {
  stateCode: 'TN', propertyRef: '', ulpin: '', propertyTypeCode: 'RESIDENTIAL_PLOT',
  natureOfTitleCode: 'ABSOLUTE', landTypeCode: 'RURAL', classificationCode: 'PUNJAI_DRY',
  extentValue: '', extentUnit: 'SQ_FT', surveyNo: '', subdivisionNo: '', oldSurveyReference: '',
  fmbReferenceNo: '', districtCode: 'CHENNAI_SOUTH', talukCode: '', villageCode: '', sroCode: '',
  panchayat: '', wardNo: '', street: '', doorNo: '', boundaryNorth: '', boundarySouth: '',
  boundaryEast: '', boundaryWest: '', guidelineValue: '', guidelineValueReference: '',
}

type PropertyState = typeof initialProperty

interface OwnerForm {
  ownerName: string
  aadhaarNumber: string
  pan: string
  address: string
  sharePct: string
}

type OwnerField = keyof OwnerForm
type OwnerErrors = Record<number, Partial<Record<OwnerField, string>>>

const emptyOwner = (): OwnerForm => ({ ownerName: '', aadhaarNumber: '', pan: '', address: '', sharePct: '' })
const AADHAAR_PATTERN = /^\d{12}$/
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export default function PropertyCreate() {
  const navigate = useNavigate()
  const { bootstrap } = useAuth()
  const [property, setProperty] = useState<PropertyState>(initialProperty)
  const [owners, setOwners] = useState<OwnerForm[]>([emptyOwner()])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [ownerErrors, setOwnerErrors] = useState<OwnerErrors>({})
  const [busy, setBusy] = useState(false)

  const update = (key: keyof PropertyState, value: string) => setProperty((current) => ({ ...current, [key]: value }))
  const options = (key: string, fallback: { value: string; label: string }[]) => {
    const rows = bootstrap?.optionSets[key] ?? []
    const mapped = rows.map((row) => ({ value: String(row.code ?? row.value ?? ''), label: String(row.name ?? row.label ?? row.code ?? row.value ?? '') })).filter((row) => row.value)
    return mapped.length > 0 ? mapped : fallback
  }

  const save = async () => {
    setError('')
    const requiredFields: Array<[keyof PropertyState, string]> = [
      ['propertyTypeCode', 'Property type is required.'],
      ['sroCode', 'SRO is required.'],
      ['districtCode', 'Registration district is required.'],
      ['talukCode', 'Taluk is required.'],
      ['villageCode', 'Revenue village is required.'],
      ['surveyNo', 'Survey number is required.'],
      ['extentValue', 'Extent is required.'],
      ['boundaryNorth', 'North boundary is required.'],
      ['boundarySouth', 'South boundary is required.'],
      ['boundaryEast', 'East boundary is required.'],
      ['boundaryWest', 'West boundary is required.'],
    ]
    const validationErrors: Record<string, string> = {}
    for (const [field, message] of requiredFields) {
      if (property[field].trim().length === 0) validationErrors[field] = message
    }
    if (property.extentValue.trim().length > 0 && Number.isNaN(Number(property.extentValue))) {
      validationErrors.extentValue = 'Extent must be numeric.'
    }
    const validationOwnerErrors: OwnerErrors = {}
    owners.forEach((owner, index) => {
      const errors: Partial<Record<OwnerField, string>> = {}
      if (owner.ownerName.trim().length === 0) errors.ownerName = 'Owner name is required.'
      if (!AADHAAR_PATTERN.test(owner.aadhaarNumber)) errors.aadhaarNumber = 'Aadhaar must contain exactly 12 digits.'
      if (owner.pan.length > 0 && !PAN_PATTERN.test(owner.pan)) errors.pan = 'PAN must match AAAAA9999A.'
      if (owner.address.trim().length === 0) errors.address = 'Address is required.'
      const share = Number(owner.sharePct)
      if (owner.sharePct.trim().length === 0) errors.sharePct = 'Share percentage is required.'
      else if (!Number.isFinite(share) || share < 0 || share > 100) errors.sharePct = 'Share must be between 0 and 100.'
      if (Object.keys(errors).length > 0) validationOwnerErrors[index] = errors
    })
    setFieldErrors(validationErrors)
    setOwnerErrors(validationOwnerErrors)
    if (Object.keys(validationErrors).length > 0 || Object.keys(validationOwnerErrors).length > 0) return
    setBusy(true)
    try {
      await post<Row>('/api/properties', {
        ...property,
        propertyRef: property.propertyRef || `PR-${property.stateCode}-${Date.now()}`,
        ulpin: property.ulpin || undefined,
        extentValue: Number(property.extentValue),
        guidelineValue: property.guidelineValue ? Number(property.guidelineValue) : undefined,
        owners: owners.map((owner) => ({
          ownerName: owner.ownerName.trim(),
          aadhaarNumber: owner.aadhaarNumber,
          pan: owner.pan || undefined,
          address: owner.address.trim(),
          sharePct: Number(owner.sharePct),
        })),
      }, true)
      navigate('/properties')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const numeric = (key: keyof PropertyState, value: string) => update(key, value.replace(/[^0-9.]/g, ''))
  const updateOwner = (index: number, field: OwnerField, value: string) => {
    setOwners((current) => current.map((owner, ownerIndex) => ownerIndex === index ? { ...owner, [field]: value } : owner))
  }
  const fieldError = (key: keyof PropertyState) => fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null
  const ownerFieldError = (index: number, field: OwnerField) => ownerErrors[index]?.[field] ? <span className="field-error">{ownerErrors[index][field]}</span> : null
  const valid = property.talukCode && property.villageCode && property.sroCode && property.surveyNo && property.extentValue && property.boundaryNorth && property.boundarySouth && property.boundaryEast && property.boundaryWest
  return (
    <div className="intake-page">
      <div className="page-heading"><div><span className="eyebrow">Registration workspace</span><h1>Property Entry — New Property Record</h1><p className="muted">Create the property record first. ULPIN is optional and can be added when already issued.</p></div></div>
      <Banner kind="error" message={error} />
      <Panel title="Identification" actions={<span className="stage-label">New property</span>}>
        <div className="form-grid three">
          <Field label="Property reference" value={property.propertyRef} onChange={(v) => update('propertyRef', v)} placeholder="Generated if blank" />
          <Field label="ULPIN (optional)" value={property.ulpin} onChange={(v) => update('ulpin', v)} placeholder="Enter only if already issued" />
          <Field label="Property type" value={property.propertyTypeCode} onChange={(v) => update('propertyTypeCode', v)} options={options('property_type', [{ value: 'RESIDENTIAL_PLOT', label: 'Residential plot' }, { value: 'AGRICULTURAL_LAND', label: 'Agricultural land' }])} required />
          <Field label="Nature of title" value={property.natureOfTitleCode} onChange={(v) => update('natureOfTitleCode', v)} options={[{ value: 'ABSOLUTE', label: 'Absolute' }, { value: 'LEASEHOLD', label: 'Leasehold' }]} />
          <Field label="Land type" value={property.landTypeCode} onChange={(v) => update('landTypeCode', v)} options={[{ value: 'RURAL', label: 'Rural' }, { value: 'URBAN', label: 'Urban' }]} />
          <Field label="Classification" value={property.classificationCode} onChange={(v) => update('classificationCode', v)} options={[{ value: 'Dry', label: 'Dry' }, { value: 'Wet', label: 'Wet' }]} required />
        </div>
      </Panel>
      <Panel title="Property owners" actions={<button className="party-add-button" onClick={() => setOwners((current) => [...current, emptyOwner()])}><span aria-hidden="true">+</span> Add owner</button>}>
        {owners.map((owner, index) => (
          <div className="row party-row" key={index}>
            <div><Field label="Name" value={owner.ownerName} onChange={(v) => updateOwner(index, 'ownerName', v)} required />{ownerFieldError(index, 'ownerName')}</div>
            <div><Field label="Aadhaar (12 digits)" value={owner.aadhaarNumber} onChange={(v) => updateOwner(index, 'aadhaarNumber', v.replace(/\D/g, '').slice(0, 12))} required />{ownerFieldError(index, 'aadhaarNumber')}</div>
            <div><Field label="PAN" value={owner.pan} onChange={(v) => updateOwner(index, 'pan', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} />{ownerFieldError(index, 'pan')}</div>
            <div><Field label="Address" value={owner.address} onChange={(v) => updateOwner(index, 'address', v)} required />{ownerFieldError(index, 'address')}</div>
            <div><Field label="Share %" value={owner.sharePct} onChange={(v) => updateOwner(index, 'sharePct', v)} type="number" required />{ownerFieldError(index, 'sharePct')}</div>
            {owners.length > 1 ? <button type="button" onClick={() => setOwners((current) => current.filter((_, ownerIndex) => ownerIndex !== index))}>Remove</button> : null}
          </div>
        ))}
      </Panel>
      <Panel title="Location & Survey">
        <div className="form-grid three">
          <div><Field label="Sub-Registrar Office (SRO)" value={property.sroCode} onChange={(v) => update('sroCode', v)} required />{fieldError('sroCode')}</div>
          <div><Field label="Registration district" value={property.districtCode} onChange={(v) => update('districtCode', v)} required />{fieldError('districtCode')}</div>
          <div><Field label="Taluk" value={property.talukCode} onChange={(v) => update('talukCode', v)} required />{fieldError('talukCode')}</div>
          <div><Field label="Revenue village" value={property.villageCode} onChange={(v) => update('villageCode', v)} required />{fieldError('villageCode')}</div>
          <div><Field label="Survey no." value={property.surveyNo} onChange={(v) => update('surveyNo', v)} required />{fieldError('surveyNo')}</div>
          <Field label="Sub-division no." value={property.subdivisionNo} onChange={(v) => update('subdivisionNo', v)} />
          <div><Field label="Extent" value={property.extentValue} onChange={(v) => numeric('extentValue', v)} type="number" required />{fieldError('extentValue')}</div>
          <Field label="Extent unit" value={property.extentUnit} onChange={(v) => update('extentUnit', v)} options={[{ value: 'SQ_FT', label: 'Square feet' }, { value: 'HECTARE', label: 'Hectare' }]} required />
          <Field label="FMB reference no." value={property.fmbReferenceNo} onChange={(v) => update('fmbReferenceNo', v)} />
          <Field label="Panchayat" value={property.panchayat} onChange={(v) => update('panchayat', v)} />
          <Field label="Ward no." value={property.wardNo} onChange={(v) => update('wardNo', v)} />
          <Field label="Street / door no." value={`${property.street}${property.doorNo ? ` / ${property.doorNo}` : ''}`} onChange={(v) => update('street', v)} />
        </div>
      </Panel>
      <Panel title="Boundaries">
        <div className="form-grid four"><div><Field label="North" value={property.boundaryNorth} onChange={(v) => update('boundaryNorth', v)} required />{fieldError('boundaryNorth')}</div><div><Field label="South" value={property.boundarySouth} onChange={(v) => update('boundarySouth', v)} required />{fieldError('boundarySouth')}</div><div><Field label="East" value={property.boundaryEast} onChange={(v) => update('boundaryEast', v)} required />{fieldError('boundaryEast')}</div><div><Field label="West" value={property.boundaryWest} onChange={(v) => update('boundaryWest', v)} required />{fieldError('boundaryWest')}</div></div>
      </Panel>
      <Panel title="Guideline Value (manual entry)">
        <div className="form-grid three"><Field label="Guideline value" value={property.guidelineValue} onChange={(v) => update('guidelineValue', v)} type="number" /><Field label="Notification / register reference" value={property.guidelineValueReference} onChange={(v) => update('guidelineValueReference', v)} /></div>
        <p className="advisory">Not fetched from an API. Editable again during transaction review; every change is written to the audit trail.</p>
      </Panel>
      <div className="form-footer"><button onClick={() => navigate('/ro')}>Cancel</button><button className="primary" disabled={!valid || busy} onClick={() => void save()}>{busy ? 'Saving property…' : 'Save property record'}</button></div>
    </div>
  )
}

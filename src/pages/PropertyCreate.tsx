import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, post } from '../api'
import { useAuth } from '../auth'
import { str, type Row } from '../types'
import { Banner, Field, Panel } from '../ui'
import PropertyMap from './PropertyMap'
import { OwnerFields } from './OwnerFields'
import {
  boundaryPoints, classificationOptions, emptyOwner, extentUnitFallback, jurisdictionOptions, labelFor, landTypeOptions,
  natureOfTitleOptions, optionsFrom, ownerLayout, ownerPayload, ownerTypeOptionsFrom, propertyTypeFallback, usePropertyMap,
  validateOwner, type OwnerErrors, type OwnerField, type OwnerForm,
} from './propertyShared'

const initialProperty = {
  stateCode: 'TN', propertyRef: '', propertyTypeCode: 'LAND',
  natureOfTitleCode: 'ABSOLUTE', landTypeCode: 'RURAL', classificationCode: 'PUNJAI_DRY',
  oldSurveyReference: '',
  fmbReferenceNo: '', districtCode: '', talukCode: '', villageCode: '', sroCode: '',
  panchayat: '', wardNo: '', street: '', doorNo: '', boundaryNorth: '', boundarySouth: '',
  boundaryEast: '', boundaryWest: '', guidelineValue: '', guidelineValueReference: '',
}

type PropertyState = typeof initialProperty

const locationLevels = ['districtCode', 'sroCode', 'talukCode', 'villageCode'] as const
type LocationLevel = typeof locationLevels[number]
const EMPTY_ROWS: Row[] = []


interface BoundaryMeasurement {
  fromPoint: string
  toPoint: string
  value: string
  unit: string
}
type BoundaryMeasurementField = keyof BoundaryMeasurement
type BoundaryMeasurementErrors = Record<number, Partial<Record<BoundaryMeasurementField, string>>>
interface ChainHistoryEntry {
  executorName: string
  claimantName: string
  transactionDate: string
  natureOfTransaction: string
  referenceNo: string
  surveyNo: string
}
type ChainHistoryField = keyof ChainHistoryEntry
type ChainHistoryErrors = Record<number, Partial<Record<ChainHistoryField, string>>>
interface SurveyRecord {
  ulpin: string
  surveyNo: string
  subdivisionNo: string
  extentValue: string
  extentUnit: string
}
type SurveyRecordField = keyof SurveyRecord
type SurveyRecordErrors = Record<number, Partial<Record<SurveyRecordField, string>>>

const emptySurveyRecord = (): SurveyRecord => ({ ulpin: '', surveyNo: '', subdivisionNo: '', extentValue: '', extentUnit: 'SQ_FT' })
function surveyRecordErrors(records: SurveyRecord[]): SurveyRecordErrors {
  const errors: SurveyRecordErrors = {}
  const seenUlpins = new Set<string>()
  records.forEach((record, index) => {
    const fields: Partial<Record<SurveyRecordField, string>> = {}
    const ulpin = record.ulpin.trim()
    if (ulpin && seenUlpins.has(ulpin)) fields.ulpin = 'This ULPIN is already entered in another survey record.'
    if (ulpin) seenUlpins.add(ulpin)
    if (!record.surveyNo.trim()) fields.surveyNo = 'Survey number is required.'
    if (!record.extentValue.trim()) fields.extentValue = 'Extent is required.'
    else if (!Number.isFinite(Number(record.extentValue)) || Number(record.extentValue) <= 0) fields.extentValue = 'Enter an extent greater than zero.'
    if (!record.extentUnit) fields.extentUnit = 'Select an extent unit.'
    if (Object.keys(fields).length > 0) errors[index] = fields
  })
  return errors
}
const emptyBoundaryMeasurement = (): BoundaryMeasurement => ({ fromPoint: '', toPoint: '', value: '', unit: 'SQ_FT' })
const emptyChainHistoryEntry = (surveyNo = ''): ChainHistoryEntry => ({
  executorName: '',
  claimantName: '',
  transactionDate: '',
  natureOfTransaction: '',
  referenceNo: '',
  surveyNo,
})
const natureOfTransactionOptions = [
  { value: 'Sale', label: 'Sale' },
  { value: 'Purchase', label: 'Purchase' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Settlement', label: 'Settlement' },
  { value: 'Partition', label: 'Partition' },
  { value: 'Inheritance', label: 'Inheritance' },
  { value: 'Exchange', label: 'Exchange' },
  { value: 'Government Grant', label: 'Government Grant' },
  { value: 'Release', label: 'Release' },
  { value: 'Other', label: 'Other' },
]
const stages = ['Identification', 'Property owners', 'Location', 'Survey', 'Boundaries', 'Chain of Title', 'Guideline Value'] as const
const MAX_BOUNDARY_MEASUREMENTS = 8


export default function PropertyCreate() {
  const navigate = useNavigate()
  const { bootstrap } = useAuth()
  const [property, setProperty] = useState<PropertyState>(initialProperty)
  const [ownerTypeCode, setOwnerTypeCode] = useState('')
  const [owners, setOwners] = useState<OwnerForm[]>([emptyOwner()])
  const [boundaryMeasurements, setBoundaryMeasurements] = useState<BoundaryMeasurement[]>([emptyBoundaryMeasurement()])
  const [chainHistory, setChainHistory] = useState<ChainHistoryEntry[]>([])
  const [surveyRecords, setSurveyRecords] = useState<SurveyRecord[]>([emptySurveyRecord()])
  const [surveyErrors, setSurveyErrors] = useState<SurveyRecordErrors>({})
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [ownerErrors, setOwnerErrors] = useState<OwnerErrors>({})
  const [boundaryMeasurementErrors, setBoundaryMeasurementErrors] = useState<BoundaryMeasurementErrors>({})
  const [chainHistoryErrors, setChainHistoryErrors] = useState<ChainHistoryErrors>({})
  const [busy, setBusy] = useState(false)
  const [activeStage, setActiveStage] = useState(0)

  const jurisdictionRows = bootstrap?.jurisdictions ?? EMPTY_ROWS
  const districtOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'district_code', 'district_name', []), [jurisdictionRows])
  const sroOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'sro_code', 'sro_name', [
    (row) => property.districtCode.length === 0 || str(row, 'district_code') === property.districtCode,
  ]), [jurisdictionRows, property.districtCode])
  const talukOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'taluk_code', 'taluk_name', [
    (row) => property.districtCode.length === 0 || str(row, 'district_code') === property.districtCode,
    (row) => property.sroCode.length === 0 || str(row, 'sro_code') === property.sroCode,
  ]), [jurisdictionRows, property.districtCode, property.sroCode])
  const villageOptions = useMemo(() => jurisdictionOptions(jurisdictionRows, 'village_code', 'village_name', [
    (row) => property.districtCode.length === 0 || str(row, 'district_code') === property.districtCode,
    (row) => property.sroCode.length === 0 || str(row, 'sro_code') === property.sroCode,
    (row) => property.talukCode.length === 0 || str(row, 'taluk_code') === property.talukCode,
  ]), [jurisdictionRows, property.districtCode, property.sroCode, property.talukCode])
  const districtName = labelFor(districtOptions, property.districtCode)
  const talukName = labelFor(talukOptions, property.talukCode)
  const villageName = labelFor(villageOptions, property.villageCode)

  const { mapLocation, mapLocationName, mapStatus } = usePropertyMap({ doorNo: property.doorNo, street: property.street, village: villageName, taluk: talukName, district: districtName })

  const update = (key: keyof PropertyState, value: string) => setProperty((current) => ({ ...current, [key]: value }))
  const updateLocation = (key: LocationLevel, value: string) => setProperty((current) => {
    const next = { ...current, [key]: value }
    locationLevels.slice(locationLevels.indexOf(key) + 1).forEach((child) => {
      next[child] = ''
    })
    return next
  })
  const options = (key: string, fallback: { value: string; label: string }[]) => {
    return optionsFrom(bootstrap, key, fallback)
  }

  const ownerTypeOptions = ownerTypeOptionsFrom(bootstrap)
  const selectedOwnerType = ownerTypeOptions.find((type) => type.value === ownerTypeCode)
  const allowMultipleOwners = selectedOwnerType?.allowMultipleOwners === true
  const layout = ownerLayout(ownerTypeCode)
  const ownerTypeError = selectedOwnerType ? undefined : 'Owner type is required.'
  const changeOwnerType = (value: string) => {
    setOwnerTypeCode(value)
    if (!ownerTypeOptions.find((type) => type.value === value)?.allowMultipleOwners) setOwners((current) => current.slice(0, 1))
    setOwnerErrors({})
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.ownerTypeCode
      return next
    })
  }
  const collectOwnerErrors = () => {
    const errors: OwnerErrors = {}
    if (!selectedOwnerType) return errors
    owners.forEach((owner, index) => {
      const ownerErrorsForIndex = validateOwner(owner, layout)
      if (Object.keys(ownerErrorsForIndex).length > 0) errors[index] = ownerErrorsForIndex
    })
    return errors
  }

  const extentUnitOptions = options('EXTENT_UNIT', extentUnitFallback)

  const validateBoundaryMeasurements = () => {
    const nextErrors: BoundaryMeasurementErrors = {}
    boundaryMeasurements.forEach((measurement, index) => {
      const rowErrors: Partial<Record<BoundaryMeasurementField, string>> = {}
      if (!measurement.fromPoint) rowErrors.fromPoint = 'Select a starting point.'
      if (!measurement.toPoint) rowErrors.toPoint = 'Select an ending point.'
      else if (measurement.fromPoint && measurement.fromPoint === measurement.toPoint) {
        rowErrors.toPoint = 'Choose a different ending point.'
      }
      if (measurement.value.trim().length === 0) rowErrors.value = 'Extent is required.'
      else if (!Number.isFinite(Number(measurement.value)) || Number(measurement.value) <= 0) {
        rowErrors.value = 'Enter an extent greater than zero.'
      }
      if (!measurement.unit) rowErrors.unit = 'Select an extent unit.'
      if (Object.keys(rowErrors).length > 0) nextErrors[index] = rowErrors
    })
    setBoundaryMeasurementErrors(nextErrors)
    return nextErrors
  }

  const validateChainHistory = () => {
    const nextErrors: ChainHistoryErrors = {}
    chainHistory.forEach((entry, entryIndex) => {
      const fields: Partial<Record<ChainHistoryField, string>> = {}
      if (!entry.executorName.trim()) fields.executorName = 'Executor / seller is required.'
      if (!entry.claimantName.trim()) fields.claimantName = 'Claimant / purchaser is required.'
      if (!entry.transactionDate) fields.transactionDate = 'Transaction date is required.'
      if (!entry.natureOfTransaction.trim()) fields.natureOfTransaction = 'Nature of transaction is required.'
      if (!entry.surveyNo.trim()) fields.surveyNo = 'Survey number is required.'
      if (Object.keys(fields).length > 0) {
        nextErrors[entryIndex] = fields
      }
    })
    setChainHistoryErrors(nextErrors)
    return nextErrors
  }

  const validateStage = (stageIndex: number) => {
    const stageFields: Partial<Record<number, Array<[keyof PropertyState, string]>>> = {
      0: [
        ['propertyTypeCode', 'Property type is required.'],
        ['classificationCode', 'Classification is required.'],
      ],
      2: [
        ['sroCode', 'SRO is required.'],
        ['districtCode', 'Registration district is required.'],
        ['talukCode', 'Taluk is required.'],
        ['villageCode', 'Revenue village is required.'],
      ],
      4: [
        ['boundaryNorth', 'North boundary is required.'],
        ['boundarySouth', 'South boundary is required.'],
        ['boundaryEast', 'East boundary is required.'],
        ['boundaryWest', 'West boundary is required.'],
      ],
    }
    const fields = stageFields[stageIndex] ?? []
    const currentFieldErrors: Record<string, string> = {}
    for (const [field, message] of fields) {
      if (property[field].trim().length === 0) currentFieldErrors[field] = message
    }
    setFieldErrors((current) => {
      const next = { ...current }
      fields.forEach(([field]) => delete next[field])
      return { ...next, ...currentFieldErrors }
    })

    let currentOwnerErrors: OwnerErrors = {}
    if (stageIndex === 1) {
      currentOwnerErrors = collectOwnerErrors()
      setOwnerErrors(currentOwnerErrors)
      if (ownerTypeError) {
        setFieldErrors((current) => ({ ...current, ownerTypeCode: ownerTypeError }))
        return false
      }
    }
    let currentSurveyErrors: SurveyRecordErrors = {}
    if (stageIndex === 3) {
      currentSurveyErrors = surveyRecordErrors(surveyRecords)
      setSurveyErrors(currentSurveyErrors)
    }
    const currentMeasurementErrors = stageIndex === 4 ? validateBoundaryMeasurements() : {}
    const currentChainHistoryErrors = stageIndex === 5 ? validateChainHistory() : {}
    return Object.keys(currentFieldErrors).length === 0
      && Object.keys(currentSurveyErrors).length === 0
      && Object.keys(currentOwnerErrors).length === 0
      && Object.keys(currentMeasurementErrors).length === 0
      && Object.keys(currentChainHistoryErrors).length === 0
  }

  const goToStage = (targetStage: number) => {
    if (targetStage > activeStage) {
      for (let stageIndex = activeStage; stageIndex < targetStage; stageIndex += 1) {
        if (!validateStage(stageIndex)) {
          setActiveStage(stageIndex)
          return
        }
      }
    }
    setActiveStage(targetStage)
  }

  const save = async () => {
    setError('')
    const requiredFields: Array<[keyof PropertyState, string]> = [
      ['propertyTypeCode', 'Property type is required.'],
      ['classificationCode', 'Classification is required.'],
      ['sroCode', 'SRO is required.'],
      ['districtCode', 'Registration district is required.'],
      ['talukCode', 'Taluk is required.'],
      ['villageCode', 'Revenue village is required.'],
      ['boundaryNorth', 'North boundary is required.'],
      ['boundarySouth', 'South boundary is required.'],
      ['boundaryEast', 'East boundary is required.'],
      ['boundaryWest', 'West boundary is required.'],
    ]
    const validationErrors: Record<string, string> = {}
    for (const [field, message] of requiredFields) {
      if (property[field].trim().length === 0) validationErrors[field] = message
    }
    if (ownerTypeError) validationErrors.ownerTypeCode = ownerTypeError
    const validationOwnerErrors = collectOwnerErrors()
    const validationSurveyErrors = surveyRecordErrors(surveyRecords)
    setSurveyErrors(validationSurveyErrors)
    const validationMeasurementErrors = validateBoundaryMeasurements()
    const validationChainHistoryErrors = validateChainHistory()
    setFieldErrors(validationErrors)
    setOwnerErrors(validationOwnerErrors)
    if (Object.keys(validationErrors).length > 0 || Object.keys(validationOwnerErrors).length > 0
      || Object.keys(validationSurveyErrors).length > 0
      || Object.keys(validationMeasurementErrors).length > 0 || Object.keys(validationChainHistoryErrors).length > 0) {
      if (Object.keys(validationOwnerErrors).length > 0 || validationErrors.ownerTypeCode) setActiveStage(1)
      else if (['sroCode', 'districtCode', 'talukCode', 'villageCode'].some((key) => validationErrors[key])) setActiveStage(2)
      else if (Object.keys(validationSurveyErrors).length > 0) setActiveStage(3)
      else if (Object.keys(validationMeasurementErrors).length > 0 || ['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'].some((key) => validationErrors[key])) setActiveStage(4)
      else if (Object.keys(validationChainHistoryErrors).length > 0) setActiveStage(5)
      else setActiveStage(0)
      return
    }
    setBusy(true)
    try {
      await post<Row>('/api/properties', {
        ...property,
        propertyRef: property.propertyRef || `PR-${property.stateCode}-${Date.now()}`,
        surveyRecords: surveyRecords.map((record) => ({
          ulpin: record.ulpin.trim() || undefined,
          surveyNo: record.surveyNo.trim(),
          subdivisionNo: record.subdivisionNo.trim() || undefined,
          extentValue: Number(record.extentValue),
          extentUnit: record.extentUnit,
        })),
        guidelineValue: property.guidelineValue ? Number(property.guidelineValue) : undefined,
        ownerTypeCode,
        owners: owners.map((owner) => ownerPayload(owner, layout)),
        boundaryMeasurements: boundaryMeasurements.map((measurement) => ({
          fromPoint: measurement.fromPoint,
          toPoint: measurement.toPoint,
          value: Number(measurement.value),
          unit: measurement.unit,
        })),
        chainOfTitle: chainHistory.map((entry) => ({
          executorName: entry.executorName.trim(),
          claimantName: entry.claimantName.trim(),
          transactionDate: entry.transactionDate,
          natureOfTransaction: entry.natureOfTransaction.trim(),
          referenceNo: entry.referenceNo.trim() || undefined,
          surveyNo: entry.surveyNo.trim(),
        })),
      }, true)
      navigate('/properties')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const updateOwner = (index: number, field: OwnerField, value: string) => {
    setOwners((current) => current.map((owner, ownerIndex) => ownerIndex === index ? { ...owner, [field]: value } : owner))
  }
  const updateSurveyRecord = (index: number, field: SurveyRecordField, value: string) => {
    setSurveyRecords((current) => current.map((record, recordIndex) => recordIndex === index ? { ...record, [field]: value } : record))
  }
  const updateChainHistory = (entryIndex: number, field: ChainHistoryField, value: string) => {
    setChainHistory((current) => current.map((entry, index) => index === entryIndex ? { ...entry, [field]: value } : entry))
  }
  const fieldError = (key: keyof PropertyState) => fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null
  const surveyComplete = surveyRecords.length > 0 && Object.keys(surveyRecordErrors(surveyRecords)).length === 0
  const valid = property.talukCode && property.villageCode && property.sroCode && surveyComplete && property.boundaryNorth && property.boundarySouth && property.boundaryEast && property.boundaryWest
  const ownersComplete = Boolean(selectedOwnerType) && owners.length > 0 && (allowMultipleOwners || owners.length === 1)
    && owners.every((owner) => Object.keys(validateOwner(owner, layout)).length === 0)
  const locationComplete = Boolean(property.sroCode && property.districtCode && property.talukCode && property.villageCode)
  const boundariesComplete = Boolean(property.boundaryNorth && property.boundarySouth && property.boundaryEast && property.boundaryWest)
    && boundaryMeasurements.length > 0
    && boundaryMeasurements.every((measurement) => measurement.fromPoint && measurement.toPoint
      && measurement.fromPoint !== measurement.toPoint && Number(measurement.value) > 0 && measurement.unit)
  const chainHistoryComplete = chainHistory.length > 0 && chainHistory.every((entry) => entry.executorName.trim()
    && entry.claimantName.trim()
    && entry.transactionDate
    && entry.natureOfTransaction.trim()
    && entry.surveyNo.trim())
  const stageComplete = [Boolean(property.propertyTypeCode && property.classificationCode), ownersComplete, locationComplete, surveyComplete,
    boundariesComplete, chainHistoryComplete, Boolean(property.guidelineValue)]
  const stageHasErrors = [['propertyTypeCode', 'classificationCode'].some((key) => fieldErrors[key] !== undefined), Object.keys(ownerErrors).length > 0 || fieldErrors.ownerTypeCode !== undefined,
    ['sroCode', 'districtCode', 'talukCode', 'villageCode'].some((key) => fieldErrors[key] !== undefined),
    Object.keys(surveyErrors).length > 0,
    ['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'].some((key) => fieldErrors[key] !== undefined)
      || Object.keys(boundaryMeasurementErrors).length > 0,
    Object.keys(chainHistoryErrors).length > 0, false]
  const stageStatus = (index: number) => {
    if (stageHasErrors[index]) return 'Needs attention'
    if (stageComplete[index]) return 'Complete'
    if (index === 5 || index === 6) return 'Optional'
    const stageHasInput = index === 1
      ? Boolean(ownerTypeCode) || owners.some((owner) => Object.values(owner).some((value) => value.trim().length > 0))
      : index === 2
        ? [property.sroCode, property.talukCode, property.villageCode].some(Boolean)
        : index === 3
          ? surveyRecords.some((record) => [record.ulpin, record.surveyNo, record.subdivisionNo, record.extentValue].some((value) => value.trim().length > 0))
          : index === 4
            ? [property.boundaryNorth, property.boundarySouth, property.boundaryEast, property.boundaryWest].some(Boolean)
            : false
    return stageHasInput ? 'In progress' : 'Not started'
  }
  return (
    <div className="intake-page">
      <div className="page-heading"><div><span className="eyebrow">Registration workspace</span><h1>Mint Property</h1><p className="muted">Create a property record. ULPIN is optional and is entered per survey record when already issued.</p></div></div>
      <Banner kind="error" message={error} />
      <div className="property-stage-layout">
        <div className="property-stage-content">
          <div className="property-stage-tabs" role="tablist" aria-label="Property stages">
            {stages.map((stage, index) => (
              <button type="button" role="tab" id={`property-stage-tab-${index}`} aria-selected={activeStage === index} aria-controls={`property-stage-panel-${index}`} aria-label={`${stage}, ${stageStatus(index)}`} className={`${activeStage === index ? 'active' : ''}${stageComplete[index] ? ' completed' : ''}${stageHasErrors[index] ? ' has-errors' : ''}`} onClick={() => goToStage(index)} key={stage}>
                <span className="property-tab-marker" aria-hidden="true">{stageComplete[index] ? '✓' : index + 1}</span>
                <span className="property-tab-copy"><strong>{stage}</strong><small>{stageStatus(index)}</small></span>
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`property-stage-panel-${activeStage}`} aria-labelledby={`property-stage-tab-${activeStage}`}>
      {activeStage === 0 ? <Panel title="">
        <div className="form-grid three">
          <Field label="Property type" value={property.propertyTypeCode} onChange={(v) => update('propertyTypeCode', v)} options={options('PROPERTY_TYPE', propertyTypeFallback)} required />
          <Field label="Nature of title" value={property.natureOfTitleCode} onChange={(v) => update('natureOfTitleCode', v)} options={natureOfTitleOptions} />
          <Field label="Land type" value={property.landTypeCode} onChange={(v) => update('landTypeCode', v)} options={landTypeOptions} />
          <Field label="Classification" value={property.classificationCode} onChange={(v) => update('classificationCode', v)} options={classificationOptions} required />
        </div>
      </Panel> : null}
      {activeStage === 1 ? <Panel title="" actions={allowMultipleOwners ? <button className="party-add-button" onClick={() => setOwners((current) => [...current, emptyOwner()])}><span aria-hidden="true">+</span> Add owner</button> : undefined}>
        <div className="owner-type-select">
          <Field label="Owner type" value={ownerTypeCode} onChange={changeOwnerType} options={ownerTypeOptions} required />
          {fieldErrors.ownerTypeCode ? <span className="field-error">{fieldErrors.ownerTypeCode}</span> : null}
          {selectedOwnerType ? <small className="muted">{allowMultipleOwners ? 'More than one owner can be added for this owner type.' : 'Only one owner can be recorded for this owner type.'}</small> : null}
        </div>
        {selectedOwnerType ? owners.map((owner, index) => {
          return <section className="owner-entry" key={index}>
            <header className="chain-history-entry-heading">
              <h3>{allowMultipleOwners ? `Owner ${index + 1}` : 'Owner details'}</h3>
              {owners.length > 1 ? <button type="button" className="link" onClick={() => {
                setOwners((current) => current.filter((_, ownerIndex) => ownerIndex !== index))
                setOwnerErrors({})
              }}>Remove owner</button> : null}
            </header>
            <OwnerFields layout={layout} owner={owner} errors={ownerErrors[index]} onChange={(field, value) => updateOwner(index, field, value)} />
          </section>
        }) : null}
      </Panel> : null}
      {activeStage === 2 ? <Panel title="">
        <div className="location-survey-layout">
          <div className="form-grid three">
            <div><Field label="Registration district" value={property.districtCode} onChange={(v) => updateLocation('districtCode', v)} options={districtOptions} required />{fieldError('districtCode')}</div>
            <div><Field label="Sub-Registrar Office (SRO)" value={property.sroCode} onChange={(v) => updateLocation('sroCode', v)} options={sroOptions} required />{fieldError('sroCode')}</div>
            <div><Field label="Taluk" value={property.talukCode} onChange={(v) => updateLocation('talukCode', v)} options={talukOptions} required />{fieldError('talukCode')}</div>
            <div><Field label="Revenue village" value={property.villageCode} onChange={(v) => updateLocation('villageCode', v)} options={villageOptions} required />{fieldError('villageCode')}</div>
            <Field label="Panchayat" value={property.panchayat} onChange={(v) => update('panchayat', v)} />
            <Field label="Ward no." value={property.wardNo} onChange={(v) => update('wardNo', v)} />
            <Field label="Street / door no." value={`${property.street}${property.doorNo ? ` / ${property.doorNo}` : ''}`} onChange={(v) => update('street', v)} />
          </div>
          <PropertyMap location={mapLocation} name={mapLocationName} status={mapStatus} />
        </div>
      </Panel> : null}
      {activeStage === 3 ? <Panel title="" actions={<button type="button" className="party-add-button" onClick={() => setSurveyRecords((current) => [...current, emptySurveyRecord()])}><span aria-hidden="true">+</span> Add survey record</button>}>
        <p className="muted">Add one record for each survey number that forms part of this property. Enter ULPIN only if it is already issued.</p>
        {surveyRecords.map((record, index) => {
          const recordErrors = surveyErrors[index]
          const surveyError = (field: SurveyRecordField) => recordErrors?.[field] ? <span className="field-error">{recordErrors[field]}</span> : null
          return <section className="owner-entry" key={index}>
            <header className="chain-history-entry-heading">
              <h3>{`Survey record ${index + 1}`}</h3>
              {surveyRecords.length > 1 ? <button type="button" className="link" onClick={() => {
                setSurveyRecords((current) => current.filter((_, recordIndex) => recordIndex !== index))
                setSurveyErrors({})
              }}>Remove record</button> : null}
            </header>
            <div className="owner-fields">
              <div><Field label="ULPIN (optional)" value={record.ulpin} onChange={(v) => updateSurveyRecord(index, 'ulpin', v)} placeholder="Enter only if already issued" />{surveyError('ulpin')}</div>
              <div><Field label="Survey no." value={record.surveyNo} onChange={(v) => updateSurveyRecord(index, 'surveyNo', v)} required />{surveyError('surveyNo')}</div>
              <div><Field label="Sub-division no." value={record.subdivisionNo} onChange={(v) => updateSurveyRecord(index, 'subdivisionNo', v)} /></div>
              <div><Field label="Extent" type="number" value={record.extentValue} onChange={(v) => updateSurveyRecord(index, 'extentValue', v.replace(/[^0-9.]/g, ''))} required />{surveyError('extentValue')}</div>
              <div><Field label="Extent unit" value={record.extentUnit} onChange={(v) => updateSurveyRecord(index, 'extentUnit', v)} options={extentUnitOptions} required />{surveyError('extentUnit')}</div>
            </div>
          </section>
        })}
      </Panel> : null}
      {activeStage === 4 ? <Panel title="">
        <div className="form-grid four"><div><Field label="North boundary" value={property.boundaryNorth} onChange={(v) => update('boundaryNorth', v)} required />{fieldError('boundaryNorth')}</div><div><Field label="South boundary" value={property.boundarySouth} onChange={(v) => update('boundarySouth', v)} required />{fieldError('boundarySouth')}</div><div><Field label="East boundary" value={property.boundaryEast} onChange={(v) => update('boundaryEast', v)} required />{fieldError('boundaryEast')}</div><div><Field label="West boundary" value={property.boundaryWest} onChange={(v) => update('boundaryWest', v)} required />{fieldError('boundaryWest')}</div></div>
        <div className="boundary-measurements">
          <div className="boundary-measurements-heading">
            <div><h3>Boundary measurements</h3><p className="muted">Record the measured distance between two boundary points.</p><small className="muted">{boundaryMeasurements.length} of {MAX_BOUNDARY_MEASUREMENTS} measurements</small></div>
            <button type="button" className="outline" disabled={boundaryMeasurements.length >= MAX_BOUNDARY_MEASUREMENTS} onClick={() => setBoundaryMeasurements((current) => current.length >= MAX_BOUNDARY_MEASUREMENTS ? current : [...current, emptyBoundaryMeasurement()])}>Add measurement</button>
          </div>
          {boundaryMeasurements.map((measurement, index) => (
            <div className="boundary-measurement-row" key={index}>
              <div><Field label="From" value={measurement.fromPoint} onChange={(value) => setBoundaryMeasurements((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, fromPoint: value } : row))} options={boundaryPoints} required />{boundaryMeasurementErrors[index]?.fromPoint ? <span className="field-error">{boundaryMeasurementErrors[index].fromPoint}</span> : null}</div>
              <div><Field label="To" value={measurement.toPoint} onChange={(value) => setBoundaryMeasurements((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, toPoint: value } : row))} options={boundaryPoints} required />{boundaryMeasurementErrors[index]?.toPoint ? <span className="field-error">{boundaryMeasurementErrors[index].toPoint}</span> : null}</div>
              <div><Field label="Extent" type="number" value={measurement.value} onChange={(value) => setBoundaryMeasurements((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, value } : row))} required />{boundaryMeasurementErrors[index]?.value ? <span className="field-error">{boundaryMeasurementErrors[index].value}</span> : null}</div>
              <div><Field label="Extent unit" value={measurement.unit} onChange={(value) => setBoundaryMeasurements((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unit: value } : row))} options={options('EXTENT_UNIT', extentUnitFallback)} required />{boundaryMeasurementErrors[index]?.unit ? <span className="field-error">{boundaryMeasurementErrors[index].unit}</span> : null}</div>
              {boundaryMeasurements.length > 1 ? <button type="button" className="boundary-measurement-remove" aria-label={`Remove measurement ${index + 1}`} onClick={() => {
                setBoundaryMeasurements((current) => current.filter((_, rowIndex) => rowIndex !== index))
                setBoundaryMeasurementErrors({})
              }}>Remove</button> : null}
            </div>
          ))}
        </div>
      </Panel> : null}
      {activeStage === 5 ? <Panel title="" actions={<button type="button" className="outline" onClick={() => setChainHistory((current) => [...current, emptyChainHistoryEntry(surveyRecords[0]?.surveyNo ?? '')])}>Add record</button>}>
        <p className="muted">Add the earlier registered transfers for this property. Start with the earliest known owner and leave the section empty if there is no prior history to record.</p>
        {chainHistory.length === 0 ? <p className="chain-history-empty">No chain-of-title records added.</p> : null}
        {chainHistory.map((entry, entryIndex) => {
          const entryErrors = chainHistoryErrors[entryIndex]
          return <section className="chain-history-entry" key={entryIndex}>
            <header className="chain-history-entry-heading">
              <h3>{entryIndex === 0 ? 'Earliest known owner' : `Record ${entryIndex + 1}`}</h3>
              <button type="button" className="link" onClick={() => {
                setChainHistory((current) => current.filter((_, index) => index !== entryIndex))
                setChainHistoryErrors({})
              }}>Remove record</button>
            </header>
            <div className="chain-history-fields">
              <div><Field label="Executor / Seller" value={entry.executorName} onChange={(value) => updateChainHistory(entryIndex, 'executorName', value)} required />{entryErrors?.executorName ? <span className="field-error">{entryErrors.executorName}</span> : null}</div>
              <div><Field label="Claimant / Purchaser" value={entry.claimantName} onChange={(value) => updateChainHistory(entryIndex, 'claimantName', value)} required />{entryErrors?.claimantName ? <span className="field-error">{entryErrors.claimantName}</span> : null}</div>
              <div><Field label="Transaction date" type="date" value={entry.transactionDate} onChange={(value) => updateChainHistory(entryIndex, 'transactionDate', value)} required />{entryErrors?.transactionDate ? <span className="field-error">{entryErrors.transactionDate}</span> : null}</div>
              <div><Field label="Nature of transaction" value={entry.natureOfTransaction} onChange={(value) => updateChainHistory(entryIndex, 'natureOfTransaction', value)} options={natureOfTransactionOptions} required />{entryErrors?.natureOfTransaction ? <span className="field-error">{entryErrors.natureOfTransaction}</span> : null}</div>
              <div><Field label="Registration / Reference No." value={entry.referenceNo} onChange={(value) => updateChainHistory(entryIndex, 'referenceNo', value)} /></div>
              <div><Field label="Survey No." value={entry.surveyNo} onChange={(value) => updateChainHistory(entryIndex, 'surveyNo', value)} required />{entryErrors?.surveyNo ? <span className="field-error">{entryErrors.surveyNo}</span> : null}</div>
            </div>
          </section>
        })}
      </Panel> : null}
      {activeStage === 6 ? <Panel title="">
        <div className="form-grid three"><Field label="Guideline value" value={property.guidelineValue} onChange={(v) => update('guidelineValue', v)} type="number" /><Field label="Notification / register reference" value={property.guidelineValueReference} onChange={(v) => update('guidelineValueReference', v)} /></div>
        <p className="advisory">Not fetched from an API. Editable again during transaction review; every change is written to the audit trail.</p>
      </Panel> : null}
          </div>
          <div className="property-stage-actions">
            <button type="button" onClick={() => setActiveStage((current) => Math.max(0, current - 1))} disabled={activeStage === 0}>Previous section</button>
            {activeStage < stages.length - 1 ? <button type="button" className="primary" onClick={() => goToStage(activeStage + 1)}>Next section</button> : null}
            {activeStage === stages.length - 1 ? <button type="button" className="primary" disabled={!valid || busy} onClick={() => void save()}>{busy ? 'Saving property…' : 'Save property record'}</button> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

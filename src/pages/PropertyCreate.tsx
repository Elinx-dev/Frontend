import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, post } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner, Field, Panel } from '../ui'

const initialProperty = {
  stateCode: 'TN', propertyRef: '', ulpin: '', propertyTypeCode: 'LAND',
  natureOfTitleCode: 'ABSOLUTE', landTypeCode: 'RURAL', classificationCode: 'PUNJAI_DRY',
  extentValue: '', extentUnit: 'SQ_FT', surveyNo: '', subdivisionNo: '', oldSurveyReference: '',
  fmbReferenceNo: '', districtCode: '', talukCode: '', villageCode: '', sroCode: '',
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
interface BoundaryMeasurement {
  fromPoint: string
  toPoint: string
  value: string
  unit: string
}
type BoundaryMeasurementField = keyof BoundaryMeasurement
type BoundaryMeasurementErrors = Record<number, Partial<Record<BoundaryMeasurementField, string>>>
interface PreviousOwnerHistory {
  ownerName: string
  address: string
  aadhaarNumber: string
  pan: string
  sharePct: string
}
interface ChainHistoryEntry {
  transactionDate: string
  natureOfTransaction: string
  referenceNo: string
  propertyValue: string
  registrationFee: string
  registeringOffice: string
  owners: PreviousOwnerHistory[]
}
type ChainHistoryHeaderField = Exclude<keyof ChainHistoryEntry, 'owners'>
type PreviousOwnerHistoryField = keyof PreviousOwnerHistory
interface ChainHistoryEntryErrors {
  fields?: Partial<Record<ChainHistoryHeaderField, string>>
  owners?: Record<number, Partial<Record<PreviousOwnerHistoryField, string>>>
}
type ChainHistoryErrors = Record<number, ChainHistoryEntryErrors>

const emptyOwner = (): OwnerForm => ({ ownerName: '', aadhaarNumber: '', pan: '', address: '', sharePct: '' })
const emptyBoundaryMeasurement = (): BoundaryMeasurement => ({ fromPoint: '', toPoint: '', value: '', unit: 'SQ_FT' })
const emptyPreviousOwnerHistory = (): PreviousOwnerHistory => ({ ownerName: '', address: '', aadhaarNumber: '', pan: '', sharePct: '' })
const emptyChainHistoryEntry = (): ChainHistoryEntry => ({
  transactionDate: '', natureOfTransaction: '', referenceNo: '', propertyValue: '', registrationFee: '',
  registeringOffice: '', owners: [emptyPreviousOwnerHistory()],
})
const AADHAAR_PATTERN = /^\d{12}$/
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const CITY_CENTER = { latitude: 13.0827, longitude: 80.2707 }
const stages = ['Identification', 'Property owners', 'Location & Survey', 'Boundaries', 'Chain of Title', 'Guideline Value'] as const
const MAX_BOUNDARY_MEASUREMENTS = 8
const boundaryPoints = [
  { value: 'NORTH', label: 'North' },
  { value: 'SOUTH', label: 'South' },
  { value: 'EAST', label: 'East' },
  { value: 'WEST', label: 'West' },
  { value: 'NORTH_EAST', label: 'North-east' },
  { value: 'NORTH_WEST', label: 'North-west' },
  { value: 'SOUTH_EAST', label: 'South-east' },
  { value: 'SOUTH_WEST', label: 'South-west' },
]

type MapLocation = typeof CITY_CENTER
type MapStatus = 'fallback' | 'loading' | 'located'

const mapEmbedUrl = ({ latitude, longitude }: MapLocation) => {
  const west = longitude - 0.025
  const east = longitude + 0.025
  const south = latitude - 0.018
  const north = latitude + 0.018
  return `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${latitude}%2C${longitude}`
}

export default function PropertyCreate() {
  const navigate = useNavigate()
  const { bootstrap } = useAuth()
  const [property, setProperty] = useState<PropertyState>(initialProperty)
  const [owners, setOwners] = useState<OwnerForm[]>([emptyOwner()])
  const [boundaryMeasurements, setBoundaryMeasurements] = useState<BoundaryMeasurement[]>([emptyBoundaryMeasurement()])
  const [chainHistory, setChainHistory] = useState<ChainHistoryEntry[]>([])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [ownerErrors, setOwnerErrors] = useState<OwnerErrors>({})
  const [boundaryMeasurementErrors, setBoundaryMeasurementErrors] = useState<BoundaryMeasurementErrors>({})
  const [chainHistoryErrors, setChainHistoryErrors] = useState<ChainHistoryErrors>({})
  const [busy, setBusy] = useState(false)
  const [mapLocation, setMapLocation] = useState<MapLocation>(CITY_CENTER)
  const [mapStatus, setMapStatus] = useState<MapStatus>('fallback')
  const [mapLocationName, setMapLocationName] = useState('Chennai, Tamil Nadu')
  const [activeStage, setActiveStage] = useState(0)

  useEffect(() => {
    const hasLocationDetails = [property.villageCode, property.talukCode, property.street, property.doorNo]
      .some((value) => value.trim().length > 0)
    if (!hasLocationDetails) {
      setMapLocation(CITY_CENTER)
      setMapLocationName('Chennai, Tamil Nadu')
      setMapStatus('fallback')
      return
    }

    const query = [
      property.doorNo,
      property.street,
      property.villageCode.replaceAll('_', ' '),
      property.talukCode.replaceAll('_', ' '),
      property.districtCode.replaceAll('_', ' '),
      'Tamil Nadu',
      'India',
    ].filter((part) => part.trim().length > 0).join(', ')
    const controller = new AbortController()
    setMapStatus('loading')
    const timeout = window.setTimeout(() => {
      void fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Location search failed')
          return await response.json() as Array<{ lat: string; lon: string; display_name: string }>
        })
        .then((results) => {
          const result = results[0]
          if (!result || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon))) {
            setMapLocation(CITY_CENTER)
            setMapLocationName('Chennai, Tamil Nadu')
            setMapStatus('fallback')
            return
          }
          setMapLocation({ latitude: Number(result.lat), longitude: Number(result.lon) })
          setMapLocationName(result.display_name)
          setMapStatus('located')
        })
        .catch((reason: unknown) => {
          if (reason instanceof DOMException && reason.name === 'AbortError') return
          setMapLocation(CITY_CENTER)
          setMapLocationName('Chennai, Tamil Nadu')
          setMapStatus('fallback')
        })
    }, 1000)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [property.districtCode, property.doorNo, property.street, property.talukCode, property.villageCode])

  const update = (key: keyof PropertyState, value: string) => setProperty((current) => ({ ...current, [key]: value }))
  const options = (key: string, fallback: { value: string; label: string }[]) => {
    const rows = bootstrap?.optionSets[key] ?? []
    const mapped = rows.map((row) => ({ value: String(row.code ?? row.value ?? ''), label: String(row.name ?? row.label ?? row.code ?? row.value ?? '') })).filter((row) => row.value)
    return mapped.length > 0 ? mapped : fallback
  }

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
      const fields: Partial<Record<ChainHistoryHeaderField, string>> = {}
      if (!entry.transactionDate) fields.transactionDate = 'Transaction date is required.'
      if (!entry.natureOfTransaction) fields.natureOfTransaction = 'Deed type is required.'
      if (entry.propertyValue.trim().length === 0 || !Number.isFinite(Number(entry.propertyValue)) || Number(entry.propertyValue) <= 0) {
        fields.propertyValue = 'Enter a property value greater than zero.'
      }
      if (entry.registrationFee.trim().length === 0 || !Number.isFinite(Number(entry.registrationFee)) || Number(entry.registrationFee) < 0) {
        fields.registrationFee = 'Enter a valid registration fee.'
      }
      if (!entry.registeringOffice.trim()) fields.registeringOffice = 'Registration office is required.'

      const ownerErrors: NonNullable<ChainHistoryEntryErrors['owners']> = {}
      entry.owners.forEach((owner, ownerIndex) => {
        const errors: Partial<Record<PreviousOwnerHistoryField, string>> = {}
        if (!owner.ownerName.trim()) errors.ownerName = 'Owner name is required.'
        if (!owner.address.trim()) errors.address = 'Address is required.'
        if (!AADHAAR_PATTERN.test(owner.aadhaarNumber)) errors.aadhaarNumber = 'Aadhaar must contain exactly 12 digits.'
        if (!PAN_PATTERN.test(owner.pan)) errors.pan = 'PAN must match AAAAA9999A.'
        const share = Number(owner.sharePct)
        if (owner.sharePct.trim().length === 0) errors.sharePct = 'Share percentage is required.'
        else if (!Number.isFinite(share) || share < 0 || share > 100) errors.sharePct = 'Share must be between 0 and 100.'
        if (Object.keys(errors).length > 0) ownerErrors[ownerIndex] = errors
      })
      if (Object.keys(fields).length > 0 || Object.keys(ownerErrors).length > 0) {
        nextErrors[entryIndex] = { fields, owners: ownerErrors }
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
        ['surveyNo', 'Survey number is required.'],
        ['extentValue', 'Extent is required.'],
        ['extentUnit', 'Extent unit is required.'],
      ],
      3: [
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
    if (stageIndex === 2 && property.extentValue.trim().length > 0 && Number.isNaN(Number(property.extentValue))) {
      currentFieldErrors.extentValue = 'Extent must be numeric.'
    }
    setFieldErrors((current) => {
      const next = { ...current }
      fields.forEach(([field]) => delete next[field])
      return { ...next, ...currentFieldErrors }
    })

    let currentOwnerErrors: OwnerErrors = {}
    if (stageIndex === 1) {
      owners.forEach((owner, index) => {
        const errors: Partial<Record<OwnerField, string>> = {}
        if (owner.ownerName.trim().length === 0) errors.ownerName = 'Owner name is required.'
        if (!AADHAAR_PATTERN.test(owner.aadhaarNumber)) errors.aadhaarNumber = 'Aadhaar must contain exactly 12 digits.'
        if (owner.pan.trim().length === 0) errors.pan = 'PAN is required.'
        else if (!PAN_PATTERN.test(owner.pan)) errors.pan = 'PAN must match AAAAA9999A.'
        if (owner.address.trim().length === 0) errors.address = 'Address is required.'
        const share = Number(owner.sharePct)
        if (owner.sharePct.trim().length === 0) errors.sharePct = 'Share percentage is required.'
        else if (!Number.isFinite(share) || share < 0 || share > 100) errors.sharePct = 'Share must be between 0 and 100.'
        if (Object.keys(errors).length > 0) currentOwnerErrors[index] = errors
      })
      setOwnerErrors(currentOwnerErrors)
    }
    const currentMeasurementErrors = stageIndex === 3 ? validateBoundaryMeasurements() : {}
    const currentChainHistoryErrors = stageIndex === 4 ? validateChainHistory() : {}
    return Object.keys(currentFieldErrors).length === 0
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
      if (owner.pan.trim().length === 0) errors.pan = 'PAN is required.'
      else if (!PAN_PATTERN.test(owner.pan)) errors.pan = 'PAN must match AAAAA9999A.'
      if (owner.address.trim().length === 0) errors.address = 'Address is required.'
      const share = Number(owner.sharePct)
      if (owner.sharePct.trim().length === 0) errors.sharePct = 'Share percentage is required.'
      else if (!Number.isFinite(share) || share < 0 || share > 100) errors.sharePct = 'Share must be between 0 and 100.'
      if (Object.keys(errors).length > 0) validationOwnerErrors[index] = errors
    })
    const validationMeasurementErrors = validateBoundaryMeasurements()
    const validationChainHistoryErrors = validateChainHistory()
    setFieldErrors(validationErrors)
    setOwnerErrors(validationOwnerErrors)
    if (Object.keys(validationErrors).length > 0 || Object.keys(validationOwnerErrors).length > 0
      || Object.keys(validationMeasurementErrors).length > 0 || Object.keys(validationChainHistoryErrors).length > 0) {
      if (Object.keys(validationOwnerErrors).length > 0) setActiveStage(1)
      else if (['sroCode', 'districtCode', 'talukCode', 'villageCode', 'surveyNo', 'extentValue'].some((key) => validationErrors[key])) setActiveStage(2)
      else if (Object.keys(validationMeasurementErrors).length > 0 || ['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'].some((key) => validationErrors[key])) setActiveStage(3)
      else if (Object.keys(validationChainHistoryErrors).length > 0) setActiveStage(4)
      else setActiveStage(0)
      return
    }
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
        boundaryMeasurements: boundaryMeasurements.map((measurement) => ({
          fromPoint: measurement.fromPoint,
          toPoint: measurement.toPoint,
          value: Number(measurement.value),
          unit: measurement.unit,
        })),
        chainOfTitle: chainHistory.map((entry) => ({
          transactionDate: entry.transactionDate,
          natureOfTransaction: entry.natureOfTransaction,
          referenceNo: entry.referenceNo || undefined,
          propertyValue: Number(entry.propertyValue),
          registrationFee: Number(entry.registrationFee),
          registeringOffice: entry.registeringOffice.trim(),
          owners: entry.owners.map((owner) => ({
            ownerName: owner.ownerName.trim(),
            address: owner.address.trim(),
            aadhaarNumber: owner.aadhaarNumber,
            pan: owner.pan,
            sharePct: Number(owner.sharePct),
          })),
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
  const updateChainHistory = (entryIndex: number, field: ChainHistoryHeaderField, value: string) => {
    setChainHistory((current) => current.map((entry, index) => index === entryIndex ? { ...entry, [field]: value } : entry))
  }
  const updateChainHistoryOwner = (entryIndex: number, ownerIndex: number, field: PreviousOwnerHistoryField, value: string) => {
    setChainHistory((current) => current.map((entry, index) => index !== entryIndex ? entry : {
      ...entry,
      owners: entry.owners.map((owner, currentOwnerIndex) => currentOwnerIndex === ownerIndex ? { ...owner, [field]: value } : owner),
    }))
  }
  const fieldError = (key: keyof PropertyState) => fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null
  const ownerFieldError = (index: number, field: OwnerField) => ownerErrors[index]?.[field] ? <span className="field-error">{ownerErrors[index][field]}</span> : null
  const valid = property.talukCode && property.villageCode && property.sroCode && property.surveyNo && property.extentValue && property.boundaryNorth && property.boundarySouth && property.boundaryEast && property.boundaryWest
  const ownersComplete = owners.length > 0 && owners.every((owner) => owner.ownerName.trim().length > 0
    && AADHAAR_PATTERN.test(owner.aadhaarNumber)
    && (owner.pan.length === 0 || PAN_PATTERN.test(owner.pan))
    && owner.address.trim().length > 0
    && owner.sharePct.trim().length > 0
    && Number.isFinite(Number(owner.sharePct))
    && Number(owner.sharePct) >= 0 && Number(owner.sharePct) <= 100)
  const locationComplete = Boolean(property.sroCode && property.districtCode && property.talukCode && property.villageCode
    && property.surveyNo && property.extentValue && property.extentUnit && !Number.isNaN(Number(property.extentValue)))
  const boundariesComplete = Boolean(property.boundaryNorth && property.boundarySouth && property.boundaryEast && property.boundaryWest)
    && boundaryMeasurements.length > 0
    && boundaryMeasurements.every((measurement) => measurement.fromPoint && measurement.toPoint
      && measurement.fromPoint !== measurement.toPoint && Number(measurement.value) > 0 && measurement.unit)
  const chainHistoryComplete = chainHistory.length > 0 && chainHistory.every((entry) => entry.transactionDate && entry.natureOfTransaction
    && Number(entry.propertyValue) > 0 && Number(entry.registrationFee) >= 0 && entry.registeringOffice.trim()
    && entry.owners.length > 0 && entry.owners.every((owner) => owner.ownerName.trim() && owner.address.trim()
      && AADHAAR_PATTERN.test(owner.aadhaarNumber) && PAN_PATTERN.test(owner.pan)
      && Number.isFinite(Number(owner.sharePct)) && Number(owner.sharePct) >= 0 && Number(owner.sharePct) <= 100))
  const stageComplete = [Boolean(property.propertyTypeCode && property.classificationCode), ownersComplete, locationComplete,
    boundariesComplete, chainHistoryComplete, Boolean(property.guidelineValue)]
  const stageHasErrors = [['propertyTypeCode', 'classificationCode'].some((key) => fieldErrors[key] !== undefined), Object.keys(ownerErrors).length > 0,
    ['sroCode', 'districtCode', 'talukCode', 'villageCode', 'surveyNo', 'extentValue', 'extentUnit'].some((key) => fieldErrors[key] !== undefined),
    ['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'].some((key) => fieldErrors[key] !== undefined)
      || Object.keys(boundaryMeasurementErrors).length > 0,
    Object.keys(chainHistoryErrors).length > 0, false]
  const stageStatus = (index: number) => {
    if (stageHasErrors[index]) return 'Needs attention'
    if (stageComplete[index]) return 'Complete'
    if (index === 4 || index === 5) return 'Optional'
    const stageHasInput = index === 1
      ? owners.some((owner) => Object.values(owner).some((value) => value.trim().length > 0))
      : index === 2
        ? [property.sroCode, property.talukCode, property.villageCode, property.surveyNo, property.extentValue].some(Boolean)
        : index === 3
          ? [property.boundaryNorth, property.boundarySouth, property.boundaryEast, property.boundaryWest].some(Boolean)
          : index === 4
            ? chainHistory.length > 0
          : false
    return stageHasInput ? 'In progress' : 'Not started'
  }
  return (
    <div className="intake-page">
      <div className="page-heading"><div><span className="eyebrow">Registration workspace</span><h1>Mint Property</h1><p className="muted">Create a property record. ULPIN is optional and can be added when already issued.</p></div></div>
      <Banner kind="error" message={error} />
      <div className="property-stage-layout">
        <aside className="property-stage-sidebar" aria-label="Mint Property stages">
          <h2>Mint Property stages</h2>
          <ol>
            {stages.map((stage, index) => (
              <li key={stage}>
                <button type="button" className={`property-stage-item${activeStage === index ? ' active' : ''}${stageComplete[index] ? ' completed' : ''}${stageHasErrors[index] ? ' has-errors' : ''}`} onClick={() => goToStage(index)} aria-current={activeStage === index ? 'step' : undefined}>
                  <span className="property-stage-marker">{stageComplete[index] ? '✓' : index + 1}</span>
                  <span className="property-stage-copy"><strong>{stage}</strong><small>{stageStatus(index)}</small></span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <div className="property-stage-content">
          <div className="property-stage-tabs" role="tablist" aria-label="Mint Property sections">
            {stages.map((stage, index) => (
              <button type="button" role="tab" id={`property-stage-tab-${index}`} aria-selected={activeStage === index} aria-controls={`property-stage-panel-${index}`} className={activeStage === index ? 'active' : ''} onClick={() => goToStage(index)} key={stage}>{stage}</button>
            ))}
          </div>
          <div role="tabpanel" id={`property-stage-panel-${activeStage}`} aria-labelledby={`property-stage-tab-${activeStage}`}>
      {activeStage === 0 ? <Panel title="Identification" actions={<span className="stage-label">Mint property</span>}>
        <div className="form-grid three">
          <Field label="ULPIN (optional)" value={property.ulpin} onChange={(v) => update('ulpin', v)} placeholder="Enter only if already issued" />
          <Field label="Property type" value={property.propertyTypeCode} onChange={(v) => update('propertyTypeCode', v)} options={options('PROPERTY_TYPE', [{ value: 'LAND', label: 'Land Parcel' }, { value: 'HOUSE_SITE', label: 'House Site' }, { value: 'BUILDING', label: 'Building' }, { value: 'APARTMENT_UNIT', label: 'Apartment / Flat' }, { value: 'AGRICULTURAL', label: 'Agricultural Land' }, { value: 'COMMERCIAL', label: 'Commercial' }, { value: 'INDUSTRIAL', label: 'Industrial' }, { value: 'PLOT_SITE', label: 'Plot / Site' }])} required />
          <Field label="Nature of title" value={property.natureOfTitleCode} onChange={(v) => update('natureOfTitleCode', v)} options={[{ value: 'FREEHOLD', label: 'Freehold' }, { value: 'LEASEHOLD', label: 'Leasehold' }]} />
          <Field label="Land type" value={property.landTypeCode} onChange={(v) => update('landTypeCode', v)} options={[{ value: 'RURAL', label: 'Rural' }, { value: 'URBAN', label: 'Urban' }]} />
          <Field label="Classification" value={property.classificationCode} onChange={(v) => update('classificationCode', v)} options={[{ value: 'Dry', label: 'Dry' }, { value: 'Wet', label: 'Wet' }]} required />
        </div>
      </Panel> : null}
      {activeStage === 1 ? <Panel title="Property owners" actions={<button className="party-add-button" onClick={() => setOwners((current) => [...current, emptyOwner()])}><span aria-hidden="true">+</span> Add owner</button>}>
        {owners.map((owner, index) => (
          <div className="row party-row" key={index}>
            <div><Field label="Name" value={owner.ownerName} onChange={(v) => updateOwner(index, 'ownerName', v)} required />{ownerFieldError(index, 'ownerName')}</div>
            <div><Field label="Aadhaar (12 digits)" value={owner.aadhaarNumber} onChange={(v) => updateOwner(index, 'aadhaarNumber', v.replace(/\D/g, '').slice(0, 12))} required />{ownerFieldError(index, 'aadhaarNumber')}</div>
            <div><Field label="PAN" value={owner.pan} onChange={(v) => updateOwner(index, 'pan', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} required />{ownerFieldError(index, 'pan')}</div>
            <div><Field label="Address" value={owner.address} onChange={(v) => updateOwner(index, 'address', v)} required />{ownerFieldError(index, 'address')}</div>
            <div><Field label="Share %" value={owner.sharePct} onChange={(v) => updateOwner(index, 'sharePct', v)} type="number" required />{ownerFieldError(index, 'sharePct')}</div>
            {owners.length > 1 ? <button type="button" onClick={() => setOwners((current) => current.filter((_, ownerIndex) => ownerIndex !== index))}>Remove</button> : null}
          </div>
        ))}
      </Panel> : null}
      {activeStage === 2 ? <Panel title="Location & Survey">
        <div className="location-survey-layout">
          <div className="form-grid three">
            <div><Field label="Sub-Registrar Office (SRO)" value={property.sroCode} onChange={(v) => update('sroCode', v)} required />{fieldError('sroCode')}</div>
            <div><Field label="Registration district" value={property.districtCode} onChange={(v) => update('districtCode', v)} required />{fieldError('districtCode')}</div>
            <div><Field label="Taluk" value={property.talukCode} onChange={(v) => update('talukCode', v)} required />{fieldError('talukCode')}</div>
            <div><Field label="Revenue village" value={property.villageCode} onChange={(v) => update('villageCode', v)} required />{fieldError('villageCode')}</div>
            <div><Field label="Survey no." value={property.surveyNo} onChange={(v) => update('surveyNo', v)} required />{fieldError('surveyNo')}</div>
            <Field label="Sub-division no." value={property.subdivisionNo} onChange={(v) => update('subdivisionNo', v)} />
            <div><Field label="Extent" value={property.extentValue} onChange={(v) => numeric('extentValue', v)} type="number" required />{fieldError('extentValue')}</div>
            <div><Field label="Extent unit" value={property.extentUnit} onChange={(v) => update('extentUnit', v)} options={[{ value: 'SQ_FT', label: 'Square feet' }, { value: 'HECTARE', label: 'Hectare' }]} required />{fieldError('extentUnit')}</div>
            <Field label="Panchayat" value={property.panchayat} onChange={(v) => update('panchayat', v)} />
            <Field label="Ward no." value={property.wardNo} onChange={(v) => update('wardNo', v)} />
            <Field label="Street / door no." value={`${property.street}${property.doorNo ? ` / ${property.doorNo}` : ''}`} onChange={(v) => update('street', v)} />
          </div>
          <aside className="property-map-panel" aria-label="Property map location">
            <div className="property-map-heading">
              <div>
                <strong>Map location</strong>
                <span>{mapStatus === 'located' ? mapLocationName : 'Chennai, Tamil Nadu'}</span>
              </div>
              {mapStatus === 'located' ? <span className="map-pin-status">Located</span> : null}
            </div>
            <div className="property-map-frame">
              <iframe
                title={`Map showing ${mapStatus === 'located' ? mapLocationName : 'Chennai, Tamil Nadu'}`}
                src={mapEmbedUrl(mapLocation)}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {mapStatus !== 'located' ? (
                <div className="property-map-message" role="status">
                  <strong>{mapStatus === 'loading' ? 'Locating area…' : 'Unable to locate on map'}</strong>
                  <span>{mapStatus === 'loading' ? 'Searching the entered village or address.' : 'Showing Chennai as the city reference.'}</span>
                </div>
              ) : null}
            </div>
            <span className="map-attribution">Map data © OpenStreetMap contributors</span>
          </aside>
        </div>
      </Panel> : null}
      {activeStage === 3 ? <Panel title="Boundaries">
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
              <div><Field label="Extent unit" value={measurement.unit} onChange={(value) => setBoundaryMeasurements((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unit: value } : row))} options={options('EXTENT_UNIT', [{ value: 'SQ_FT', label: 'Square Feet' }, { value: 'SQ_M', label: 'Square Metres' }, { value: 'CENT', label: 'Cent' }, { value: 'ACRE', label: 'Acre' }, { value: 'HECTARE', label: 'Hectare' }])} required />{boundaryMeasurementErrors[index]?.unit ? <span className="field-error">{boundaryMeasurementErrors[index].unit}</span> : null}</div>
              {boundaryMeasurements.length > 1 ? <button type="button" className="boundary-measurement-remove" aria-label={`Remove measurement ${index + 1}`} onClick={() => {
                setBoundaryMeasurements((current) => current.filter((_, rowIndex) => rowIndex !== index))
                setBoundaryMeasurementErrors({})
              }}>Remove</button> : null}
            </div>
          ))}
        </div>
      </Panel> : null}
      {activeStage === 4 ? <Panel title="Chain of Title" actions={<button type="button" className="outline" onClick={() => setChainHistory((current) => [...current, emptyChainHistoryEntry()])}>Add previous transaction</button>}>
        <p className="muted">Add prior registered transactions for this property. Leave this section empty if there is no earlier history to record.</p>
        {chainHistory.length === 0 ? <p className="chain-history-empty">No prior transactions added.</p> : null}
        {chainHistory.map((entry, entryIndex) => {
          const entryErrors = chainHistoryErrors[entryIndex]
          const deedTypeOptions = bootstrap?.deedTypes.map((deed) => ({ value: String(deed.code), label: String(deed.name) }))
            ?? [{ value: 'SALE', label: 'Sale' }, { value: 'GIFT', label: 'Gift' }, { value: 'SETTLEMENT', label: 'Settlement' }, { value: 'PARTITION', label: 'Partition' }, { value: 'OTHER', label: 'Other' }]
          return <section className="chain-history-entry" key={entryIndex}>
            <header className="chain-history-entry-heading">
              <h3>Previous transaction {entryIndex + 1}</h3>
              <button type="button" className="link" onClick={() => {
                setChainHistory((current) => current.filter((_, index) => index !== entryIndex))
                setChainHistoryErrors({})
              }}>Remove transaction</button>
            </header>
            <div className="chain-history-fields">
              <div><Field label="Deed type" value={entry.natureOfTransaction} onChange={(value) => updateChainHistory(entryIndex, 'natureOfTransaction', value)} options={deedTypeOptions} required />{entryErrors?.fields?.natureOfTransaction ? <span className="field-error">{entryErrors.fields.natureOfTransaction}</span> : null}</div>
              <div><Field label="Transaction date" type="date" value={entry.transactionDate} onChange={(value) => updateChainHistory(entryIndex, 'transactionDate', value)} required />{entryErrors?.fields?.transactionDate ? <span className="field-error">{entryErrors.fields.transactionDate}</span> : null}</div>
              <div><Field label="Prior deed / document reference" value={entry.referenceNo} onChange={(value) => updateChainHistory(entryIndex, 'referenceNo', value)} /></div>
              <div><Field label="Property value (INR)" type="number" value={entry.propertyValue} onChange={(value) => updateChainHistory(entryIndex, 'propertyValue', value)} required />{entryErrors?.fields?.propertyValue ? <span className="field-error">{entryErrors.fields.propertyValue}</span> : null}</div>
              <div><Field label="Registration fee (INR)" type="number" value={entry.registrationFee} onChange={(value) => updateChainHistory(entryIndex, 'registrationFee', value)} required />{entryErrors?.fields?.registrationFee ? <span className="field-error">{entryErrors.fields.registrationFee}</span> : null}</div>
              <div><Field label="Registered at office" value={entry.registeringOffice} onChange={(value) => updateChainHistory(entryIndex, 'registeringOffice', value)} required />{entryErrors?.fields?.registeringOffice ? <span className="field-error">{entryErrors.fields.registeringOffice}</span> : null}</div>
            </div>
            <div className="chain-history-owners-heading">
              <h4>Previous owners</h4>
              <button type="button" className="outline" onClick={() => setChainHistory((current) => current.map((record, index) => index === entryIndex ? { ...record, owners: [...record.owners, emptyPreviousOwnerHistory()] } : record))}>Add owner</button>
            </div>
            {entry.owners.map((owner, ownerIndex) => {
              const ownerErrors = entryErrors?.owners?.[ownerIndex]
              return <div className="chain-history-owner" key={ownerIndex}>
                <div className="chain-history-owner-heading"><strong>Owner {ownerIndex + 1}</strong>{entry.owners.length > 1 ? <button type="button" className="link" onClick={() => {
                  setChainHistory((current) => current.map((record, index) => index === entryIndex ? { ...record, owners: record.owners.filter((_, indexInRecord) => indexInRecord !== ownerIndex) } : record))
                  setChainHistoryErrors({})
                }}>Remove owner</button> : null}</div>
                <div className="chain-history-owner-fields">
                  <div><Field label="Owner name" value={owner.ownerName} onChange={(value) => updateChainHistoryOwner(entryIndex, ownerIndex, 'ownerName', value)} required />{ownerErrors?.ownerName ? <span className="field-error">{ownerErrors.ownerName}</span> : null}</div>
                  <div><Field label="Address" value={owner.address} onChange={(value) => updateChainHistoryOwner(entryIndex, ownerIndex, 'address', value)} required />{ownerErrors?.address ? <span className="field-error">{ownerErrors.address}</span> : null}</div>
                  <div><Field label="Aadhaar (12 digits)" value={owner.aadhaarNumber} onChange={(value) => updateChainHistoryOwner(entryIndex, ownerIndex, 'aadhaarNumber', value.replace(/\D/g, '').slice(0, 12))} required />{ownerErrors?.aadhaarNumber ? <span className="field-error">{ownerErrors.aadhaarNumber}</span> : null}</div>
                  <div><Field label="PAN" value={owner.pan} onChange={(value) => updateChainHistoryOwner(entryIndex, ownerIndex, 'pan', value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} required />{ownerErrors?.pan ? <span className="field-error">{ownerErrors.pan}</span> : null}</div>
                  <div><Field label="Share (%)" type="number" value={owner.sharePct} onChange={(value) => updateChainHistoryOwner(entryIndex, ownerIndex, 'sharePct', value)} required />{ownerErrors?.sharePct ? <span className="field-error">{ownerErrors.sharePct}</span> : null}</div>
                </div>
              </div>
            })}
          </section>
        })}
      </Panel> : null}
      {activeStage === 5 ? <Panel title="Guideline Value (manual entry)">
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

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, post } from '../api'
import { useAuth } from '../auth'
import { str, type Row } from '../types'
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

type SelectOption = { value: string; label: string }
const locationLevels = ['districtCode', 'sroCode', 'talukCode', 'villageCode'] as const
type LocationLevel = typeof locationLevels[number]
const labelFor = (options: SelectOption[], code: string) => options.find((option) => option.value === code)?.label ?? code
const EMPTY_ROWS: Row[] = []

function jurisdictionOptions(
  rows: Row[],
  codeKey: string,
  labelKey: string,
  matches: Array<(row: Row) => boolean>,
): SelectOption[] {
  const seen = new Set<string>()
  const options: SelectOption[] = []
  rows.forEach((row) => {
    if (!matches.every((match) => match(row))) return
    const value = str(row, codeKey)
    if (value.length === 0 || seen.has(value)) return
    seen.add(value)
    options.push({ value, label: str(row, labelKey) || value })
  })
  return options
}

interface OwnerForm {
  ownerName: string
  aadhaarNumber: string
  pan: string
  mobile: string
  address: string
  registrationNo: string
  repName: string
  repDesignation: string
  repAadhaar: string
  repPan: string
  repMobile: string
}

type OwnerFormKind = 'INDIVIDUAL' | 'DEFAULT' | 'COMPANY' | 'PARTNERSHIP_FIRM' | 'HUF' | 'LLP' | 'TRUST'
interface OwnerLayout {
  nameLabel: string
  panLabel: string
  addressLabel: string
  aadhaar: boolean
  mobile: boolean
  registration?: { label: string; kind: 'CIN' | 'LLPIN' | 'TEXT'; placeholder?: string }
  representative?: { title: string; designation: boolean; mobile: boolean }
}
interface OwnerTypeOption { value: string; label: string; allowMultipleOwners: boolean }
const ownerTypes: Array<OwnerTypeOption & { form: OwnerFormKind }> = [
  { value: 'INDIVIDUAL', label: 'Individual', form: 'INDIVIDUAL', allowMultipleOwners: true },
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship', form: 'DEFAULT', allowMultipleOwners: false },
  { value: 'PARTNERSHIP_FIRM', label: 'Partnership Firm', form: 'PARTNERSHIP_FIRM', allowMultipleOwners: false },
  { value: 'HUF', label: 'HUF', form: 'HUF', allowMultipleOwners: false },
  { value: 'LLP', label: 'LLP', form: 'LLP', allowMultipleOwners: false },
  { value: 'PRIVATE_LIMITED_COMPANY', label: 'Private Limited Company', form: 'COMPANY', allowMultipleOwners: false },
  { value: 'PUBLIC_LIMITED_COMPANY', label: 'Public Limited Company', form: 'COMPANY', allowMultipleOwners: false },
  { value: 'ONE_PERSON_COMPANY', label: 'One Person Company', form: 'COMPANY', allowMultipleOwners: false },
  { value: 'TRUST', label: 'Trust', form: 'TRUST', allowMultipleOwners: false },
  { value: 'SOCIETY', label: 'Society / Co-operative Society', form: 'DEFAULT', allowMultipleOwners: false },
  { value: 'AOP_BOI', label: 'Association of Persons / Body of Individuals', form: 'DEFAULT', allowMultipleOwners: false },
  { value: 'GOVERNMENT', label: 'Government / Government Department / Local Authority', form: 'DEFAULT', allowMultipleOwners: false },
  { value: 'OTHER_LEGAL_ENTITY', label: 'Other Legal Entity', form: 'DEFAULT', allowMultipleOwners: true },
]
const ownerLayouts: Record<OwnerFormKind, OwnerLayout> = {
  INDIVIDUAL: { nameLabel: 'Name', panLabel: 'PAN', addressLabel: 'Address', aadhaar: true, mobile: true },
  DEFAULT: { nameLabel: 'Name', panLabel: 'PAN', addressLabel: 'Address', aadhaar: true, mobile: false },
  COMPANY: {
    nameLabel: 'Company name', panLabel: 'PAN', addressLabel: 'Registered address', aadhaar: false, mobile: false,
    registration: { label: 'CIN', kind: 'CIN', placeholder: 'U12345TN2020PTC123456' },
    representative: { title: 'Authorised signatory', designation: true, mobile: true },
  },
  PARTNERSHIP_FIRM: {
    nameLabel: 'Firm name', panLabel: 'Firm PAN', addressLabel: 'Address', aadhaar: false, mobile: false,
    registration: { label: 'Registration no.', kind: 'TEXT' },
    representative: { title: 'Authorised partner', designation: false, mobile: true },
  },
  HUF: {
    nameLabel: 'HUF name', panLabel: 'HUF PAN', addressLabel: 'Address', aadhaar: false, mobile: false,
    representative: { title: 'Karta', designation: false, mobile: false },
  },
  LLP: {
    nameLabel: 'LLP name', panLabel: 'PAN', addressLabel: 'Registered address', aadhaar: false, mobile: false,
    registration: { label: 'LLPIN', kind: 'LLPIN', placeholder: 'AAA-1234' },
    representative: { title: 'Authorised partner', designation: false, mobile: true },
  },
  TRUST: {
    nameLabel: 'Trust name', panLabel: 'PAN', addressLabel: 'Address', aadhaar: false, mobile: false,
    registration: { label: 'Registration no.', kind: 'TEXT' },
    representative: { title: 'Trustee / Authorised trustee', designation: false, mobile: true },
  },
}
const ownerLayout = (ownerTypeCode: string) => ownerLayouts[ownerTypes.find((type) => type.value === ownerTypeCode)?.form ?? 'DEFAULT']

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

const emptyOwner = (): OwnerForm => ({
  ownerName: '', aadhaarNumber: '', pan: '', mobile: '', address: '', registrationNo: '',
  repName: '', repDesignation: '', repAadhaar: '', repPan: '', repMobile: '',
})
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
const AADHAAR_PATTERN = /^\d{12}$/
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const MOBILE_PATTERN = /^[6-9]\d{9}$/
const CIN_PATTERN = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/
const LLPIN_PATTERN = /^[A-Z]{3}-\d{4}$/

function validateOwner(owner: OwnerForm, layout: OwnerLayout): Partial<Record<OwnerField, string>> {
  const errors: Partial<Record<OwnerField, string>> = {}
  if (owner.ownerName.trim().length === 0) errors.ownerName = `${layout.nameLabel} is required.`
  if (layout.aadhaar && !AADHAAR_PATTERN.test(owner.aadhaarNumber)) errors.aadhaarNumber = 'Aadhaar must contain exactly 12 digits.'
  if (owner.pan.trim().length === 0) errors.pan = `${layout.panLabel} is required.`
  else if (!PAN_PATTERN.test(owner.pan)) errors.pan = 'PAN must match AAAAA9999A.'
  if (layout.mobile && !MOBILE_PATTERN.test(owner.mobile)) errors.mobile = 'Enter a 10-digit mobile number.'
  if (owner.address.trim().length === 0) errors.address = `${layout.addressLabel} is required.`
  if (layout.registration) {
    const { kind, label } = layout.registration
    if (owner.registrationNo.trim().length === 0) errors.registrationNo = `${label} is required.`
    else if (kind === 'CIN' && !CIN_PATTERN.test(owner.registrationNo)) errors.registrationNo = 'CIN must be 21 characters, e.g. U12345TN2020PTC123456.'
    else if (kind === 'LLPIN' && !LLPIN_PATTERN.test(owner.registrationNo)) errors.registrationNo = 'LLPIN must match AAA-9999.'
  }
  if (layout.representative) {
    const { title, designation, mobile } = layout.representative
    if (owner.repName.trim().length === 0) errors.repName = `${title} name is required.`
    if (designation && owner.repDesignation.trim().length === 0) errors.repDesignation = 'Designation is required.'
    if (!AADHAAR_PATTERN.test(owner.repAadhaar)) errors.repAadhaar = 'Aadhaar must contain exactly 12 digits.'
    if (owner.repPan.trim().length === 0) errors.repPan = 'PAN is required.'
    else if (!PAN_PATTERN.test(owner.repPan)) errors.repPan = 'PAN must match AAAAA9999A.'
    if (mobile && !MOBILE_PATTERN.test(owner.repMobile)) errors.repMobile = 'Enter a 10-digit mobile number.'
  }
  return errors
}

function ownerPayload(owner: OwnerForm, layout: OwnerLayout) {
  const representative = layout.representative
  return {
    ownerName: owner.ownerName.trim(),
    aadhaarNumber: layout.aadhaar ? owner.aadhaarNumber : undefined,
    pan: owner.pan,
    mobile: layout.mobile ? owner.mobile : undefined,
    address: owner.address.trim(),
    registrationNo: layout.registration ? owner.registrationNo.trim() : undefined,
    representative: representative ? {
      name: owner.repName.trim(),
      designation: representative.designation ? owner.repDesignation.trim() : undefined,
      aadhaarNumber: owner.repAadhaar,
      pan: owner.repPan,
      mobile: representative.mobile ? owner.repMobile : undefined,
    } : undefined,
  }
}
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
  const [ownerTypeCode, setOwnerTypeCode] = useState('')
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

  useEffect(() => {
    const hasLocationDetails = [villageName, talukName, property.street, property.doorNo]
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
      villageName,
      talukName,
      districtName,
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
  }, [districtName, property.doorNo, property.street, talukName, villageName])

  const update = (key: keyof PropertyState, value: string) => setProperty((current) => ({ ...current, [key]: value }))
  const updateLocation = (key: LocationLevel, value: string) => setProperty((current) => {
    const next = { ...current, [key]: value }
    locationLevels.slice(locationLevels.indexOf(key) + 1).forEach((child) => {
      next[child] = ''
    })
    return next
  })
  const options = (key: string, fallback: { value: string; label: string }[]) => {
    const rows = bootstrap?.optionSets[key] ?? []
    const mapped = rows.map((row) => ({ value: String(row.code ?? row.value ?? ''), label: String(row.name ?? row.label ?? row.code ?? row.value ?? '') })).filter((row) => row.value)
    return mapped.length > 0 ? mapped : fallback
  }

  const ownerTypeOptions: OwnerTypeOption[] = (() => {
    const rows = bootstrap?.optionSets.OWNER_TYPE ?? []
    const configured = rows.map((row) => {
      const attributes = (row.attributes ?? {}) as Row
      return { value: String(row.code ?? ''), label: String(row.label ?? row.code ?? ''), allowMultipleOwners: attributes.allowMultipleOwners === true }
    }).filter((row) => ownerTypes.some((type) => type.value === row.value))
    return configured.length > 0 ? configured : ownerTypes
  })()
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
      currentOwnerErrors = collectOwnerErrors()
      setOwnerErrors(currentOwnerErrors)
      if (ownerTypeError) {
        setFieldErrors((current) => ({ ...current, ownerTypeCode: ownerTypeError }))
        return false
      }
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
    if (ownerTypeError) validationErrors.ownerTypeCode = ownerTypeError
    const validationOwnerErrors = collectOwnerErrors()
    const validationMeasurementErrors = validateBoundaryMeasurements()
    const validationChainHistoryErrors = validateChainHistory()
    setFieldErrors(validationErrors)
    setOwnerErrors(validationOwnerErrors)
    if (Object.keys(validationErrors).length > 0 || Object.keys(validationOwnerErrors).length > 0
      || Object.keys(validationMeasurementErrors).length > 0 || Object.keys(validationChainHistoryErrors).length > 0) {
      if (Object.keys(validationOwnerErrors).length > 0 || validationErrors.ownerTypeCode) setActiveStage(1)
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

  const numeric = (key: keyof PropertyState, value: string) => update(key, value.replace(/[^0-9.]/g, ''))
  const digits = (value: string, length: number) => value.replace(/\D/g, '').slice(0, length)
  const panValue = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  const updateOwner = (index: number, field: OwnerField, value: string) => {
    setOwners((current) => current.map((owner, ownerIndex) => ownerIndex === index ? { ...owner, [field]: value } : owner))
  }
  const updateChainHistory = (entryIndex: number, field: ChainHistoryField, value: string) => {
    setChainHistory((current) => current.map((entry, index) => index === entryIndex ? { ...entry, [field]: value } : entry))
  }
  const fieldError = (key: keyof PropertyState) => fieldErrors[key] ? <span className="field-error">{fieldErrors[key]}</span> : null
  const ownerFieldError = (index: number, field: OwnerField) => ownerErrors[index]?.[field] ? <span className="field-error">{ownerErrors[index][field]}</span> : null
  const valid = property.talukCode && property.villageCode && property.sroCode && property.surveyNo && property.extentValue && property.boundaryNorth && property.boundarySouth && property.boundaryEast && property.boundaryWest
  const ownersComplete = Boolean(selectedOwnerType) && owners.length > 0 && (allowMultipleOwners || owners.length === 1)
    && owners.every((owner) => Object.keys(validateOwner(owner, layout)).length === 0)
  const locationComplete = Boolean(property.sroCode && property.districtCode && property.talukCode && property.villageCode
    && property.surveyNo && property.extentValue && property.extentUnit && !Number.isNaN(Number(property.extentValue)))
  const boundariesComplete = Boolean(property.boundaryNorth && property.boundarySouth && property.boundaryEast && property.boundaryWest)
    && boundaryMeasurements.length > 0
    && boundaryMeasurements.every((measurement) => measurement.fromPoint && measurement.toPoint
      && measurement.fromPoint !== measurement.toPoint && Number(measurement.value) > 0 && measurement.unit)
  const chainHistoryComplete = chainHistory.length > 0 && chainHistory.every((entry) => entry.executorName.trim()
    && entry.claimantName.trim()
    && entry.transactionDate
    && entry.natureOfTransaction.trim()
    && entry.surveyNo.trim())
  const stageComplete = [Boolean(property.propertyTypeCode && property.classificationCode), ownersComplete, locationComplete,
    boundariesComplete, chainHistoryComplete, Boolean(property.guidelineValue)]
  const stageHasErrors = [['propertyTypeCode', 'classificationCode'].some((key) => fieldErrors[key] !== undefined), Object.keys(ownerErrors).length > 0 || fieldErrors.ownerTypeCode !== undefined,
    ['sroCode', 'districtCode', 'talukCode', 'villageCode', 'surveyNo', 'extentValue', 'extentUnit'].some((key) => fieldErrors[key] !== undefined),
    ['boundaryNorth', 'boundarySouth', 'boundaryEast', 'boundaryWest'].some((key) => fieldErrors[key] !== undefined)
      || Object.keys(boundaryMeasurementErrors).length > 0,
    Object.keys(chainHistoryErrors).length > 0, false]
  const stageStatus = (index: number) => {
    if (stageHasErrors[index]) return 'Needs attention'
    if (stageComplete[index]) return 'Complete'
    if (index === 4 || index === 5) return 'Optional'
    const stageHasInput = index === 1
      ? Boolean(ownerTypeCode) || owners.some((owner) => Object.values(owner).some((value) => value.trim().length > 0))
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
          <Field label="ULPIN (optional)" value={property.ulpin} onChange={(v) => update('ulpin', v)} placeholder="Enter only if already issued" />
          <Field label="Property type" value={property.propertyTypeCode} onChange={(v) => update('propertyTypeCode', v)} options={options('PROPERTY_TYPE', [{ value: 'LAND', label: 'Land Parcel' }, { value: 'HOUSE_SITE', label: 'House Site' }, { value: 'BUILDING', label: 'Building' }, { value: 'APARTMENT_UNIT', label: 'Apartment / Flat' }, { value: 'AGRICULTURAL', label: 'Agricultural Land' }, { value: 'COMMERCIAL', label: 'Commercial' }, { value: 'INDUSTRIAL', label: 'Industrial' }, { value: 'PLOT_SITE', label: 'Plot / Site' }])} required />
          <Field label="Nature of title" value={property.natureOfTitleCode} onChange={(v) => update('natureOfTitleCode', v)} options={[{ value: 'FREEHOLD', label: 'Freehold' }, { value: 'LEASEHOLD', label: 'Leasehold' }]} />
          <Field label="Land type" value={property.landTypeCode} onChange={(v) => update('landTypeCode', v)} options={[{ value: 'RURAL', label: 'Rural' }, { value: 'URBAN', label: 'Urban' }]} />
          <Field label="Classification" value={property.classificationCode} onChange={(v) => update('classificationCode', v)} options={[{ value: 'Dry', label: 'Dry' }, { value: 'Wet', label: 'Wet' }]} required />
        </div>
      </Panel> : null}
      {activeStage === 1 ? <Panel title="" actions={allowMultipleOwners ? <button className="party-add-button" onClick={() => setOwners((current) => [...current, emptyOwner()])}><span aria-hidden="true">+</span> Add owner</button> : undefined}>
        <div className="owner-type-select">
          <Field label="Owner type" value={ownerTypeCode} onChange={changeOwnerType} options={ownerTypeOptions} required />
          {fieldErrors.ownerTypeCode ? <span className="field-error">{fieldErrors.ownerTypeCode}</span> : null}
          {selectedOwnerType ? <small className="muted">{allowMultipleOwners ? 'More than one owner can be added for this owner type.' : 'Only one owner can be recorded for this owner type.'}</small> : null}
        </div>
        {selectedOwnerType ? owners.map((owner, index) => {
          const representative = layout.representative
          return <section className="owner-entry" key={index}>
            <header className="chain-history-entry-heading">
              <h3>{allowMultipleOwners ? `Owner ${index + 1}` : 'Owner details'}</h3>
              {owners.length > 1 ? <button type="button" className="link" onClick={() => {
                setOwners((current) => current.filter((_, ownerIndex) => ownerIndex !== index))
                setOwnerErrors({})
              }}>Remove owner</button> : null}
            </header>
            <div className="owner-fields">
              <div><Field label={layout.nameLabel} value={owner.ownerName} onChange={(v) => updateOwner(index, 'ownerName', v)} required />{ownerFieldError(index, 'ownerName')}</div>
              {layout.registration ? <div><Field label={layout.registration.label} value={owner.registrationNo} onChange={(v) => updateOwner(index, 'registrationNo', layout.registration?.kind === 'TEXT' ? v : v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, layout.registration?.kind === 'CIN' ? 21 : 8))} placeholder={layout.registration.placeholder} required />{ownerFieldError(index, 'registrationNo')}</div> : null}
              {layout.aadhaar ? <div><Field label="Aadhaar (12 digits)" value={owner.aadhaarNumber} onChange={(v) => updateOwner(index, 'aadhaarNumber', digits(v, 12))} required />{ownerFieldError(index, 'aadhaarNumber')}</div> : null}
              <div><Field label={layout.panLabel} value={owner.pan} onChange={(v) => updateOwner(index, 'pan', panValue(v))} required />{ownerFieldError(index, 'pan')}</div>
              {layout.mobile ? <div><Field label="Mobile" type="tel" value={owner.mobile} onChange={(v) => updateOwner(index, 'mobile', digits(v, 10))} required />{ownerFieldError(index, 'mobile')}</div> : null}
              <div><Field label={layout.addressLabel} value={owner.address} onChange={(v) => updateOwner(index, 'address', v)} required />{ownerFieldError(index, 'address')}</div>
            </div>
            {representative ? <div className="owner-representative">
              <h4>{representative.title}</h4>
              <div className="owner-fields">
                <div><Field label="Name" value={owner.repName} onChange={(v) => updateOwner(index, 'repName', v)} required />{ownerFieldError(index, 'repName')}</div>
                {representative.designation ? <div><Field label="Designation" value={owner.repDesignation} onChange={(v) => updateOwner(index, 'repDesignation', v)} required />{ownerFieldError(index, 'repDesignation')}</div> : null}
                <div><Field label="Aadhaar (12 digits)" value={owner.repAadhaar} onChange={(v) => updateOwner(index, 'repAadhaar', digits(v, 12))} required />{ownerFieldError(index, 'repAadhaar')}</div>
                <div><Field label="PAN" value={owner.repPan} onChange={(v) => updateOwner(index, 'repPan', panValue(v))} required />{ownerFieldError(index, 'repPan')}</div>
                {representative.mobile ? <div><Field label="Mobile" type="tel" value={owner.repMobile} onChange={(v) => updateOwner(index, 'repMobile', digits(v, 10))} required />{ownerFieldError(index, 'repMobile')}</div> : null}
              </div>
            </div> : null}
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
      {activeStage === 3 ? <Panel title="">
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
      {activeStage === 4 ? <Panel title="" actions={<button type="button" className="outline" onClick={() => setChainHistory((current) => [...current, emptyChainHistoryEntry(property.surveyNo)])}>Add record</button>}>
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
      {activeStage === 5 ? <Panel title="">
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

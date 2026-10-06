import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ApiError, get, post, put, qs } from '../api'
import { useAuth } from '../auth'
import type { Row, TransactionDetail as Txn } from '../types'
import { Banner, DataTable, Field, Panel } from '../ui'
import PropertySummaryPanel from './PropertySummaryPanel'

interface PartyForm {
  side: string
  partyType: string
  name: string
  aadhaarNumber: string
  pan: string
  address: string
  relationshipCode: string
  existingSharePct: string
  shareTransferredPct: string
  resultingSharePct: string
}

type PartyField = keyof PartyForm

interface WitnessForm {
  name: string
  address: string
  phoneNumber: string
  aadhaarNumber: string
}

type WitnessField = keyof WitnessForm
type WitnessErrors = Record<number, Partial<Record<WitnessField, string>>>

const AADHAAR_PATTERN = /^\d{12}$/

const emptyParty = (side: string): PartyForm => ({
  side,
  partyType: 'INDIVIDUAL',
  name: '',
  aadhaarNumber: '',
  pan: '',
  address: '',
  relationshipCode: '',
  existingSharePct: '',
  shareTransferredPct: '',
  resultingSharePct: '',
})

const numberOrUndefined = (value: string): number | undefined =>
  value.trim().length === 0 ? undefined : Number(value)

const textOrEmpty = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

const valueOf = (row: Row | null | undefined, ...keys: string[]): string => {
  if (row === null || row === undefined) return ''
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim().length > 0) return String(value)
  }
  return ''
}

const mapEmbedUrl = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
  const west = longitude - 0.025
  const east = longitude + 0.025
  const south = latitude - 0.018
  const north = latitude + 0.018
  return `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${latitude}%2C${longitude}`
}

const mapRegisteredOwnerToParty = (owner: Row): PartyForm => ({
  ...emptyParty('SIDE_1'),
  partyType: textOrEmpty(owner.party_type ?? owner.partyType ?? 'INDIVIDUAL'),
  name: textOrEmpty(owner.owner_name ?? owner.ownerName ?? owner.full_name ?? owner.fullName ?? owner.name ?? ''),
  aadhaarNumber: textOrEmpty(owner.aadhaar_number ?? owner.aadhaarNumber ?? ''),
  pan: textOrEmpty(owner.pan ?? ''),
  address: textOrEmpty(owner.address ?? ''),
  relationshipCode: textOrEmpty(owner.relationship_code ?? owner.relationshipCode ?? ''),
  existingSharePct: textOrEmpty(owner.existing_share_pct ?? owner.share_pct ?? owner.sharePct ?? ''),
  shareTransferredPct: textOrEmpty(owner.share_transferred_pct ?? owner.shareTransferredPct ?? ''),
  resultingSharePct: textOrEmpty(owner.resulting_share_pct ?? owner.share_pct ?? owner.sharePct ?? ''),
})

const emptyWitness = (): WitnessForm => ({
  name: '',
  address: '',
  phoneNumber: '',
  aadhaarNumber: '',
})

const CONSENT_COMPLETE_STATUSES = [
  'RULE_CHECK_PENDING',
  'FEE_PAYMENT_PENDING',
  'SUBMITTED',
  'SURVEY_PENDING',
  'VAO_PENDING',
  'OBJECTION_PENDING',
  'TAHSILDAR_PENDING',
  'REVENUE_APPROVED',
] as const

const RULE_COMPLETE_STATUSES = [
  'FEE_PAYMENT_PENDING',
  'SUBMITTED',
  'SURVEY_PENDING',
  'VAO_PENDING',
  'OBJECTION_PENDING',
  'TAHSILDAR_PENDING',
  'REVENUE_APPROVED',
] as const

const PAYMENT_COMPLETE_STATUSES = [
  'SUBMITTED',
  'SURVEY_PENDING',
  'VAO_PENDING',
  'OBJECTION_PENDING',
  'TAHSILDAR_PENDING',
  'REVENUE_APPROVED',
] as const

const REGISTRATION_COMPLETE_STATUSES = [
  'SURVEY_PENDING',
  'VAO_PENDING',
  'OBJECTION_PENDING',
  'TAHSILDAR_PENDING',
  'REVENUE_APPROVED',
] as const

const hasStatus = (status: string, allowed: readonly string[]) => allowed.includes(status)

const stages = [
  'Property details',
  'Transaction details',
  'Buyer details',
  'Witnesses',
  'Aadhaar consent',
  'Rule checks',
  'Fees and payment',
  'Registration',
] as const

export default function TransactionStart() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { bootstrap } = useAuth()
  const [propertyRef, setPropertyRef] = useState(() => searchParams.get('propertyRef') ?? '')
  const [surveyNo, setSurveyNo] = useState('')
  const [subdivisionNo, setSubdivisionNo] = useState('')
  const [districtCode, setDistrictCode] = useState('')
  const [talukCode, setTalukCode] = useState('')
  const [villageCode, setVillageCode] = useState('')
  const [landTypeCode, setLandTypeCode] = useState('')
  const [propertySuggestions, setPropertySuggestions] = useState<Record<string, Row[]>>({})
  const [propertyId, setPropertyId] = useState('')
  const [property, setProperty] = useState<Row | null>(null)
  const [mapLocation, setMapLocation] = useState({ latitude: 13.0827, longitude: 80.2707 })
  const [mapStatus, setMapStatus] = useState<'fallback' | 'loading' | 'located'>('fallback')
  const [mapLocationName, setMapLocationName] = useState('Chennai, Tamil Nadu')
  const [deedTypeCode, setDeedTypeCode] = useState('')
  const [subtype, setSubtype] = useState('')
  const [transferScope, setTransferScope] = useState('FULL_PROPERTY')
  const [declaredConsideration, setDeclaredConsideration] = useState('')
  const [modeOfConsideration, setModeOfConsideration] = useState('BANK_TRANSFER')
  const [extentOrShareTransferred, setExtentOrShareTransferred] = useState('')
  const [extentUnit, setExtentUnit] = useState('SQ_FT')
  const [relationshipCategory, setRelationshipCategory] = useState('')
  const [guidelineValue, setGuidelineValue] = useState('')
  const [guidelineValueReference, setGuidelineValueReference] = useState('')
  const [basisOfSettlement, setBasisOfSettlement] = useState('')
  const [shareBeingReleased, setShareBeingReleased] = useState('')
  const [resultingSubparcelCount, setResultingSubparcelCount] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [partyBusy, setPartyBusy] = useState(false)
  const [witnessBusy, setWitnessBusy] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [ruleBusy, setRuleBusy] = useState(false)
  const [activeStage, setActiveStage] = useState(0)
  const [createdTransactionRef, setCreatedTransactionRef] = useState(() => searchParams.get('txnRef') ?? '')
  const [parties, setParties] = useState<PartyForm[]>([emptyParty('SIDE_2')])
  const [buyerDetailsSaved, setBuyerDetailsSaved] = useState(false)
  const [witnesses, setWitnesses] = useState<WitnessForm[]>([emptyWitness(), emptyWitness()])
  const [witnessErrors, setWitnessErrors] = useState<WitnessErrors>({})
  const [witnessesSaved, setWitnessesSaved] = useState(false)
  const [txn, setTxn] = useState<Txn | null>(null)
  const [txnLoading, setTxnLoading] = useState(false)
  const [otpByParty, setOtpByParty] = useState<Record<string, string>>({})
  const [paymentMode, setPaymentMode] = useState('E_CHALLAN')
  const [paymentRef, setPaymentRef] = useState('')
  const [registrationComment, setRegistrationComment] = useState('')
  const detailRef = useRef<HTMLDivElement | null>(null)
  const initialTransactionStageLocked = useRef(false)
  const selectedDeed = (bootstrap?.deedTypes ?? []).find((deed) => deed.code === deedTypeCode)
  const relationshipRequired = selectedDeed?.requires_relationship_category === true
  const sideTwoTitle = String(selectedDeed?.side2_role ?? 'Buyer').replaceAll('_', ' ')
  const txnStatus = txn?.status ?? ''
  const consentCompleted = txn !== null && hasStatus(txnStatus, CONSENT_COMPLETE_STATUSES)
  const rulesCompleted = txn !== null && hasStatus(txnStatus, RULE_COMPLETE_STATUSES)
  const paymentCompleted = txn !== null && hasStatus(txnStatus, PAYMENT_COMPLETE_STATUSES)
  const registrationCompleted = txn !== null && (
    hasStatus(txnStatus, REGISTRATION_COMPLETE_STATUSES)
    || (Array.isArray(txn.registrationResult) && txn.registrationResult.length > 0)
    || (Array.isArray(txn.mutation) && txn.mutation.length > 0)
  )

  const loadTransaction = useCallback(async (reference: string, silent = false): Promise<Txn | null> => {
    if (reference.length === 0) {
      setTxn(null)
      return null
    }
    if (!silent) {
      setTxnLoading(true)
    }
    try {
      let result: Txn
      try {
        result = await get<Txn>(`/api/transactions/ref/${encodeURIComponent(reference)}`)
      } catch {
        result = await get<Txn>(`/api/transactions/${encodeURIComponent(reference)}`)
      }
      const normalized: Txn = {
        ...result,
        txn_ref: String(result.txn_ref ?? result.txnRef ?? reference),
        status: String(result.status ?? 'DRAFT'),
        deed_type_code: String(result.deed_type_code ?? result.deedTypeCode ?? ''),
        property: result.property ?? {},
        deedType: result.deedType ?? {},
        parties: Array.isArray(result.parties) ? result.parties : [],
        witnesses: Array.isArray(result.witnesses) ? result.witnesses : [],
        consents: Array.isArray(result.consents) ? result.consents : [],
        ruleCheckResults: Array.isArray(result.ruleCheckResults) ? result.ruleCheckResults : [],
        feeCalculation: result.feeCalculation ?? null,
        payments: Array.isArray(result.payments) ? result.payments : [],
        registeredOwners: Array.isArray(result.registeredOwners) ? result.registeredOwners : [],
        surveyParcels: Array.isArray(result.surveyParcels) ? result.surveyParcels : [],
        availableActions: Array.isArray(result.availableActions) ? result.availableActions : [],
        stages: Array.isArray(result.stages) ? result.stages : [],
        registrationResult: Array.isArray(result.registrationResult) ? result.registrationResult : [],
        mutation: Array.isArray(result.mutation) ? result.mutation : [],
        validation: Array.isArray(result.validation) ? result.validation : [],
      }
      setTxn(normalized)
      return normalized
    } catch (e) {
      if (!silent) {
        setError(e instanceof ApiError ? e.message : String(e))
      }
      return null
    } finally {
      if (!silent) {
        setTxnLoading(false)
      }
    }
  }, [])

  const stageComplete = (index: number) => {
    if (index === 0) return property !== null
    if (index === 1) return Boolean(deedTypeCode && transferScope)
    if (index === 2) return createdTransactionRef.length > 0 && buyerDetailsSaved
    if (index === 3) return createdTransactionRef.length > 0 && witnessesSaved
    if (index === 4) return createdTransactionRef.length > 0 && consentCompleted
    if (index === 5) return createdTransactionRef.length > 0 && rulesCompleted
    if (index === 6) return createdTransactionRef.length > 0 && paymentCompleted
    if (index === 7) return createdTransactionRef.length > 0 && registrationCompleted
    return false
  }

  const stageStatus = (index: number) => {
    if (index === 0) return property ? 'Complete' : activeStage === 0 ? 'In progress' : 'Required'
    if (index === 1) return stageComplete(index) ? 'Complete' : property ? activeStage === index ? 'In progress' : 'Required' : 'Waiting'
    if (index === 2) {
      if (createdTransactionRef.length === 0) return 'Available after draft'
      return stageComplete(index) ? 'Complete' : activeStage === index ? 'In progress' : 'Required'
    }
    if (index === 3) {
      if (createdTransactionRef.length === 0 || !buyerDetailsSaved) return 'Waiting'
      return stageComplete(index) ? 'Complete' : activeStage === index ? 'In progress' : 'Required'
    }
    if (index === 4) {
      if (createdTransactionRef.length === 0 || !witnessesSaved) return 'Waiting'
      if (txnLoading) return 'Loading'
      return stageComplete(index) ? 'Complete' : activeStage === index ? 'In progress' : 'Required'
    }
    if (index === 5) {
      if (createdTransactionRef.length === 0 || !consentCompleted) return 'Waiting'
      if (txnLoading) return 'Loading'
      return stageComplete(index) ? 'Complete' : activeStage === index ? 'In progress' : 'Required'
    }
    if (index === 6) {
      if (createdTransactionRef.length === 0 || !rulesCompleted) return 'Waiting'
      if (txnLoading) return 'Loading'
      return stageComplete(index) ? 'Complete' : activeStage === index ? 'In progress' : 'Required'
    }
    if (index === 7) {
      if (createdTransactionRef.length === 0 || !paymentCompleted) return 'Waiting'
      if (txnLoading) return 'Loading'
      return stageComplete(index) ? 'Complete' : activeStage === index ? 'In progress' : 'Required'
    }
    return createdTransactionRef.length > 0 ? (activeStage === index ? 'In progress' : 'Coming soon') : 'Available after draft'
  }

  const clearSelectedProperty = () => {
    setProperty(null)
    setPropertyId('')
    setExtentOrShareTransferred('')
    setExtentUnit('SQ_FT')
    setGuidelineValue('')
    setGuidelineValueReference('')
  }

  const clearPropertySearchFields = () => {
    setPropertyRef('')
    setSurveyNo('')
    setSubdivisionNo('')
    setDistrictCode('')
    setTalukCode('')
    setVillageCode('')
    setLandTypeCode('')
    setPropertySuggestions({})
    clearSelectedProperty()
    setError('')
    setInfo('')
  }

  const handlePropertyRefChange = (value: string) => {
    setPropertyRef(value)
    if (value.trim().length > 0) {
      setSurveyNo('')
      setSubdivisionNo('')
      setDistrictCode('')
      setTalukCode('')
      setVillageCode('')
      setLandTypeCode('')
      setPropertySuggestions({})
    }
    clearSelectedProperty()
    setError('')
    setInfo('')
  }

  const handleLocationSearchChange = (value: string, setValue: (nextValue: string) => void) => {
    setValue(value)
    setPropertyRef('')
    setPropertySuggestions((current) => ({ ...current, propertyRef: [] }))
    clearSelectedProperty()
    setError('')
    setInfo('')
  }

  const applySuggestion = (field: 'propertyRef' | 'surveyNo' | 'subdivisionNo' | 'districtCode' | 'talukCode' | 'villageCode', row: Row) => {
    const nextPropertyRef = String(row.property_ref ?? row.propertyRef ?? propertyRef)
    const nextSurveyNo = String(row.survey_no ?? row.surveyNo ?? surveyNo)
    const nextSubdivisionNo = String(row.subdivision_no ?? row.subdivisionNo ?? subdivisionNo)
    const nextDistrictCode = String(row.district_code ?? row.districtCode ?? districtCode)
    const nextTalukCode = String(row.taluk_code ?? row.talukCode ?? talukCode)
    const nextVillageCode = String(row.village_code ?? row.villageCode ?? villageCode)

    setPropertyRef(field === 'propertyRef' ? nextPropertyRef : '')
    setSurveyNo(field === 'propertyRef' ? '' : field === 'surveyNo' ? nextSurveyNo : surveyNo)
    setSubdivisionNo(field === 'propertyRef' ? '' : field === 'subdivisionNo' ? nextSubdivisionNo : subdivisionNo)
    setDistrictCode(field === 'propertyRef' ? '' : field === 'districtCode' ? nextDistrictCode : districtCode)
    setTalukCode(field === 'propertyRef' ? '' : field === 'talukCode' ? nextTalukCode : talukCode)
    setVillageCode(field === 'propertyRef' ? '' : field === 'villageCode' ? nextVillageCode : villageCode)
    if (field === 'propertyRef') setLandTypeCode('')
    setPropertySuggestions((current) => ({ ...current, [field]: [] }))
    clearSelectedProperty()
    setError('')
    setInfo('')
  }

  const fetchPropertySuggestions = async (field: 'propertyRef' | 'surveyNo' | 'subdivisionNo' | 'districtCode' | 'talukCode' | 'villageCode', value: string) => {
    const trimmed = value.trim()
    if (trimmed.length < 3) {
      setPropertySuggestions((current) => ({ ...current, [field]: [] }))
      return
    }

    try {
      const rows = await get<Row[]>(`/api/properties${qs({ query: trimmed, limit: 10 })}`)
      setPropertySuggestions((current) => ({ ...current, [field]: rows }))
    } catch {
      setPropertySuggestions((current) => ({ ...current, [field]: [] }))
    }
  }

  useEffect(() => {
    if (createdTransactionRef.length === 0) {
      initialTransactionStageLocked.current = false
      return
    }
    if (!initialTransactionStageLocked.current && activeStage < 2) {
      setActiveStage(2)
      initialTransactionStageLocked.current = true
    }
  }, [activeStage, createdTransactionRef])

  useEffect(() => {
    if (createdTransactionRef.length === 0 || activeStage < 2) return
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeStage, createdTransactionRef])

  useEffect(() => {
    if (createdTransactionRef.length === 0) {
      setTxn(null)
      return
    }
    void loadTransaction(createdTransactionRef)
  }, [createdTransactionRef, loadTransaction])

  useEffect(() => {
    if (!property) {
      setMapLocation({ latitude: 13.0827, longitude: 80.2707 })
      setMapLocationName('Chennai, Tamil Nadu')
      setMapStatus('fallback')
      return
    }

    const locationQuery = [
      valueOf(property, 'door_no', 'doorNo'),
      valueOf(property, 'street'),
      valueOf(property, 'village_name', 'villageName', 'village_code', 'villageCode'),
      valueOf(property, 'taluk_name', 'talukName', 'taluk_code', 'talukCode'),
      valueOf(property, 'district_name', 'districtName', 'district_code', 'districtCode'),
      'Tamil Nadu',
      'India',
    ].filter((part) => part.length > 0).join(', ')

    if (locationQuery.length === 0) {
      setMapLocation({ latitude: 13.0827, longitude: 80.2707 })
      setMapLocationName('Chennai, Tamil Nadu')
      setMapStatus('fallback')
      return
    }

    const controller = new AbortController()
    setMapStatus('loading')
    const timeout = window.setTimeout(() => {
      void fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(locationQuery)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Location search failed')
          return await response.json() as Array<{ lat: string; lon: string; display_name: string }>
        })
        .then((results) => {
          const result = results[0]
          if (!result || !Number.isFinite(Number(result.lat)) || !Number.isFinite(Number(result.lon))) {
            setMapLocation({ latitude: 13.0827, longitude: 80.2707 })
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
          setMapLocation({ latitude: 13.0827, longitude: 80.2707 })
          setMapLocationName('Chennai, Tamil Nadu')
          setMapStatus('fallback')
        })
    }, 500)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [property])

  const findProperty = async (reference = propertyRef) => {
    const normalizedReference = reference.trim()
    const locationValues = [
      surveyNo.trim(),
      subdivisionNo.trim(),
      districtCode.trim(),
      talukCode.trim(),
      villageCode.trim(),
    ]

    if (normalizedReference.length === 0 && (locationValues.some((value) => value.length === 0) || landTypeCode.length === 0)) {
      setError('Enter a property reference, or complete every survey and location field and choose Rural or Urban.')
      return
    }

    const searchValues = normalizedReference.length > 0 ? [normalizedReference] : locationValues
    const query = searchValues.join(' ')

    setError('')
    setInfo('')
    setBusy(true)
    try {
      const queryResults = await get<Row[]>(`/api/properties${qs({
        query,
        propertyRef: normalizedReference || undefined,
        surveyNo: normalizedReference.length === 0 ? surveyNo.trim() : undefined,
        villageCode: normalizedReference.length === 0 ? villageCode.trim() : undefined,
        districtCode: normalizedReference.length === 0 ? districtCode.trim() : undefined,
        talukCode: normalizedReference.length === 0 ? talukCode.trim() : undefined,
        subdivisionNo: normalizedReference.length === 0 ? subdivisionNo.trim() : undefined,
        landTypeCode: normalizedReference.length === 0 ? landTypeCode : undefined,
        limit: 20,
      })}`)

      const matched = queryResults.find((row) => {
        const candidates = [
          row.property_ref,
          row.propertyRef,
          row.ulpin,
          row.survey_no,
          row.surveyNo,
          row.subdivision_no,
          row.subdivisionNo,
          row.district_code,
          row.districtCode,
          row.taluk_code,
          row.talukCode,
          row.village_code,
          row.villageCode,
          row.land_type_code,
          row.landTypeCode,
        ]
        const hasExactMatch = candidates.some((value) => {
          const text = String(value ?? '').trim().toLowerCase()
          return searchValues.some((term) => term.trim().toLowerCase() === text)
        })
        if (hasExactMatch) return true
        if (normalizedReference.length > 0) {
          const refText = String(row.property_ref ?? row.propertyRef ?? '').trim().toLowerCase()
          const normalized = normalizedReference.trim().toLowerCase()
          return refText.includes(normalized) || normalized.includes(refText)
        }
        return false
      }) ?? queryResults[0]

      if (matched) {
        const summary = matched as Row
        const resolvedRef = String(summary.property_ref ?? summary.propertyRef ?? normalizedReference)
        let result = summary
        try {
          const details = await get<Row>(`/api/properties/${encodeURIComponent(resolvedRef)}`)
          result = { ...summary, ...details }
        } catch {
          result = summary
        }
        const id = result.id ?? result.property_id
        if (id === undefined) throw new Error('The property response did not include a property ID.')
        setPropertyRef(resolvedRef)
        setPropertyId(String(id))
        setProperty(result)
        setExtentOrShareTransferred((current) =>
          current || String(result.extent_value ?? result.extentValue ?? ''),
        )
        setExtentUnit(String(result.extent_unit ?? result.extentUnit ?? 'SQ_FT'))
        setGuidelineValue((current) => current || String(result.guideline_value ?? result.guidelineValue ?? ''))
        setGuidelineValueReference((current) =>
          current || String(result.guideline_value_reference ?? result.guidelineValueReference ?? ''),
        )
        return
      }

      if (normalizedReference.length > 0) {
        const fallback = await get<Row>(`/api/properties/ref/${encodeURIComponent(normalizedReference)}`)
        const id = fallback.id ?? fallback.property_id
        if (id === undefined) throw new Error('The property response did not include a property ID.')
        setPropertyRef(String(fallback.property_ref ?? fallback.propertyRef ?? normalizedReference))
        setPropertyId(String(id))
        setProperty(fallback)
        setExtentOrShareTransferred((current) =>
          current || String(fallback.extent_value ?? fallback.extentValue ?? ''),
        )
        setExtentUnit(String(fallback.extent_unit ?? fallback.extentUnit ?? 'SQ_FT'))
        setGuidelineValue((current) => current || String(fallback.guideline_value ?? fallback.guidelineValue ?? ''))
        setGuidelineValueReference((current) =>
          current || String(fallback.guideline_value_reference ?? fallback.guidelineValueReference ?? ''),
        )
        return
      }

      throw new Error('No matching property was found for the entered search criteria.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    if (transactionCreated) {
      setInfo('Transaction already created. Continue from the buyer details stage below.')
      setActiveStage(2)
      return
    }
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const created = await post<Row>('/api/transactions', {
        propertyRef: String(property?.property_ref ?? property?.propertyRef ?? propertyRef),
        deedTypeCode,
        subtype: subtype || undefined,
        transferScope,
        sroCode: String(property?.sroCode ?? property?.sro_code ?? ''),
        declaredConsideration: declaredConsideration ? Number(declaredConsideration) : undefined,
        modeOfConsideration: Number(declaredConsideration) > 0 ? modeOfConsideration : undefined,
        extentOrShareTransferred: extentOrShareTransferred ? Number(extentOrShareTransferred) : undefined,
        extentUnit: extentOrShareTransferred ? extentUnit : undefined,
        relationshipCategory: relationshipCategory || undefined,
        guidelineValue: guidelineValue ? Number(guidelineValue) : undefined,
        guidelineValueReference: guidelineValueReference || undefined,
        basisOfSettlement: basisOfSettlement || undefined,
        shareBeingReleased: shareBeingReleased ? Number(shareBeingReleased) : undefined,
        resultingSubparcelCount: resultingSubparcelCount ? Number(resultingSubparcelCount) : undefined,
      }, true)
      const transactionRef = String(created.txn_ref ?? created.id)
      setCreatedTransactionRef(transactionRef)
      setActiveStage(2)
      setTxn(null)
      setOtpByParty({})
      setPaymentMode('E_CHALLAN')
      setPaymentRef('')
      setRegistrationComment('')
      setParties([emptyParty('SIDE_2')])
      setBuyerDetailsSaved(false)
      setWitnesses([emptyWitness(), emptyWitness()])
      setWitnessErrors({})
      setWitnessesSaved(false)
      setInfo('Transaction created. Continue with buyer details.')
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set('txnRef', transactionRef)
      setSearchParams(nextSearchParams, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const updateParty = (index: number, field: PartyField, value: string) => {
    setParties((current) => current.map((party, i) => (i === index ? { ...party, [field]: value } : party)))
    setBuyerDetailsSaved(false)
    setWitnessesSaved(false)
    setError('')
    setInfo('')
  }

  const addParty = (side: string) => {
    setParties((current) => [...current, emptyParty(side)])
    setBuyerDetailsSaved(false)
    setWitnessesSaved(false)
    setError('')
    setInfo('')
  }

  const removeParty = (side: string, index: number) => {
    const remaining = parties.filter((party) => party.side === side).length
    if (remaining <= 1) {
      setError('At least one buyer row is required.')
      return
    }
    setParties((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setBuyerDetailsSaved(false)
    setWitnessesSaved(false)
    setError('')
    setInfo('')
  }

  const saveParties = async () => {
    if (createdTransactionRef.length === 0) {
      setError('Create the transaction before saving buyer details.')
      return
    }
    const sellerParties = (() => {
      const registeredOwners = Array.isArray(property?.registeredOwners)
        ? property.registeredOwners
        : Array.isArray(property?.registered_owners)
          ? property.registered_owners
          : []
      return registeredOwners
        .filter((owner): owner is Row => typeof owner === 'object' && owner !== null)
        .map(mapRegisteredOwnerToParty)
    })()
    if (sellerParties.length === 0) {
      setInfo('')
      setError('No seller details were found on the property record. Please verify the property details before saving buyer details.')
      return
    }
    setError('')
    setInfo('')
    setPartyBusy(true)
    try {
      const buyerParties = parties
        .filter((party) => party.side === 'SIDE_2')
        .map((party) => ({
          side: party.side,
          role: selectedDeed?.side2_role ?? undefined,
          partyType: party.partyType,
          name: party.name,
          aadhaarNumber: party.aadhaarNumber.length === 0 ? undefined : party.aadhaarNumber,
          pan: party.pan.length === 0 ? undefined : party.pan,
          address: party.address.length === 0 ? undefined : party.address,
          relationshipCode: party.relationshipCode.length === 0 ? undefined : party.relationshipCode,
          existingSharePct: numberOrUndefined(party.existingSharePct),
          shareTransferredPct: numberOrUndefined(party.shareTransferredPct),
          resultingSharePct: numberOrUndefined(party.resultingSharePct),
        }))
      await put(
        `/api/transactions/${createdTransactionRef}/parties`,
        [
          ...sellerParties.map((party) => ({
            side: party.side,
            role: selectedDeed?.side1_role ?? undefined,
            partyType: party.partyType,
            name: party.name,
            aadhaarNumber: party.aadhaarNumber.length === 0 ? undefined : party.aadhaarNumber,
            pan: party.pan.length === 0 ? undefined : party.pan,
            address: party.address.length === 0 ? undefined : party.address,
            relationshipCode: party.relationshipCode.length === 0 ? undefined : party.relationshipCode,
            existingSharePct: numberOrUndefined(party.existingSharePct),
            shareTransferredPct: numberOrUndefined(party.shareTransferredPct),
            resultingSharePct: numberOrUndefined(party.resultingSharePct),
          })),
          ...buyerParties,
        ],
      )
      await loadTransaction(createdTransactionRef, true)
      setBuyerDetailsSaved(true)
      setActiveStage(3)
      setInfo('Buyer details saved. Continue with witness details.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setPartyBusy(false)
    }
  }

  const updateWitness = (index: number, field: WitnessField, value: string) => {
    setWitnesses((current) => current.map((witness, i) => (i === index ? { ...witness, [field]: value } : witness)))
    setWitnessesSaved(false)
    setError('')
    setInfo('')
    setWitnessErrors((current) => {
      if (current[index]?.[field] === undefined) return current
      return {
        ...current,
        [index]: {
          ...current[index],
          [field]: undefined,
        },
      }
    })
  }

  const addWitness = () => {
    setWitnesses((current) => [...current, emptyWitness()])
    setWitnessesSaved(false)
    setWitnessErrors({})
    setError('')
    setInfo('')
  }

  const removeWitness = (index: number) => {
    if (witnesses.length <= 1) {
      setError('At least one witness is required.')
      return
    }
    setWitnesses((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setWitnessesSaved(false)
    setWitnessErrors({})
    setError('')
    setInfo('')
  }

  const validateWitnesses = (): boolean => {
    const validationErrors: WitnessErrors = {}

    const addError = (index: number, field: WitnessField, message: string) => {
      validationErrors[index] = {
        ...validationErrors[index],
        [field]: validationErrors[index]?.[field] ?? message,
      }
    }

    witnesses.forEach((witness, index) => {
      if (witness.name.trim().length === 0) {
        addError(index, 'name', 'Name is required.')
      }
      if (witness.address.trim().length === 0) {
        addError(index, 'address', 'Address is required.')
      }
      if (witness.phoneNumber.trim().length === 0) {
        addError(index, 'phoneNumber', 'Phone number is required.')
      }
      if (witness.aadhaarNumber.trim().length > 0 && !AADHAAR_PATTERN.test(witness.aadhaarNumber)) {
        addError(index, 'aadhaarNumber', 'Aadhaar must contain exactly 12 digits when provided.')
      }
    })

    setWitnessErrors(validationErrors)
    return Object.keys(validationErrors).length === 0
  }

  const saveWitnesses = async () => {
    if (createdTransactionRef.length === 0) {
      setError('Create the transaction before saving witness details.')
      return
    }
    if (!validateWitnesses()) {
      setInfo('')
      setError('Please correct the highlighted witness details before saving.')
      return
    }
    setError('')
    setInfo('')
    setWitnessBusy(true)
    try {
      await put(
        `/api/transactions/${createdTransactionRef}/witnesses`,
        witnesses.map((witness) => ({
          name: witness.name,
          address: witness.address || undefined,
          phoneNumber: witness.phoneNumber || undefined,
          idProofType: witness.aadhaarNumber ? 'AADHAAR' : undefined,
          idProofRef: witness.aadhaarNumber || undefined,
        })),
      )
      await loadTransaction(createdTransactionRef, true)
      setWitnessesSaved(true)
      setActiveStage(4)
      setInfo('Witness details saved. Continue with Aadhaar consent.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setWitnessBusy(false)
    }
  }

  const requestConsent = async () => {
    if (createdTransactionRef.length === 0) {
      setError('Create the transaction before requesting Aadhaar consent.')
      return
    }
    if (txn === null) {
      setError('Transaction details are still loading.')
      return
    }
    setError('')
    setInfo('')
    setConsentBusy(true)
    try {
      await post(`/api/transactions/${encodeURIComponent(createdTransactionRef)}/consent/request`, {})
      await loadTransaction(createdTransactionRef, true)
      setActiveStage(4)
      setInfo('Consent started and Aadhaar OTP requested for all parties.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      await loadTransaction(createdTransactionRef, true)
    } finally {
      setConsentBusy(false)
    }
  }

  const verifyConsent = async (partyId: number) => {
    if (createdTransactionRef.length === 0) {
      setError('Create the transaction before verifying Aadhaar consent.')
      return
    }
    const otp = otpByParty[String(partyId)] ?? ''
    setError('')
    setInfo('')
    setConsentBusy(true)
    try {
      const result = await post<{ allPartiesVerified?: boolean; transactionStatus?: string; transaction_status?: string }>(
        `/api/transactions/${encodeURIComponent(createdTransactionRef)}/consent/verify`,
        { partyId, otp },
      )
      const loaded = await loadTransaction(createdTransactionRef, true)
      const nextStatus = String(loaded?.status ?? result.transactionStatus ?? result.transaction_status ?? '')
      if (nextStatus.length > 0) {
        setTxn((current) => (current === null ? current : { ...current, status: nextStatus }))
      }
      if (result.allPartiesVerified === true
        || nextStatus === 'RULE_CHECK_PENDING') {
        setActiveStage(5)
        setInfo('Consent captured. Continue with rule checks.')
      } else {
        setInfo('Consent captured.')
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setConsentBusy(false)
    }
  }

  const runRules = async () => {
    if (createdTransactionRef.length === 0) {
      setError('Create the transaction before running rule checks.')
      return
    }
    if (txn === null) {
      setError('Transaction details are still loading.')
      return
    }
    setError('')
    setInfo('')
    setRuleBusy(true)
    try {
      const results = await post<Row[]>(`/api/transactions/${encodeURIComponent(createdTransactionRef)}/rule-checks`, {})
      if (results.length === 0) {
        throw new Error('No rule engines ran for this transaction.')
      }
      await post(`/api/transactions/${encodeURIComponent(createdTransactionRef)}/transitions`, { actionCode: 'RULE_CHECKS_CLEAR' }, true)
      await loadTransaction(createdTransactionRef, true)
      setActiveStage(6)
      setInfo('Rule checks executed. Transaction is ready for fee calculation.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setRuleBusy(false)
    }
  }

  const calculateFees = async () => {
    if (createdTransactionRef.length === 0) {
      setError('Create the transaction before calculating fees.')
      return
    }
    if (txn === null) {
      setError('Transaction details are still loading.')
      return
    }
    setError('')
    setInfo('')
    try {
      await post(`/api/transactions/${encodeURIComponent(createdTransactionRef)}/fees`, {})
      await loadTransaction(createdTransactionRef, true)
      setActiveStage(6)
      setInfo('Fees calculated.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  const recordPayment = async () => {
    if (createdTransactionRef.length === 0) {
      setError('Create the transaction before recording payment.')
      return
    }
    if (txn === null) {
      setError('Transaction details are still loading.')
      return
    }
    const payable = txn.feeCalculation?.total_payable
    if (payable === undefined || payable === null) {
      setError('Calculate the fee before recording payment.')
      return
    }
    if (paymentRef.trim().length === 0) {
      setError('Payment reference is required.')
      return
    }
    setError('')
    setInfo('')
    try {
      const summary = await post<Row>(
        `/api/transactions/${encodeURIComponent(createdTransactionRef)}/payments`,
        { mode: paymentMode, referenceNo: paymentRef, amount: Number(payable) },
        true,
      )
      if (summary.fullyPaid === true || Number(summary.balance) <= 0) {
        await post(`/api/transactions/${encodeURIComponent(createdTransactionRef)}/transitions`, { actionCode: 'RECORD_PAYMENT' }, true)
        await loadTransaction(createdTransactionRef, true)
        setActiveStage(7)
        setInfo('Payment recorded. Transaction is ready for registration.')
      } else {
        await loadTransaction(createdTransactionRef, true)
        setInfo('Payment recorded.')
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  const register = async () => {
    if (createdTransactionRef.length === 0) {
      setError('Create the transaction before registration.')
      return
    }
    if (txn === null) {
      setError('Transaction details are still loading.')
      return
    }
    setError('')
    setInfo('')
    try {
      await post(
        `/api/transactions/${encodeURIComponent(createdTransactionRef)}/registration`,
        { comment: registrationComment.trim() || undefined },
        true,
      )
      await loadTransaction(createdTransactionRef, true)
      setActiveStage(7)
      setInfo('Transaction registered.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  const renderWitnessRows = () => (
    <section className="party-group">
      <div className="section-heading">
        <h3>Witness details</h3>
        <button type="button" className="outline" onClick={addWitness}>
          <span aria-hidden="true">+</span> Add witness
        </button>
      </div>
      {witnesses.map((witness, index) => (
        <section className="form-section" key={`witness-${index}`}>
          <div className="section-heading">
            <h3>Witness {witnesses.length > 1 ? index + 1 : ''}</h3>
            <button
              type="button"
              className="outline"
              disabled={witnesses.length <= 1}
              onClick={() => removeWitness(index)}
            >
              Remove
            </button>
          </div>
          <div className="form-grid four">
            <div>
              <label className="field">
                <span>
                  Name<b className="req"> *</b>
                </span>
                <input
                  type="text"
                  value={witness.name}
                  onChange={(event) => updateWitness(index, 'name', event.target.value)}
                />
              </label>
              {witnessErrors[index]?.name ? <span className="field-error">{witnessErrors[index].name}</span> : null}
            </div>
            <div>
              <label className="field">
                <span>
                  Address<b className="req"> *</b>
                </span>
                <input
                  type="text"
                  value={witness.address}
                  onChange={(event) => updateWitness(index, 'address', event.target.value)}
                />
              </label>
              {witnessErrors[index]?.address ? <span className="field-error">{witnessErrors[index].address}</span> : null}
            </div>
            <div>
              <label className="field">
                <span>
                  Phone number<b className="req"> *</b>
                </span>
                <input
                  type="tel"
                  value={witness.phoneNumber}
                  onChange={(event) => updateWitness(index, 'phoneNumber', event.target.value)}
                />
              </label>
              {witnessErrors[index]?.phoneNumber ? <span className="field-error">{witnessErrors[index].phoneNumber}</span> : null}
            </div>
            <div>
              <label className="field">
                <span>Aadhaar (optional)</span>
                <input
                  type="text"
                  value={witness.aadhaarNumber}
                  maxLength={12}
                  inputMode="numeric"
                  onChange={(event) => updateWitness(index, 'aadhaarNumber', event.target.value.replace(/\D/g, '').slice(0, 12))}
                />
              </label>
              {witnessErrors[index]?.aadhaarNumber ? <span className="field-error">{witnessErrors[index].aadhaarNumber}</span> : null}
            </div>
          </div>
        </section>
      ))}
    </section>
  )

  const txnParties = Array.isArray(txn?.parties) ? txn.parties : []
  const txnConsents = Array.isArray(txn?.consents) ? txn.consents : []
  const consentRows = txnConsents.length > 0
    ? txnConsents
    : txnParties
      .filter((party) => party.id !== undefined || party.party_id !== undefined || party.partyId !== undefined)
      .map((party) => ({
        party_id: party.id ?? party.party_id ?? party.partyId,
        status: 'NOT_REQUESTED',
      }))
  const latestRuleResults = Array.from(
    (Array.isArray(txn?.ruleCheckResults) ? txn.ruleCheckResults : []).reduce((latest, result) => {
      const engine = String(result.engine ?? '')
      const current = latest.get(engine)
      const currentDate = current === undefined ? '' : String(current.checked_at ?? current.executed_at ?? '')
      const resultDate = String(result.checked_at ?? result.executed_at ?? '')
      if (current === undefined || resultDate > currentDate) {
        latest.set(engine, {
          ...result,
          executed_at: result.executed_at ?? result.checked_at ?? '',
        })
      }
      return latest
    }, new Map<string, Row>()).values(),
  )

  const transactionCreated = createdTransactionRef.trim().length > 0
  const pageTitle = transactionCreated ? 'Transaction workflow' : 'Initiate Transaction'
  const pageDescription = transactionCreated
    ? `Transaction ${createdTransactionRef} has been created. Continue using the tabs below.`
    : 'Select a registered property and capture the transaction instruction. To add a property, use Mint Property.'
  const maxAvailableStage = transactionCreated
    ? (registrationCompleted ? 7 : paymentCompleted ? 7 : rulesCompleted ? 6 : consentCompleted ? 5 : witnessesSaved ? 4 : buyerDetailsSaved ? 3 : 2)
    : 1
  const registeredOwners = Array.isArray(property?.registeredOwners)
    ? property.registeredOwners
    : Array.isArray(property?.registered_owners)
      ? property.registered_owners
      : Array.isArray(property?.owners)
        ? property.owners
        : Array.isArray(property?.property_owners)
          ? property.property_owners
          : []
  const chainOfTitle = Array.isArray(property?.chainOfTitle)
    ? property.chainOfTitle
    : Array.isArray(property?.chain_of_title)
      ? property.chain_of_title
      : []
  const summaryPropertyRef = String(property?.property_ref ?? property?.propertyRef ?? txn?.property?.property_ref ?? txn?.property?.propertyRef ?? '')
  const showPropertySummary = [1, 2, 5].includes(activeStage) && summaryPropertyRef.length > 0

  return (
    <div className="intake-page transaction-start-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Registration workspace</span>
          <h1>{pageTitle}</h1>
          <p className="muted">{pageDescription}</p>
        </div>
        <span className="stage-label">Draft · Step {activeStage + 1} of {stages.length}</span>
      </div>
      <Banner kind="error" message={error} />
      <Banner kind="success" message={info} />
      <div className="property-stage-layout">
        <div className="property-stage-content">
          <div className="property-stage-tabs" role="tablist" aria-label="Transaction sections">
            {stages.map((stage, index) => (
              <button
                type="button"
                role="tab"
                id={`transaction-stage-tab-${index}`}
                aria-selected={activeStage === index}
                aria-controls={`transaction-stage-panel-${index}`}
                className={`${activeStage === index ? 'active' : ''}${stageComplete(index) ? ' completed' : ''}`}
                onClick={() => setActiveStage(index)}
                disabled={index > maxAvailableStage}
                key={stage}
              >
                <span className="property-tab-marker" aria-hidden="true">{stageComplete(index) ? '✓' : index + 1}</span>
                <span className="property-tab-copy"><strong>{stage}</strong><small>{stageStatus(index)}</small></span>
              </button>
            ))}
          </div>
          <div className={showPropertySummary ? 'transaction-stage-with-summary' : undefined}>
          <div className="transaction-stage-main">
          <div role="tabpanel" id={`transaction-stage-panel-${activeStage}`} aria-labelledby={`transaction-stage-tab-${activeStage}`}>
            {activeStage === 0 ? (
              <Panel title="Select existing property" actions={<button className="outline" onClick={() => navigate('/properties/new')}>+ Mint Property</button>}>
                <div className="property-search-section">
                  <h3>Search by property reference</h3>
                  <div className="row">
                  <label className="field property-combobox">
                    <span>Property reference</span>
                    <input
                      type="text"
                      value={propertyRef}
                      onChange={(event) => {
                        const value = event.target.value
                        handlePropertyRefChange(value)
                        void fetchPropertySuggestions('propertyRef', value)
                      }}
                      onBlur={() => window.setTimeout(() => setPropertySuggestions((current) => ({ ...current, propertyRef: [] })), 120)}
                      placeholder="Enter property reference"
                      autoComplete="off"
                    />
                    {propertySuggestions.propertyRef && propertySuggestions.propertyRef.length > 0 ? (
                      <div className="property-combobox-menu" role="listbox" aria-label="Property reference suggestions">
                        {propertySuggestions.propertyRef.map((row, index) => {
                          const label = String(row.property_ref ?? row.propertyRef ?? '')
                          return (
                            <button type="button" className="property-combobox-option" key={`${label}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion('propertyRef', row)}>
                              <strong>{label}</strong>
                              <span>{String(row.survey_no ?? row.surveyNo ?? '')} · {String(row.village_code ?? row.villageCode ?? '')}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </label>
                </div>
                </div>
                <div className="property-search-section">
                  <h3>Search by survey and location</h3>
                  <div className="row">
                  <label className="field property-combobox">
                    <span>Survey number <span className="req">*</span></span>
                    <input
                      type="text"
                      value={surveyNo}
                      onChange={(event) => {
                        const value = event.target.value
                        handleLocationSearchChange(value, setSurveyNo)
                        void fetchPropertySuggestions('surveyNo', value)
                      }}
                      onBlur={() => window.setTimeout(() => setPropertySuggestions((current) => ({ ...current, surveyNo: [] })), 120)}
                      placeholder="Survey number"
                      autoComplete="off"
                    />
                    {propertySuggestions.surveyNo && propertySuggestions.surveyNo.length > 0 ? (
                      <div className="property-combobox-menu" role="listbox" aria-label="Survey number suggestions">
                        {propertySuggestions.surveyNo.map((row, index) => {
                          const label = String(row.survey_no ?? row.surveyNo ?? '')
                          return (
                            <button type="button" className="property-combobox-option" key={`${label}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion('surveyNo', row)}>
                              <strong>{label}</strong>
                              <span>{String(row.property_ref ?? row.propertyRef ?? '')} · {String(row.village_code ?? row.villageCode ?? '')}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </label>
                  <label className="field property-combobox">
                    <span>Subdivision <span className="req">*</span></span>
                    <input
                      type="text"
                      value={subdivisionNo}
                      onChange={(event) => {
                        const value = event.target.value
                        handleLocationSearchChange(value, setSubdivisionNo)
                        void fetchPropertySuggestions('subdivisionNo', value)
                      }}
                      onBlur={() => window.setTimeout(() => setPropertySuggestions((current) => ({ ...current, subdivisionNo: [] })), 120)}
                      placeholder="Subdivision"
                      autoComplete="off"
                    />
                    {propertySuggestions.subdivisionNo && propertySuggestions.subdivisionNo.length > 0 ? (
                      <div className="property-combobox-menu" role="listbox" aria-label="Subdivision suggestions">
                        {propertySuggestions.subdivisionNo.map((row, index) => {
                          const label = String(row.subdivision_no ?? row.subdivisionNo ?? '')
                          return (
                            <button type="button" className="property-combobox-option" key={`${label}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion('subdivisionNo', row)}>
                              <strong>{label}</strong>
                              <span>{String(row.property_ref ?? row.propertyRef ?? '')} · {String(row.survey_no ?? row.surveyNo ?? '')}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </label>
                  <label className="field property-combobox">
                    <span>District <span className="req">*</span></span>
                    <input
                      type="text"
                      value={districtCode}
                      onChange={(event) => {
                        const value = event.target.value
                        handleLocationSearchChange(value, setDistrictCode)
                        void fetchPropertySuggestions('districtCode', value)
                      }}
                      onBlur={() => window.setTimeout(() => setPropertySuggestions((current) => ({ ...current, districtCode: [] })), 120)}
                      placeholder="District"
                      autoComplete="off"
                    />
                    {propertySuggestions.districtCode && propertySuggestions.districtCode.length > 0 ? (
                      <div className="property-combobox-menu" role="listbox" aria-label="District suggestions">
                        {propertySuggestions.districtCode.map((row, index) => {
                          const label = String(row.district_code ?? row.districtCode ?? '')
                          return (
                            <button type="button" className="property-combobox-option" key={`${label}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion('districtCode', row)}>
                              <strong>{label}</strong>
                              <span>{String(row.property_ref ?? row.propertyRef ?? '')} · {String(row.taluk_code ?? row.talukCode ?? '')}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </label>
                  <label className="field property-combobox">
                    <span>Taluk <span className="req">*</span></span>
                    <input
                      type="text"
                      value={talukCode}
                      onChange={(event) => {
                        const value = event.target.value
                        handleLocationSearchChange(value, setTalukCode)
                        void fetchPropertySuggestions('talukCode', value)
                      }}
                      onBlur={() => window.setTimeout(() => setPropertySuggestions((current) => ({ ...current, talukCode: [] })), 120)}
                      placeholder="Taluk"
                      autoComplete="off"
                    />
                    {propertySuggestions.talukCode && propertySuggestions.talukCode.length > 0 ? (
                      <div className="property-combobox-menu" role="listbox" aria-label="Taluk suggestions">
                        {propertySuggestions.talukCode.map((row, index) => {
                          const label = String(row.taluk_code ?? row.talukCode ?? '')
                          return (
                            <button type="button" className="property-combobox-option" key={`${label}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion('talukCode', row)}>
                              <strong>{label}</strong>
                              <span>{String(row.property_ref ?? row.propertyRef ?? '')} · {String(row.village_code ?? row.villageCode ?? '')}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </label>
                  <label className="field property-combobox">
                    <span>Village <span className="req">*</span></span>
                    <input
                      type="text"
                      value={villageCode}
                      onChange={(event) => {
                        const value = event.target.value
                        handleLocationSearchChange(value, setVillageCode)
                        void fetchPropertySuggestions('villageCode', value)
                      }}
                      onBlur={() => window.setTimeout(() => setPropertySuggestions((current) => ({ ...current, villageCode: [] })), 120)}
                      placeholder="Village"
                      autoComplete="off"
                    />
                    {propertySuggestions.villageCode && propertySuggestions.villageCode.length > 0 ? (
                      <div className="property-combobox-menu" role="listbox" aria-label="Village suggestions">
                        {propertySuggestions.villageCode.map((row, index) => {
                          const label = String(row.village_code ?? row.villageCode ?? '')
                          return (
                            <button type="button" className="property-combobox-option" key={`${label}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion('villageCode', row)}>
                              <strong>{label}</strong>
                              <span>{String(row.property_ref ?? row.propertyRef ?? '')} · {String(row.survey_no ?? row.surveyNo ?? '')}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </label>
                </div>
                <div className="property-land-type">
                  <span>Area type <span className="req">*</span></span>
                  <div className="property-land-type-options" role="radiogroup" aria-label="Area type">
                    <label><input type="radio" name="property-land-type" value="RURAL" checked={landTypeCode === 'RURAL'} onChange={() => { setLandTypeCode('RURAL'); setPropertyRef(''); clearSelectedProperty() }} /> Rural</label>
                    <label><input type="radio" name="property-land-type" value="URBAN" checked={landTypeCode === 'URBAN'} onChange={() => { setLandTypeCode('URBAN'); setPropertyRef(''); clearSelectedProperty() }} /> Urban</label>
                  </div>
                </div>
                </div>
                <div className="form-submit-row">
                  <button className="outline" type="button" onClick={clearPropertySearchFields} disabled={busy}>Clear</button>
                  <button className="primary" type="button" disabled={busy || (propertyRef.trim().length === 0 && ([surveyNo, subdivisionNo, districtCode, talukCode, villageCode].some((value) => value.trim().length === 0) || landTypeCode.length === 0))} onClick={() => void findProperty()}>{busy ? 'Checking…' : 'Find property'}</button>
                </div>
                {property ? (
                  <>
                    <div className="summary-strip">
                      <span><strong>{String(property.property_ref ?? property.propertyRef ?? propertyRef)}</strong></span>
                      <span>{String(property.survey_no ?? property.surveyNo ?? 'Survey pending')}</span>
                      <span>{String(property.village_code ?? property.villageCode ?? '')}</span>
                      <button
                        className="link"
                        onClick={() => {
                          clearPropertySearchFields()
                          setParties([emptyParty('SIDE_2')])
                          setBuyerDetailsSaved(false)
                          setWitnessesSaved(false)
                          setError('')
                          setInfo('')
                        }}
                      >
                        Change
                      </button>
                    </div>

                    <div className="location-survey-layout">
                      <Panel title="Property details">
                        <section className="property-detail-group">
                          <h3>Identification</h3>
                          <dl className="kv">
                            <dt>Property reference</dt>
                            <dd>{String(property.property_ref ?? property.propertyRef ?? propertyRef)}</dd>
                            <dt>ULPIN</dt>
                            <dd>{valueOf(property, 'ulpin') || '—'}</dd>
                            <dt>Property type</dt>
                            <dd>{valueOf(property, 'property_type_code', 'propertyTypeCode', 'property_type', 'propertyType') || '—'}</dd>
                            <dt>Nature of title</dt>
                            <dd>{valueOf(property, 'nature_of_title_code', 'natureOfTitleCode') || '—'}</dd>
                            <dt>Land type</dt>
                            <dd>{valueOf(property, 'land_type_code', 'landTypeCode') || '—'}</dd>
                            <dt>Classification</dt>
                            <dd>{valueOf(property, 'classification_code', 'classificationCode') || '—'}</dd>
                            <dt>Record status</dt>
                            <dd>{valueOf(property, 'status') || '—'}</dd>
                          </dl>
                        </section>
                        <section className="property-detail-group">
                          <h3>Survey and extent</h3>
                          <dl className="kv">
                            <dt>Survey number</dt>
                            <dd>{valueOf(property, 'survey_no', 'surveyNo') || '—'}</dd>
                            <dt>Subdivision number</dt>
                            <dd>{valueOf(property, 'subdivision_no', 'subdivisionNo') || '—'}</dd>
                            <dt>Old survey reference</dt>
                            <dd>{valueOf(property, 'old_survey_reference', 'oldSurveyReference') || '—'}</dd>
                            <dt>FMB reference</dt>
                            <dd>{valueOf(property, 'fmb_reference_no', 'fmbReferenceNo') || '—'}</dd>
                            <dt>Extent</dt>
                            <dd>{`${valueOf(property, 'extent_value', 'extentValue') || '—'} ${valueOf(property, 'extent_unit', 'extentUnit')}`.trim()}</dd>
                          </dl>
                        </section>
                        <section className="property-detail-group">
                          <h3>Location</h3>
                          <dl className="kv">
                            <dt>District</dt>
                            <dd>{valueOf(property, 'district_name', 'districtName', 'district_code', 'districtCode') || '—'}</dd>
                            <dt>Taluk</dt>
                            <dd>{valueOf(property, 'taluk_name', 'talukName', 'taluk_code', 'talukCode') || '—'}</dd>
                            <dt>Village</dt>
                            <dd>{valueOf(property, 'village_name', 'villageName', 'village_code', 'villageCode') || '—'}</dd>
                            <dt>Sub-Registrar Office</dt>
                            <dd>{valueOf(property, 'sro_name', 'sroName', 'sro_code', 'sroCode') || '—'}</dd>
                            <dt>Panchayat / ward</dt>
                            <dd>{[valueOf(property, 'panchayat'), valueOf(property, 'ward_no', 'wardNo')].filter(Boolean).join(' / ') || '—'}</dd>
                            <dt>Street / door number</dt>
                            <dd>{[valueOf(property, 'street'), valueOf(property, 'door_no', 'doorNo')].filter(Boolean).join(' / ') || '—'}</dd>
                          </dl>
                        </section>
                      </Panel>

                      <aside className="property-map-panel" aria-label="Property map location">
                        <div className="property-map-heading">
                          <div>
                            <strong>Map location</strong>
                            <span>{mapLocationName}</span>
                          </div>
                          {mapStatus === 'located' ? <span className="map-pin-status">Located</span> : null}
                        </div>
                        <div className="property-map-frame">
                          {mapStatus === 'located' ? (
                            <iframe
                              title={`Map showing ${mapLocationName}`}
                              src={mapEmbedUrl(mapLocation)}
                              loading="lazy"
                            />
                          ) : (
                            <div className="property-map-message" role="status">
                              <strong>{mapStatus === 'loading' ? 'Locating area…' : 'Unable to locate on map'}</strong>
                              <span>Property coordinates are not available yet for this record.</span>
                            </div>
                          )}
                        </div>
                        <small className="map-attribution">Map data © OpenStreetMap contributors</small>
                      </aside>
                    </div>

                    <Panel title="Registered owners">
                      <DataTable
                        rows={registeredOwners}
                        columns={[
                          {
                            key: 'owner_name',
                            label: 'Owner',
                            render: (row) => String(row.owner_name ?? row.ownerName ?? row.full_name ?? row.fullName ?? row.name ?? '—'),
                          },
                          {
                            key: 'aadhaar_number',
                            label: 'Aadhaar',
                            render: (row) => String(row.aadhaar_number ?? row.aadhaarNumber ?? '—'),
                          },
                          {
                            key: 'pan',
                            label: 'PAN',
                            render: (row) => String(row.pan ?? '—'),
                          },
                          {
                            key: 'share_pct',
                            label: 'Share %',
                            render: (row) => String(row.share_pct ?? row.sharePct ?? row.existing_share_pct ?? row.existingSharePct ?? '—'),
                          },
                          {
                            key: 'address',
                            label: 'Address',
                            render: (row) => String(row.address ?? '—'),
                          },
                        ]}
                        empty="No registered owners were found for this property."
                      />
                    </Panel>

                    <Panel title="Chain of title">
                      <DataTable
                        rows={chainOfTitle}
                        columns={[
                          { key: 'seq', label: '#' },
                          { key: 'executor_name', label: 'Executor / seller', render: (row) => String(row.executor_name ?? row.executorName ?? '—') },
                          { key: 'claimant_name', label: 'Claimant / purchaser', render: (row) => String(row.claimant_name ?? row.claimantName ?? '—') },
                          { key: 'transaction_date', label: 'Transaction date', render: (row) => String(row.transaction_date ?? row.transactionDate ?? '—') },
                          { key: 'nature_of_transaction', label: 'Nature', render: (row) => String(row.nature_of_transaction ?? row.natureOfTransaction ?? '—') },
                          { key: 'reference_no', label: 'Reference no.', render: (row) => String(row.reference_no ?? row.referenceNo ?? '—') },
                          { key: 'survey_no', label: 'Survey no.', render: (row) => String(row.survey_no ?? row.surveyNo ?? '—') },
                        ]}
                        empty="No prior title history recorded for this property."
                      />
                    </Panel>

                    <Panel title="Guideline value">
                      <dl className="kv">
                        <dt>Guideline value</dt>
                        <dd>{valueOf(property, 'guideline_value', 'guidelineValue') || '—'}</dd>
                        <dt>Guideline reference</dt>
                        <dd>{valueOf(property, 'guideline_value_reference', 'guidelineValueReference') || '—'}</dd>
                      </dl>
                    </Panel>

                  </>
                ) : (
                  <p className="helper">Property registration must be completed before a transaction can be initiated.</p>
                )}
              </Panel>
            ) : null}
            {activeStage === 1 ? (
              <Panel title="" actions={<span className="stage-label">Required</span>}>
                <div className="form-grid three">
                  <Field
                    label="Deed type"
                    value={deedTypeCode}
                    onChange={(value) => {
                      setDeedTypeCode(value)
                      if (value === 'GIFT' || value === 'SETTLEMENT') {
                        setDeclaredConsideration('0')
                        setModeOfConsideration('')
                      }
                    }}
                    options={(bootstrap?.deedTypes ?? []).map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
                    required
                  />
                  <Field label="Subtype" value={subtype} onChange={setSubtype} placeholder="Optional" />
                  <Field
                    label="Transfer scope"
                    value={transferScope}
                    onChange={setTransferScope}
                    options={[
                      { value: 'FULL_PROPERTY', label: 'Full property' },
                      { value: 'UNDIVIDED_SHARE', label: 'Undivided share' },
                      { value: 'PHYSICAL_PARTIAL_EXTENT_SUBDIVISION', label: 'Partial extent / subdivision' },
                    ]}
                    required
                  />
                  <Field label="Declared consideration" value={declaredConsideration} onChange={setDeclaredConsideration} type="number" />
                  <Field
                    label="Mode of consideration"
                    value={modeOfConsideration}
                    onChange={setModeOfConsideration}
                    options={[
                      { value: 'BANK_TRANSFER', label: 'Bank transfer' },
                      { value: 'CASH', label: 'Cash' },
                      { value: 'MIXED', label: 'Mixed' },
                    ]}
                  />
                  <Field
                    label="Relationship category"
                    value={relationshipCategory}
                    onChange={setRelationshipCategory}
                    options={[
                      { value: 'FAMILY', label: 'Family' },
                      { value: 'NON_FAMILY', label: 'Non-family' },
                    ]}
                    required={relationshipRequired}
                  />
                  <Field label="Basis of settlement" value={basisOfSettlement} onChange={setBasisOfSettlement} placeholder="Gift, family settlement, etc." />
                  <Field label="Extent / share transferred" value={extentOrShareTransferred} onChange={setExtentOrShareTransferred} type="number" />
                  <Field label="Extent unit" value={extentUnit} onChange={setExtentUnit} options={['SQ_FT', 'SQ_M', 'CENT', 'ACRE', 'PERCENT'].map((u) => ({ value: u, label: u }))} />
                  <Field label="Guideline value" value={guidelineValue} onChange={setGuidelineValue} type="number" />
                  <Field label="Guideline reference" value={guidelineValueReference} onChange={setGuidelineValueReference} />
                  <Field label="Share being released" value={shareBeingReleased} onChange={setShareBeingReleased} type="number" />
                  <Field label="Resulting subparcel count" value={resultingSubparcelCount} onChange={setResultingSubparcelCount} type="number" />
                </div>
              </Panel>
            ) : null}
            {activeStage === 2 && createdTransactionRef.length > 0 ? (
              <div ref={detailRef}>
                <section className="panel">
                  <header className="panel-head">
                    <h2>Buyer details</h2>
                  </header>
                  <div className="panel-body">
                    <p className="helper">Capture buyer information before moving on to witnesses and consent.</p>
                    <section className="party-group">
                      <div className="section-heading">
                        <h3>{sideTwoTitle}</h3>
                        <button type="button" className="outline" onClick={() => addParty('SIDE_2')}>
                          <span aria-hidden="true">+</span> Add {sideTwoTitle.toLowerCase()}
                        </button>
                      </div>
                      {parties
                        .map((party, index) => ({ party, index }))
                        .filter(({ party }) => party.side === 'SIDE_2')
                        .map(({ party, index }, groupIndex, buyerGroup) => (
                          <section className="form-section" key={`SIDE_2-${index}`}>
                            <div className="section-heading">
                              <h3>
                                {sideTwoTitle} {buyerGroup.length > 1 ? groupIndex + 1 : ''}
                              </h3>
                              <button
                                type="button"
                                className="outline"
                                disabled={buyerGroup.length <= 1}
                                onClick={() => removeParty('SIDE_2', index)}
                              >
                                Remove
                              </button>
                            </div>
                            <div className="form-grid four">
                              <div>
                                <label className="field">
                                  <span>Name</span>
                                  <input
                                    type="text"
                                    value={party.name}
                                    onChange={(event) => updateParty(index, 'name', event.target.value)}
                                  />
                                </label>
                              </div>
                              <div>
                                <label className="field">
                                  <span>Aadhaar (12 digits)</span>
                                  <input
                                    type="text"
                                    value={party.aadhaarNumber}
                                    maxLength={12}
                                    inputMode="numeric"
                                    onChange={(event) => updateParty(index, 'aadhaarNumber', event.target.value.replace(/\D/g, '').slice(0, 12))}
                                  />
                                </label>
                              </div>
                              <div>
                                <label className="field">
                                  <span>PAN</span>
                                  <input
                                    type="text"
                                    value={party.pan}
                                    maxLength={10}
                                    onChange={(event) => updateParty(index, 'pan', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                                  />
                                </label>
                              </div>
                              <div>
                                <label className="field">
                                  <span>Address</span>
                                  <input
                                    type="text"
                                    value={party.address}
                                    onChange={(event) => updateParty(index, 'address', event.target.value)}
                                  />
                                </label>
                              </div>
                              <div>
                                <label className="field">
                                  <span>Existing share %</span>
                                  <input
                                    type="number"
                                    value={party.existingSharePct}
                                    onChange={(event) => updateParty(index, 'existingSharePct', event.target.value)}
                                  />
                                </label>
                              </div>
                              <div>
                                <label className="field">
                                  <span>Share transferred %</span>
                                  <input
                                    type="number"
                                    value={party.shareTransferredPct}
                                    onChange={(event) => updateParty(index, 'shareTransferredPct', event.target.value)}
                                  />
                                </label>
                              </div>
                              <div>
                                <label className="field">
                                  <span>Resulting share %</span>
                                  <input
                                    type="number"
                                    value={party.resultingSharePct}
                                    onChange={(event) => updateParty(index, 'resultingSharePct', event.target.value)}
                                  />
                                </label>
                              </div>
                            </div>
                          </section>
                        ))}
                      {parties.filter((party) => party.side === 'SIDE_2').length === 0 ? <p className="helper">No rows available.</p> : null}
                    </section>
                    <div className="form-submit-row">
                      <button className="primary" disabled={partyBusy} onClick={() => void saveParties()}>
                        {partyBusy ? 'Saving…' : 'Save buyer details'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
            {activeStage === 3 && createdTransactionRef.length > 0 ? (
              <div ref={detailRef}>
                <section className="panel">
                  <header className="panel-head">
                    <h2>4. Witness details</h2>
                  </header>
                  <div className="panel-body">
                    <p className="helper">Capture witness information before moving on to Aadhaar consent.</p>
                    {renderWitnessRows()}
                    <div className="form-submit-row">
                      <button className="primary" disabled={witnessBusy} onClick={() => void saveWitnesses()}>
                        {witnessBusy ? 'Saving…' : 'Save witness details'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
            {activeStage === 4 && createdTransactionRef.length > 0 ? (
              <div ref={detailRef}>
                <section className="panel">
                  <header className="panel-head">
                    <h2>5. Aadhaar consent</h2>
                  </header>
                  <div className="panel-body">
                    <p className="helper">Demo Aadhaar OTP: <code>123456</code>. Raw Aadhaar is never stored.</p>
                    {txnLoading ? <p className="helper">Loading transaction details…</p> : null}
                    {consentRows.length === 0 ? <p className="helper">No parties are available for Aadhaar consent.</p> : consentRows.map((consent, index) => {
                      const partyId = String(consent.party_id ?? consent.partyId ?? '')
                      const party = txnParties.find((item) => String(item.id ?? item.party_id ?? item.partyId ?? '') === partyId)
                      const consentStatus = String(consent.status ?? consent.consent_status ?? consent.consentStatus ?? '')
                      const role = String(
                        party?.role
                        ?? (party?.side === 'SIDE_1' ? selectedDeed?.side1_role : selectedDeed?.side2_role)
                        ?? 'Party',
                      ).replaceAll('_', ' ')
                      const name = party === undefined ? `#${partyId}` : String(party.name ?? '')
                      return (
                        <div className="row" key={`${partyId}-${index}`}>
                          <span className="grow">
                            {role}: {name} — {consentStatus}
                          </span>
                          <Field
                            label="OTP"
                            value={otpByParty[partyId] ?? ''}
                            onChange={(value) => setOtpByParty({ ...otpByParty, [partyId]: value })}
                          />
                          <button
                            disabled={consentBusy
                              || txnLoading
                              || txnStatus !== 'CONSENT_PENDING'
                              || consentStatus === 'VERIFIED'
                              || !/^\d{6}$/.test(otpByParty[partyId] ?? '')}
                            onClick={() => void verifyConsent(Number(partyId))}
                          >
                            Verify
                          </button>
                        </div>
                      )
                    })}
                    <div className="form-submit-row">
                      <button
                        className="primary"
                        disabled={consentBusy || txnLoading || txn === null || !['DRAFT', 'CONSENT_PENDING'].includes(txnStatus)}
                        onClick={() => void requestConsent()}
                      >
                        {txnStatus === 'DRAFT' ? 'Start consent and request OTP' : 'Request OTP for all parties'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
            {activeStage === 5 && createdTransactionRef.length > 0 ? (
              <div ref={detailRef}>
                <section className="panel">
                  <header className="panel-head">
                    <h2>6. Rule checks</h2>
                  </header>
                  <div className="panel-body">
                    <p className="helper">Rule outcomes are advisory during the pilot; an officer may acknowledge and proceed.</p>
                    {txnLoading ? <p className="helper">Loading transaction details…</p> : null}
                    <DataTable
                      rows={latestRuleResults}
                      columns={[
                        { key: 'engine', label: 'Engine' },
                        { key: 'overall_outcome', label: 'Outcome' },
                        { key: 'reason_code', label: 'Reason' },
                        { key: 'summary', label: 'Summary' },
                        { key: 'executed_at', label: 'Executed' },
                      ]}
                      empty="Rule checks have not been run."
                    />
                    <div className="form-submit-row">
                      <button
                        className="primary"
                        disabled={ruleBusy || txnLoading || txnStatus !== 'RULE_CHECK_PENDING'}
                        onClick={() => void runRules()}
                      >
                        Run rule checks
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
            {activeStage === 6 && createdTransactionRef.length > 0 ? (
              <div ref={detailRef}>
                <section className="panel">
                  <header className="panel-head">
                    <h2>7. Fees and payment</h2>
                  </header>
                  <div className="panel-body">
                    {txn.feeCalculation === null ? (
                      <p className="muted">No fee calculation yet.</p>
                    ) : (
                      <dl className="kv">
                        <dt>Valuation basis</dt>
                        <dd>
                          {String(txn.feeCalculation.valuation_basis_used ?? '')} — {String(txn.feeCalculation.valuation_amount ?? '')}
                        </dd>
                        <dt>Stamp duty</dt>
                        <dd>{String(txn.feeCalculation.stamp_duty ?? '')}</dd>
                        <dt>Registration fee</dt>
                        <dd>{String(txn.feeCalculation.registration_fee ?? '')}</dd>
                        <dt>TDS</dt>
                        <dd>{String(txn.feeCalculation.tds_amount ?? '')}</dd>
                        <dt>Other charges</dt>
                        <dd>{String(txn.feeCalculation.other_charges ?? '')}</dd>
                        <dt>Total payable</dt>
                        <dd>
                          <b>{String(txn.feeCalculation.total_payable ?? '')}</b>
                        </dd>
                      </dl>
                    )}
                    <div className="row">
                      <Field
                        label="Payment mode"
                        value={paymentMode}
                        onChange={setPaymentMode}
                        options={[
                          { value: 'E_CHALLAN', label: 'E-Challan' },
                          { value: 'UPI', label: 'UPI' },
                          { value: 'CARD', label: 'Card' },
                          { value: 'DD', label: 'Demand draft' },
                        ]}
                      />
                      <Field label="Payment reference" value={paymentRef} onChange={setPaymentRef} required />
                    </div>
                    <DataTable
                      rows={txn.payments}
                      columns={[
                      { key: 'mode', label: 'Mode' },
                        { key: 'reference_no', label: 'Reference' },
                        { key: 'amount', label: 'Amount' },
                        { key: 'paid_at', label: 'Paid at' },
                      ]}
                    />
                    <div className="form-submit-row">
                      <button className="primary" disabled={txnStatus !== 'FEE_PAYMENT_PENDING'} onClick={() => void calculateFees()}>
                        Calculate fee
                      </button>
                      <button
                        className="primary"
                        disabled={txnStatus !== 'FEE_PAYMENT_PENDING' || txn.feeCalculation === null || paymentRef.length === 0}
                        onClick={() => void recordPayment()}
                      >
                        Record payment
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
            {activeStage === 7 && createdTransactionRef.length > 0 ? (
              <div ref={detailRef}>
                <section className="panel">
                  <header className="panel-head">
                    <h2>8. Registration</h2>
                  </header>
                  <div className="panel-body">
                    <label className="field registration-comment">
                      <span>Comment (optional)</span>
                      <textarea value={registrationComment} onChange={(event) => setRegistrationComment(event.target.value)} rows={3} />
                    </label>
                    <DataTable
                      rows={txn.registrationResult}
                      columns={[
                        { key: 'registered_document_no', label: 'Document no' },
                        { key: 'registration_year', label: 'Year' },
                        { key: 'registration_date', label: 'Registration date' },
                        { key: 'registering_sro', label: 'Registering SRO' },
                        { key: 'registration_status', label: 'Status' },
                        { key: 'registration_reference', label: 'Reference' },
                      ]}
                      empty="Not registered yet."
                    />
                    {txn.survey_required === true ? (
                      <p>
                        Survey is required for this transfer scope: <Link to={`/survey/${txn.txn_ref}`}>open the survey screen</Link>.
                      </p>
                    ) : null}
                    <DataTable
                      rows={txn.mutation}
                      columns={[
                        { key: 'id', label: 'Mutation' },
                        { key: 'status', label: 'Status' },
                        { key: 'proposed_at', label: 'Proposed at' },
                      ]}
                      empty="No revenue mutation proposed yet."
                    />
                    <div className="form-submit-row">
                      <button className="primary" disabled={txnStatus !== 'SUBMITTED'} onClick={() => void register()}>
                        Register
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
          <div className="property-stage-actions">
            <button type="button" onClick={() => setActiveStage((current) => Math.max(0, current - 1))} disabled={activeStage === 0}>
              Previous section
            </button>
            {activeStage === 0 ? (
              <button type="button" className="primary" onClick={() => setActiveStage(1)}>
                Next section
              </button>
            ) : activeStage === 2 && createdTransactionRef.length > 0 ? (
              <span className="stage-label">Save buyer details above to continue</span>
            ) : activeStage === 3 && createdTransactionRef.length > 0 ? (
              <span className="stage-label">Save witness details below to continue</span>
            ) : activeStage === 4 && createdTransactionRef.length > 0 ? (
              <span className="stage-label">Complete Aadhaar consent above to continue</span>
            ) : activeStage === 5 && createdTransactionRef.length > 0 ? (
              <span className="stage-label">Run rule checks above to continue</span>
            ) : activeStage === 6 && createdTransactionRef.length > 0 ? (
              <span className="stage-label">Complete fees and payment below to continue</span>
            ) : activeStage === 7 && createdTransactionRef.length > 0 ? (
              <span className="stage-label">Registration</span>
            ) : transactionCreated ? (
              <span className="stage-label">Transaction created · continue below</span>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={busy || !propertyId || !deedTypeCode || !transferScope || (relationshipRequired && !relationshipCategory)}
                onClick={() => void create()}
              >
                {busy ? 'Creating…' : 'Create transaction'}
              </button>
            )}
          </div>
          </div>
          {showPropertySummary ? <PropertySummaryPanel propertyRef={summaryPropertyRef} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

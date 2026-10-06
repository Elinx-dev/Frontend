import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, get, post, put } from '../api'
import { useAuth } from '../auth'
import type { Row, TransactionDetail as Txn } from '../types'
import { Banner, DataTable, Field, Panel, StatusPill, formatCell } from '../ui'
import { MissingAadhaarCapture, OwnerFields, PartyDetailsView } from './OwnerFields'
import {
  emptyOwner, labelFor, ownerLayout, ownerPayload, ownerTypeOptionsFrom, validateOwner, type OwnerForm,
} from './propertyShared'
import RuleCheckDetails from './RuleCheckDetails'
import { ruleSummary, ruleWarningText } from './ruleCheckResults'

type PartyForm = OwnerForm & { side: string; relationshipCode: string }

type PartyField = keyof PartyForm
type PartyErrors = Record<number, Partial<Record<PartyField, string>>>

const AADHAAR_PATTERN = /^\d{12}$/
const workflowStageLabels = [
  'Property details',
  'Transaction details',
  'Buyer details',
  'Witnesses',
  'Aadhaar consent',
  'Rule checks',
  'Fees and payment',
  'Registration',
] as const

const emptyParty = (side: string): PartyForm => ({ side, relationshipCode: '', ...emptyOwner() })

const numberOrUndefined = (value: string): number | undefined =>
  value.trim().length === 0 ? undefined : Number(value)

export default function TransactionDetail({
  transactionRef,
  initialWorkflowTab,
  pageTitle,
  compact: _compact = false,
}: {
  transactionRef?: string
  initialWorkflowTab?: string
  pageTitle?: string
  compact?: boolean
} = {}) {
  const { txnRef: routeTxnRef = '' } = useParams()
  const txnRef = transactionRef ?? routeTxnRef
  const [txn, setTxn] = useState<Txn | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [consideration, setConsideration] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [extent, setExtent] = useState('')
  const [extentUnit, setExtentUnit] = useState('SQ_FT')
  const [relationshipCategory, setRelationshipCategory] = useState('')
  const { bootstrap } = useAuth()
  const [parties, setParties] = useState<PartyForm[]>([emptyParty('SIDE_2')])
  const [buyerTypeCode, setBuyerTypeCode] = useState('')
  const [partyFormVisible, setPartyFormVisible] = useState(true)
  const [partyErrors, setPartyErrors] = useState<PartyErrors>({})
  const [witnessFormVisible, setWitnessFormVisible] = useState(true)
  const [witnessOne, setWitnessOne] = useState('')
  const [witnessOneAadhaar, setWitnessOneAadhaar] = useState('')
  const [witnessOneAddress, setWitnessOneAddress] = useState('')
  const [witnessOnePhone, setWitnessOnePhone] = useState('')
  const [witnessTwo, setWitnessTwo] = useState('')
  const [witnessTwoAadhaar, setWitnessTwoAadhaar] = useState('')
  const [witnessTwoAddress, setWitnessTwoAddress] = useState('')
  const [witnessTwoPhone, setWitnessTwoPhone] = useState('')
  const [otpByParty, setOtpByParty] = useState<Record<string, string>>({})
  const [paymentMode, setPaymentMode] = useState('E_CHALLAN')
  const [paymentRef, setPaymentRef] = useState('')
  const [registrationComment, setRegistrationComment] = useState('')
  const [activeWorkflowTab, setActiveWorkflowTab] = useState(initialWorkflowTab ?? 'txn-property')
  const initialReadinessStep = (() => {
    if (initialWorkflowTab === 'txn-details') return 'Transaction details'
    if (initialWorkflowTab === 'txn-parties') return 'Buyer details'
    if (initialWorkflowTab === 'txn-witnesses') return 'Witnesses'
    if (initialWorkflowTab === 'txn-consent') return 'Aadhaar consent'
    if (initialWorkflowTab === 'txn-rules') return 'Rule checks'
    if (initialWorkflowTab === 'txn-fees') return 'Fees & payment'
    if (initialWorkflowTab === 'txn-registration') return 'Registration'
    return null
  })()
  const [selectedReadinessStep, setSelectedReadinessStep] = useState<string | null>(initialReadinessStep)
  const initializedTxnRef = useRef('')

  const load = useCallback(async () => {
    try {
      let result: Txn
      try {
        result = await get<Txn>(`/api/transactions/ref/${encodeURIComponent(txnRef)}`)
      } catch {
        result = await get<Txn>(`/api/transactions/${encodeURIComponent(txnRef)}`)
      }
      const registeredOwners = Array.isArray(result.registeredOwners) ? result.registeredOwners : []
      if (initializedTxnRef.current !== txnRef) {
        initializedTxnRef.current = txnRef
        setConsideration(String(result.declared_consideration ?? result.declaredConsideration ?? ''))
        setTransactionDate(String(
          result.transaction_date
          ?? result.transactionDate
          ?? result.created_at
          ?? result.createdAt
          ?? '',
        ).slice(0, 10))
        setExtent(String(result.extent_or_share_transferred ?? result.extentOrShareTransferred ?? ''))
        setExtentUnit(String(result.extent_unit ?? result.extentUnit ?? 'SQ_FT'))
        setRelationshipCategory(String(result.relationship_category ?? result.relationshipCategory ?? ''))

        const savedWitnesses = Array.isArray(result.witnesses) ? result.witnesses : []
        setWitnessFormVisible(savedWitnesses.length === 0)
        const firstWitness = savedWitnesses[0]
        const secondWitness = savedWitnesses[1]
        setWitnessOne(String(firstWitness?.name ?? ''))
        setWitnessOneAadhaar(String(firstWitness?.id_proof_ref ?? firstWitness?.idProofRef ?? ''))
        setWitnessOneAddress(String(firstWitness?.address ?? ''))
        setWitnessOnePhone(String(firstWitness?.phone_number ?? firstWitness?.phoneNumber ?? ''))
        setWitnessTwo(String(secondWitness?.name ?? ''))
        setWitnessTwoAadhaar(String(secondWitness?.id_proof_ref ?? secondWitness?.idProofRef ?? ''))
        setWitnessTwoAddress(String(secondWitness?.address ?? ''))
        setWitnessTwoPhone(String(secondWitness?.phone_number ?? secondWitness?.phoneNumber ?? ''))

        const savedParties = Array.isArray(result.parties) ? result.parties : []
        setPartyFormVisible(savedParties.length === 0)
        const buyerRows = savedParties.filter((party: Row) => String(party.side ?? '') === 'SIDE_2')
        setBuyerTypeCode(String(buyerRows[0]?.owner_type_code ?? ''))
        const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))
        const partyForms = buyerRows.map((party: Row) => ({
          ...emptyParty('SIDE_2'),
          ownerName: text(party.name),
          pan: text(party.pan),
          mobile: text(party.mobile),
          address: text(party.address),
          registrationNo: text(party.registration_no),
          repName: text(party.representative_name ?? party.karta_name),
          repDesignation: text(party.representative_designation),
          repPan: text(party.representative_pan),
          repMobile: text(party.representative_mobile),
          relationshipCode: text(party.relationship_code),
        }))
        setParties(partyForms.length > 0 ? partyForms : [emptyParty('SIDE_2')])
      }
      setTxn({
        ...result,
        txn_ref: String(result.txn_ref ?? result.txnRef ?? txnRef),
        status: String(result.status ?? 'DRAFT'),
        deed_type_code: String(result.deed_type_code ?? result.deedTypeCode ?? ''),
        property: result.property ?? {},
        parties: Array.isArray(result.parties) ? result.parties : [],
        witnesses: Array.isArray(result.witnesses) ? result.witnesses : [],
        consents: Array.isArray(result.consents) ? result.consents : [],
        ruleCheckResults: Array.isArray(result.ruleCheckResults) ? result.ruleCheckResults : [],
        payments: Array.isArray(result.payments) ? result.payments : [],
        registeredOwners,
        surveyParcels: Array.isArray(result.surveyParcels) ? result.surveyParcels : [],
        availableActions: Array.isArray(result.availableActions) ? result.availableActions : [],
        stages: Array.isArray(result.stages) ? result.stages : [],
        registrationResult: Array.isArray(result.registrationResult) ? result.registrationResult : [],
        mutation: Array.isArray(result.mutation) ? result.mutation : [],
        validation: Array.isArray(result.validation) ? result.validation : [],
        feeCalculation: result.feeCalculation ?? null,
      })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [txnRef])

  useEffect(() => {
    void load()
  }, [load])

  const guard = async (action: () => Promise<unknown>, message: string, onSuccess?: () => void) => {
    setError('')
    setInfo('')
    try {
      await action()
      onSuccess?.()
      setInfo(message)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }

  if (txn === null) {
    return (
      <div className="intake-page transaction-detail-page" aria-busy={error.length === 0}>
        <div className="page-heading">
          <div>
            <span className="eyebrow">Registration workspace</span>
            <h1>Transaction workflow</h1>
            <p className="muted">Review and complete the transaction workflow.</p>
          </div>
        </div>
        {error.length > 0 ? <Banner kind="error" message={error} /> : null}
        <div className="property-stage-layout">
          <div className="property-stage-content">
            <div className="property-stage-tabs" role="tablist" aria-label="Transaction sections">
              {workflowStageLabels.map((label, index) => (
                <button type="button" role="tab" className={index === 0 ? 'active' : ''} aria-selected={index === 0} disabled key={label}>
                  <span className="property-tab-marker" aria-hidden="true">{index + 1}</span>
                  <span className="property-tab-copy"><strong>{label}</strong><small>{index === 0 ? 'Loading' : 'Waiting'}</small></span>
                </button>
              ))}
            </div>
            <Panel title="Loading transaction details">
              <p className="helper" role="status">{error.length === 0 ? 'Loading transaction details…' : 'Transaction details could not be loaded.'}</p>
            </Panel>
          </div>
        </div>
      </div>
    )
  }

  const consentRows = txn.consents.length > 0
    ? txn.consents
    : txn.parties
      .filter((party) => party.id !== undefined || party.party_id !== undefined)
      .map((party) => ({ party_id: party.id ?? party.party_id, status: 'NOT_REQUESTED' }))

  const saveDetails = () =>
    guard(
      () =>
        put(`/api/transactions/${txnRef}/details`, {
          transactionDate: transactionDate.length === 0 ? undefined : transactionDate,
          declaredConsideration: numberOrUndefined(consideration),
          modeOfConsideration: Number(consideration) > 0 ? 'BANK_TRANSFER' : undefined,
          extentOrShareTransferred: numberOrUndefined(extent),
          extentUnit: extent.length === 0 ? undefined : extentUnit,
          relationshipCategory: relationshipCategory.length === 0 ? undefined : relationshipCategory,
          basisOfSettlement: txn.basis_of_settlement ?? undefined,
          shareBeingReleased: txn.share_being_released ?? undefined,
          resultingSubparcelCount: txn.resulting_subparcel_count ?? undefined,
          guidelineValue: txn.guideline_value ?? undefined,
          guidelineValueReference: txn.guideline_value_reference ?? undefined,
          remarks: txn.remarks ?? undefined,
        }),
      'Transaction details saved.',
      () => {
        setSelectedReadinessStep('Buyer details')
        setActiveWorkflowTab('txn-parties')
      },
    )

  const updateParty = (index: number, field: PartyField, value: string) => {
    setParties((current) => current.map((party, i) => (i === index ? { ...party, [field]: value } : party)))
    setPartyErrors((current) => {
      if (current[index]?.[field] === undefined) return current
      const next = { ...current, [index]: { ...current[index], [field]: undefined } }
      return next
    })
  }

  const buyerTypeOptions = ownerTypeOptionsFrom(bootstrap)
  const selectedBuyerType = buyerTypeOptions.find((type) => type.value === buyerTypeCode)
  const buyerLayout = ownerLayout(buyerTypeCode)
  const allowMultipleBuyers = selectedBuyerType?.allowMultipleOwners === true

  const changeBuyerType = (value: string) => {
    setBuyerTypeCode(value)
    if (buyerTypeOptions.find((type) => type.value === value)?.allowMultipleOwners !== true) {
      setParties((current) => {
        const firstBuyer = current.findIndex((party) => party.side === 'SIDE_2')
        return current.filter((party, index) => party.side !== 'SIDE_2' || index === firstBuyer)
      })
    }
    setPartyErrors({})
  }

  const validateParties = (): boolean => {
    const validationErrors: PartyErrors = {}
    parties.forEach((party, index) => {
      if (party.side !== 'SIDE_2') return
      const errors = validateOwner(party, buyerLayout)
      if (Object.keys(errors).length > 0) validationErrors[index] = errors
    })
    setPartyErrors(validationErrors)
    return Object.keys(validationErrors).length === 0
  }

  const saveParties = () => {
    if (!selectedBuyerType) {
      setInfo('')
      setError('Select the buyer type.')
      return
    }
    if (!validateParties()) {
      setInfo('')
      setError('Please correct the highlighted party details before saving.')
      return
    }
    return guard(
      () =>
        put(
          `/api/transactions/${txnRef}/parties`,
          parties.filter((p) => p.side === 'SIDE_2').map((p) => {
            const { ownerName, ...details } = ownerPayload(p, buyerLayout)
            return {
              side: p.side,
              role: txn.deedType.side2_role ?? undefined,
              ownerTypeCode: buyerTypeCode,
              name: ownerName,
              ...details,
              relationshipCode: p.relationshipCode.length === 0 ? undefined : p.relationshipCode,
            }
          }),
        ),
      'Parties saved.',
        () => setPartyFormVisible(false),
    )
  }

  const saveWitnesses = () => {
    if (witnessOne.trim().length === 0 || witnessTwo.trim().length === 0) {
      setInfo('')
      setError('Both witness names are required.')
      return
    }
    if ((witnessOneAadhaar.length > 0 && !AADHAAR_PATTERN.test(witnessOneAadhaar))
      || (witnessTwoAadhaar.length > 0 && !AADHAAR_PATTERN.test(witnessTwoAadhaar))) {
      setInfo('')
      setError('A witness Aadhaar number must contain exactly 12 digits when provided.')
      return
    }
    return guard(
      () =>
        put(`/api/transactions/${txnRef}/witnesses`, [
          {
            name: witnessOne,
            address: witnessOneAddress || undefined,
            phoneNumber: witnessOnePhone || undefined,
            idProofType: witnessOneAadhaar ? 'AADHAAR' : undefined,
            idProofRef: witnessOneAadhaar || undefined,
          },
          {
            name: witnessTwo,
            address: witnessTwoAddress || undefined,
            phoneNumber: witnessTwoPhone || undefined,
            idProofType: witnessTwoAadhaar ? 'AADHAAR' : undefined,
            idProofRef: witnessTwoAadhaar || undefined,
          },
        ]),
      'Witnesses saved.',
      () => setWitnessFormVisible(false),
    )
  }

  const transition = (actionCode: string) =>
    guard(() => post(`/api/transactions/${txnRef}/transitions`, { actionCode }, true), `${actionCode} applied.`)

  const requestConsent = async () => {
    setError('')
    setInfo('')
    try {
      await post(`/api/transactions/${txnRef}/consent/request`, {})
      setInfo('Consent started and Aadhaar OTP requested for all parties.')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      await load()
    }
  }

  const savePartyAadhaar = (partyId: number, aadhaarNumber: string) =>
    guard(
      () => put(`/api/transactions/${txnRef}/parties/${partyId}/aadhaar`, { aadhaarNumber }),
      'Aadhaar saved. You can now request the OTP.',
    )

  const verifyConsent = (partyId: number) =>
    guard(
      () => post(`/api/transactions/${txnRef}/consent/verify`, { partyId, otp: otpByParty[String(partyId)] ?? '' }),
      'Consent captured.',
    )

  const runRules = async () => {
    setError('')
    setInfo('')
    try {
      const results = await post<Row[]>(`/api/transactions/${encodeURIComponent(txnRef)}/rule-checks`, {})
      if (results.length === 0) {
        throw new Error('No rule engines ran for this transaction.')
      }
      await post(`/api/transactions/${txnRef}/transitions`, { actionCode: 'RULE_CHECKS_CLEAR' }, true)
      const warning = ruleWarningText(results)
      setInfo(`${warning.length > 0 ? `${warning} ` : 'Rule checks executed. '}Transaction is ready for fee calculation.`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      await load()
    }
  }

  const calculateFees = () =>
    guard(
      () => post(`/api/transactions/${encodeURIComponent(txnRef)}/fees`, {}),
      'Fees calculated.',
    )

  const recordPayment = () => {
    const payable = txn.feeCalculation?.total_payable
    return guard(
      async () => {
        const summary = await post<Row>(
          `/api/transactions/${txnRef}/payments`,
          { mode: paymentMode, referenceNo: paymentRef, amount: Number(payable) },
          true,
        )
        if (summary.fullyPaid === true || Number(summary.balance) <= 0) {
          await post(`/api/transactions/${txnRef}/transitions`, { actionCode: 'RECORD_PAYMENT' }, true)
        }
      },
      'Payment recorded. Transaction is ready for registration.',
    )
  }

  const register = () =>
    guard(
      () => post(`/api/transactions/${encodeURIComponent(txnRef)}/registration`, {
        comment: registrationComment.trim() || undefined,
      }, true),
      'Transaction registered.',
    )

  const witnessRows = (txn.witnesses ?? []).map((w) => ({
    ...w,
    id_proof_ref: w.id_proof_ref ?? w.idProofRef ?? '',
    phone_number: w.phone_number ?? w.phoneNumber ?? '',
  }))

  const validationMessages = txn.validation.map((validation) => formatCell(validation.message))

  const readinessDefinitions = [
    { label: 'Transaction details', target: 'txn-details', matches: /relationship category|guideline value|category/i },
    { label: 'Buyer details', target: 'txn-parties', matches: /each side.*at least one party|at least one party|party/i },
    { label: 'Witnesses', target: 'txn-witnesses', matches: /witness/i },
    { label: 'Aadhaar consent', target: 'txn-consent', matches: /aadhaar|otp|consent/i },
    { label: 'Rule checks', target: 'txn-rules', matches: /rule check|rule|validation/i },
    { label: 'Fees & payment', target: 'txn-fees', matches: /recorded payments|total payable|payment.*cover/i },
    { label: 'Registration', target: 'txn-registration', matches: /registration (?:is|required|must|cannot|not)/i },
  ]
  const readinessSteps = readinessDefinitions.map((definition) => ({
    ...definition,
    issues: validationMessages.filter((message) => {
      const matchingStep = readinessDefinitions.find((candidate) => candidate.matches.test(message))
      return (matchingStep?.label ?? 'Rule checks') === definition.label
    }),
  }))
  const workflowTabs = [
    { label: 'Property details', target: 'txn-property', issues: [] as string[] },
    ...readinessSteps,
  ]
  const currentStage = formatCell(txn.current_stage_code || txn.status).replaceAll('_', ' ')
  const renderReadinessDetails = (label: string) => {
    if (selectedReadinessStep !== label) return null
    const step = readinessSteps.find((item) => item.label === label)
    if (step === undefined) return null
    return (
      <div className={`readiness-detail${step.issues.length > 0 ? ' has-issues' : ' is-clear'}`} role="status">
        <strong>{step.issues.length > 0 ? 'Requirements to complete' : 'No outstanding requirements'}</strong>
        {step.issues.length > 0 ? (
          <ul>
            {step.issues.map((message, index) => <li key={`${label}-${index}`}>{message}</li>)}
          </ul>
        ) : null}
      </div>
    )
  }

  const sideTwoTitle = formatCell(txn.deedType.second_party_label || txn.deedType.side2_role || 'Buyer').replaceAll('_', ' ')

  const latestRuleResults = Array.from(
    txn.ruleCheckResults.reduce((latest, result) => {
      const engine = formatCell(result.engine)
      const current = latest.get(engine)
      const currentDate = current === undefined ? '' : formatCell(current.checked_at)
      const resultDate = formatCell(result.checked_at)
      if (current === undefined || resultDate > currentDate) {
        latest.set(engine, { ...result, summary: ruleSummary(result), executed_at: result.executed_at ?? result.checked_at })
      }
      return latest
    }, new Map<string, Row>()).values(),
  )

  const renderPartyGroup = (side: string, title: string) => {
    const group = parties
      .map((party, index) => ({ party, index }))
      .filter(({ party }) => party.side === side)

    return (
      <section className="party-group">
        <div className="owner-type-select">
          <Field label={`${title} type`} value={buyerTypeCode} onChange={changeBuyerType} options={buyerTypeOptions} required />
          {selectedBuyerType && allowMultipleBuyers ? (
            <button className="party-add-button" onClick={() => setParties([...parties, emptyParty(side)])}>
              <span aria-hidden="true">+</span> Add {title.toLowerCase()}
            </button>
          ) : null}
        </div>
        {selectedBuyerType ? group.map(({ party, index }, groupIndex) => (
          <section className="owner-entry" key={`${side}-${index}`}>
            {group.length > 1 ? (
              <header className="chain-history-entry-heading">
                <h3>{title} {groupIndex + 1}</h3>
                <button type="button" className="link" onClick={() => {
                  setParties((current) => current.filter((_, currentIndex) => currentIndex !== index))
                  setPartyErrors({})
                }}>Remove</button>
              </header>
            ) : null}
            <OwnerFields
              layout={buyerLayout}
              owner={party}
              errors={partyErrors[index]}
              onChange={(field, value) => updateParty(index, field, value)}
            />
          </section>
        )) : null}
      </section>
    )
  }

  const renderSavedBuyers = (title: string) => {
    const buyers = txn.parties.filter((party) => String(party.side ?? '') === 'SIDE_2')
    if (buyers.length === 0) return <p className="helper">No parties saved yet.</p>
    const typeCode = String(buyers[0].owner_type_code ?? '')
    return (
      <>
        <div className="owner-type-select">
          <Field label={`${title} type`} value={typeCode ? labelFor(buyerTypeOptions, typeCode) : '—'} onChange={() => undefined} readOnly />
        </div>
        {buyers.map((party, index) => (
          <section className="owner-entry" key={String(party.id ?? index)}>
            {buyers.length > 1 ? (
              <header className="chain-history-entry-heading"><h3>{title} {index + 1}</h3></header>
            ) : null}
            <PartyDetailsView
              layout={ownerLayout(String(party.owner_type_code ?? ''))}
              party={party}
              relationship={party.relationship_code ? String(party.relationship_code) : undefined}
            />
          </section>
        ))}
      </>
    )
  }

  return (
    <div className="intake-page transaction-detail-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Registration workspace</span>
          <h1>{pageTitle ?? 'Transaction details'}</h1>
          <p className="muted">
            {txn.txn_ref.length > 0
              ? `Transaction ${txn.txn_ref} is in ${currentStage} stage.`
              : 'Review and complete the transaction workflow.'}
          </p>
        </div>
        <div className="dashboard-actions">
          <StatusPill status={txn.status} />
          <button type="button" className="outline" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <Banner kind="error" message={error} />
      <Banner kind="success" message={info} />

      <div className="property-stage-layout">
        <div className="property-stage-content">
          <div className="property-stage-tabs" role="tablist" aria-label="Transaction sections">
            {workflowTabs.map((step) => (
              <button
                key={step.target}
                id={`workflow-tab-${step.target}`}
                type="button"
                role="tab"
                className={`${activeWorkflowTab === step.target ? 'active' : ''}${step.issues.length > 0 ? ' has-errors' : ''}`}
                aria-selected={activeWorkflowTab === step.target}
                aria-controls={step.target}
                onClick={() => {
                  setSelectedReadinessStep(step.label)
                  setActiveWorkflowTab(step.target)
                }}
              >
                <span className="property-tab-marker" aria-hidden="true">{step.issues.length > 0 ? '!' : workflowTabs.findIndex((item) => item.target === step.target) + 1}</span>
                <span className="property-tab-copy"><strong>{step.label}</strong><small>{step.issues.length > 0 ? `${step.issues.length} to resolve` : 'Ready'}</small></span>
              </button>
            ))}
          </div>

          <div id="txn-property" className="transaction-task-anchor" role="tabpanel" aria-labelledby="workflow-tab-txn-property" tabIndex={0} hidden={activeWorkflowTab !== 'txn-property'}>
            <Panel title="">
              <dl className="kv">
                <dt>Property reference</dt><dd>{formatCell(txn.property.property_ref ?? txn.property.propertyRef)}</dd>
                <dt>ULPIN</dt><dd>{formatCell(txn.property.ulpin ?? txn.property.ULPIN)}</dd>
                <dt>Survey number</dt><dd>{formatCell(txn.property.survey_no ?? txn.property.surveyNo)}</dd>
                <dt>Village</dt><dd>{formatCell(txn.property.village_name ?? txn.property.villageName ?? txn.property.village_code ?? txn.property.villageCode)}</dd>
                <dt>District</dt><dd>{formatCell(txn.property.district_name ?? txn.property.districtName ?? txn.property.district_code ?? txn.property.districtCode)}</dd>
                <dt>Address</dt><dd>{formatCell(txn.property.address)}</dd>
                <dt>Extent</dt><dd>{formatCell(txn.property.extent_value ?? txn.property.extentValue)} {formatCell(txn.property.extent_unit ?? txn.property.extentUnit)}</dd>
              </dl>
            </Panel>
          </div>

          <div id="txn-details" className="transaction-task-anchor" role="tabpanel" aria-labelledby="workflow-tab-txn-details" tabIndex={0} hidden={activeWorkflowTab !== 'txn-details'}>
            <Panel title="">
              {renderReadinessDetails('Transaction details')}
              <div className="form-grid three">
                <Field label="Transaction date" value={transactionDate} onChange={setTransactionDate} type="date" />
                <Field label="Declared consideration" value={consideration} onChange={setConsideration} type="number" />
                <Field label="Extent / share transferred" value={extent} onChange={setExtent} type="number" />
                <Field
                  label="Extent unit"
                  value={extentUnit}
                  onChange={setExtentUnit}
                  options={['SQ_FT', 'SQ_M', 'CENT', 'ACRE', 'PERCENT'].map((u) => ({ value: u, label: u }))}
                />
                <Field
                  label="Relationship category"
                  value={relationshipCategory}
                  onChange={setRelationshipCategory}
                  options={[
                    { value: 'FAMILY', label: 'Family' },
                    { value: 'NON_FAMILY', label: 'Non-family' },
                  ]}
                />
              </div>
              <div className="form-submit-row">
                <button type="button" className="primary" onClick={() => void saveDetails()}>Save transaction details</button>
              </div>
            </Panel>
          </div>

          <div id="txn-parties" className="transaction-task-anchor" role="tabpanel" aria-labelledby="workflow-tab-txn-parties" tabIndex={0} hidden={activeWorkflowTab !== 'txn-parties'}>
            <Panel
              title="Buyer details"
              actions={
                partyFormVisible ? (
                  <button type="button" className="primary" onClick={() => void saveParties()}>
                    Save parties
                  </button>
                ) : (
                  <button type="button" className="outline" onClick={() => setPartyFormVisible(true)}>
                    Edit parties
                  </button>
                )
              }
            >
              {renderReadinessDetails('Buyer details')}
              {partyFormVisible ? renderPartyGroup('SIDE_2', sideTwoTitle) : renderSavedBuyers(sideTwoTitle)}
            </Panel>
          </div>

          <div id="txn-witnesses" className="transaction-task-anchor" role="tabpanel" aria-labelledby="workflow-tab-txn-witnesses" tabIndex={0} hidden={activeWorkflowTab !== 'txn-witnesses'}>
            <Panel
              title=""
              actions={!witnessFormVisible ? (
                <button type="button" className="outline" onClick={() => setWitnessFormVisible(true)}>
                  Edit witnesses
                </button>
              ) : undefined}
            >
              {renderReadinessDetails('Witnesses')}
              {witnessFormVisible ? (
                <>
                  <p className="helper">Capture witness information before moving on to Aadhaar consent.</p>
                  <div className="form-grid two">
                    <Field label="Witness 1 name" value={witnessOne} onChange={setWitnessOne} required />
                    <Field label="Witness 1 address" value={witnessOneAddress} onChange={setWitnessOneAddress} />
                    <Field label="Witness 1 phone number" value={witnessOnePhone} onChange={setWitnessOnePhone} type="tel" />
                    <Field label="Witness 1 Aadhaar (optional)" value={witnessOneAadhaar} onChange={(v) => setWitnessOneAadhaar(v.replace(/\D/g, '').slice(0, 12))} />
                    <Field label="Witness 2 name" value={witnessTwo} onChange={setWitnessTwo} required />
                    <Field label="Witness 2 address" value={witnessTwoAddress} onChange={setWitnessTwoAddress} />
                    <Field label="Witness 2 phone number" value={witnessTwoPhone} onChange={setWitnessTwoPhone} type="tel" />
                    <Field label="Witness 2 Aadhaar (optional)" value={witnessTwoAadhaar} onChange={(v) => setWitnessTwoAadhaar(v.replace(/\D/g, '').slice(0, 12))} />
                  </div>
                  <div className="form-submit-row witness-submit-row">
                    <button type="button" className="primary" onClick={() => void saveWitnesses()}>Save witnesses</button>
                  </div>
                </>
              ) : null}
              <DataTable
                rows={witnessRows}
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'address', label: 'Address' },
                  { key: 'phone_number', label: 'Phone number' },
                  { key: 'id_proof_type', label: 'ID proof' },
                  { key: 'id_proof_ref', label: 'ID proof ref' },
                ]}
                empty="No witnesses saved yet."
              />
            </Panel>
          </div>

          <div id="txn-consent" className="transaction-task-anchor" role="tabpanel" aria-labelledby="workflow-tab-txn-consent" tabIndex={0} hidden={activeWorkflowTab !== 'txn-consent'}>
            <Panel
              title="Aadhaar consent"
              actions={<button type="button" disabled={!['DRAFT', 'CONSENT_PENDING'].includes(txn.status)} onClick={() => void requestConsent()}>{txn.status === 'DRAFT' ? 'Start consent and request OTP' : 'Request OTP for all parties'}</button>}
            >
              {renderReadinessDetails('Aadhaar consent')}
              <p className="muted">Demo Aadhaar OTP: <code>123456</code>. Raw Aadhaar is never stored.</p>
              <MissingAadhaarCapture
                parties={txn.parties}
                disabled={!['DRAFT', 'CONSENT_PENDING'].includes(txn.status)}
                onSave={savePartyAadhaar}
                roleOf={(party) => formatCell(
                  party.role ?? (party.side === 'SIDE_1' ? txn.deedType.side1_role : txn.deedType.side2_role) ?? 'Party',
                ).replaceAll('_', ' ')}
              />
              {consentRows.map((c, i) => (
                <div className="row" key={i}>
                  <span className="grow">
                    {(() => {
                      const party = txn.parties.find(
                        (item) => String(item.id ?? item.party_id) === String(c.party_id),
                      )
                      const sideRole = party?.side === 'SIDE_1'
                        ? txn.deedType.side1_role
                        : txn.deedType.side2_role
                      const role = formatCell(party?.role ?? sideRole ?? 'Party').replaceAll('_', ' ')
                      const name = party === undefined ? `#${formatCell(c.party_id)}` : formatCell(party.name)
                      return `${role}: ${name} — ${formatCell(c.status)}`
                    })()}
                  </span>
                  <Field
                    label="OTP"
                    value={otpByParty[formatCell(c.party_id)] ?? ''}
                    onChange={(v) => setOtpByParty({ ...otpByParty, [formatCell(c.party_id)]: v })}
                  />
                  <button
                    type="button"
                    disabled={txn.status !== 'CONSENT_PENDING'
                      || formatCell(c.status) === 'VERIFIED'
                      || !/^\d{6}$/.test(otpByParty[formatCell(c.party_id)] ?? '')}
                    onClick={() => void verifyConsent(Number(c.party_id))}
                  >
                    Verify
                  </button>
                </div>
              ))}
            </Panel>
          </div>

          <div id="txn-rules" className="transaction-task-anchor" role="tabpanel" aria-labelledby="workflow-tab-txn-rules" tabIndex={0} hidden={activeWorkflowTab !== 'txn-rules'}>
            <Panel title="">
              {renderReadinessDetails('Rule checks')}
              <p className="muted">
                A court attachment on the EC stops pre-registration. Other findings are warnings for manual review and
                the transaction can continue.
              </p>
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
              <RuleCheckDetails results={latestRuleResults} />
              <div className="form-submit-row">
                <button type="button" className="primary" disabled={txn.status !== 'RULE_CHECK_PENDING'} onClick={() => void runRules()}>Run rule checks</button>
              </div>
            </Panel>
          </div>

          <div id="txn-fees" className="transaction-task-anchor" role="tabpanel" aria-labelledby="workflow-tab-txn-fees" tabIndex={0} hidden={activeWorkflowTab !== 'txn-fees'}>
            <Panel title="">
              {renderReadinessDetails('Fees & payment')}
              <div className="form-submit-row">
                <button type="button" disabled={txn.status !== 'FEE_PAYMENT_PENDING'} onClick={() => void calculateFees()}>Calculate fee</button>
              </div>
              {txn.feeCalculation === null ? (
                <p className="muted">No fee calculation yet.</p>
              ) : (
                <dl className="kv">
                  <dt>Valuation basis</dt>
                  <dd>
                    {formatCell(txn.feeCalculation.valuation_basis_used)} — {formatCell(txn.feeCalculation.valuation_amount)}
                  </dd>
                  <dt>Stamp duty</dt>
                  <dd>{formatCell(txn.feeCalculation.stamp_duty)}</dd>
                  <dt>Registration fee</dt>
                  <dd>{formatCell(txn.feeCalculation.registration_fee)}</dd>
                  <dt>TDS</dt>
                  <dd>{formatCell(txn.feeCalculation.tds_amount)}</dd>
                  <dt>Other charges</dt>
                  <dd>{formatCell(txn.feeCalculation.other_charges)}</dd>
                  <dt>Survey fee</dt>
                  <dd>{formatCell(txn.feeCalculation.survey_fee ?? 0)}</dd>
                  <dt>Total payable</dt>
                  <dd>
                    <b>{formatCell(txn.feeCalculation.total_payable)}</b>
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
                <button
                  type="button"
                  className="primary"
                  disabled={txn.status !== 'FEE_PAYMENT_PENDING' || txn.feeCalculation === null || paymentRef.length === 0}
                  onClick={() => void recordPayment()}
                >
                  Record payment
                </button>
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
            </Panel>
          </div>

          <div id="txn-registration" className="transaction-task-anchor" role="tabpanel" aria-labelledby="workflow-tab-txn-registration" tabIndex={0} hidden={activeWorkflowTab !== 'txn-registration'}>
            <Panel title="">
              {renderReadinessDetails('Registration')}
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
                <button type="button" className="primary" disabled={txn.status !== 'SUBMITTED'} onClick={() => void register()}>Register</button>
              </div>
            </Panel>
          </div>

          {txn.availableActions.length > 0 ? (
            <div className="property-stage-actions">
              <span className="stage-label">Quick actions</span>
              <div className="actions">
                {txn.availableActions.map((action, index) => (
                  <button
                    key={`${formatCell(action.actionCode)}-${index}`}
                    type="button"
                    onClick={() => void transition(formatCell(action.actionCode))}
                  >
                    {formatCell(action.actionCode)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

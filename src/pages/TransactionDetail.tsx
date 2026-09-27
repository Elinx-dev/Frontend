import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiError, get, post, put } from '../api'
import type { Row, TransactionDetail as Txn } from '../types'
import { Banner, DataTable, Field, Panel, StatusPill, formatCell } from '../ui'

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
type PartyErrors = Record<number, Partial<Record<PartyField, string>>>

const AADHAAR_PATTERN = /^\d{12}$/
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const SHARE_EPSILON = 0.01

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

export default function TransactionDetail() {
  const { txnRef = '' } = useParams()
  const [txn, setTxn] = useState<Txn | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [consideration, setConsideration] = useState('')
  const [extent, setExtent] = useState('')
  const [extentUnit, setExtentUnit] = useState('SQ_FT')
  const [relationshipCategory, setRelationshipCategory] = useState('')
  const [parties, setParties] = useState<PartyForm[]>([emptyParty('SIDE_1'), emptyParty('SIDE_2')])
  const [partyFormVisible, setPartyFormVisible] = useState(true)
  const [partyErrors, setPartyErrors] = useState<PartyErrors>({})
  const [witnessOne, setWitnessOne] = useState('')
  const [witnessOneAadhaar, setWitnessOneAadhaar] = useState('')
  const [witnessTwo, setWitnessTwo] = useState('')
  const [witnessTwoAadhaar, setWitnessTwoAadhaar] = useState('')
  const [otpByParty, setOtpByParty] = useState<Record<string, string>>({})
  const [paymentMode, setPaymentMode] = useState('E_CHALLAN')
  const [paymentRef, setPaymentRef] = useState('')
  const [selectedReadinessStep, setSelectedReadinessStep] = useState<string | null>(null)
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
        setExtent(String(result.extent_or_share_transferred ?? result.extentOrShareTransferred ?? ''))
        setExtentUnit(String(result.extent_unit ?? result.extentUnit ?? 'SQ_FT'))
        setRelationshipCategory(String(result.relationship_category ?? result.relationshipCategory ?? ''))

        const savedParties = Array.isArray(result.parties) ? result.parties : []
        setPartyFormVisible(savedParties.length === 0)
        const sourceParties = savedParties.length > 0
          ? savedParties
          : registeredOwners.map((owner) => ({ ...owner, side: 'SIDE_1' }))
        const partyForms = sourceParties.map((party) => ({
          ...emptyParty(String(party.side ?? 'SIDE_1')),
          partyType: String(party.party_type ?? party.partyType ?? 'INDIVIDUAL'),
          name: String(party.name ?? party.owner_name ?? party.ownerName ?? ''),
          aadhaarNumber: String(party.aadhaar_number ?? party.aadhaarNumber ?? ''),
          pan: String(party.pan ?? ''),
          address: String(party.address ?? ''),
          relationshipCode: String(party.relationship_code ?? party.relationshipCode ?? ''),
          existingSharePct: String(party.existing_share_pct ?? party.share_pct ?? party.sharePct ?? ''),
          shareTransferredPct: String(party.share_transferred_pct ?? ''),
          resultingSharePct: String(party.resulting_share_pct ?? party.share_pct ?? party.sharePct ?? ''),
        }))
        setParties(partyForms.length > 0 ? partyForms : [emptyParty('SIDE_1'), emptyParty('SIDE_2')])
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
    return <Banner kind="error" message={error.length === 0 ? 'Loading…' : error} />
  }

  const saveDetails = () =>
    guard(
      () =>
        put(`/api/transactions/${txnRef}/details`, {
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
    )

  const updateParty = (index: number, field: PartyField, value: string) => {
    setParties((current) => current.map((party, i) => (i === index ? { ...party, [field]: value } : party)))
    setPartyErrors((current) => {
      if (current[index]?.[field] === undefined) return current
      const next = { ...current, [index]: { ...current[index], [field]: undefined } }
      return next
    })
  }

  const validateParties = (): boolean => {
    const validationErrors: PartyErrors = {}
    const transferredTotals: Record<string, number> = { SIDE_1: 0, SIDE_2: 0 }

    const addError = (index: number, field: PartyField, message: string) => {
      validationErrors[index] = {
        ...validationErrors[index],
        [field]: validationErrors[index]?.[field] ?? message,
      }
    }

    parties.forEach((party, index) => {
      if (party.name.trim().length === 0) {
        addError(index, 'name', 'Name is required.')
      }
      if (!AADHAAR_PATTERN.test(party.aadhaarNumber)) {
        addError(index, 'aadhaarNumber', 'Aadhaar must contain exactly 12 digits.')
      }
      if (party.pan.length > 0 && !PAN_PATTERN.test(party.pan)) {
        addError(index, 'pan', 'PAN must match AAAAA9999A.')
      }
      if (party.address.trim().length === 0) {
        addError(index, 'address', 'Address is required.')
      }

      const percentages: Array<[PartyField, string, boolean]> = [
        ['existingSharePct', 'Existing share', false],
        ['shareTransferredPct', 'Transferred share', true],
        ['resultingSharePct', 'Resulting share', false],
      ]
      for (const [field, label, required] of percentages) {
        const value = party[field].trim()
        if (value.length === 0) {
          if (required) addError(index, field, `${label} is required.`)
          continue
        }
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
          addError(index, field, `${label} must be between 0 and 100.`)
        } else if (field === 'shareTransferredPct') {
          transferredTotals[party.side] = (transferredTotals[party.side] ?? 0) + numericValue
        }
      }
    })

    if (Math.abs(transferredTotals.SIDE_1 - transferredTotals.SIDE_2) > SHARE_EPSILON) {
      const message = `Transferred shares must balance (seller ${transferredTotals.SIDE_1}%, buyer ${transferredTotals.SIDE_2}%).`
      parties.forEach((_, index) => addError(index, 'shareTransferredPct', message))
    }

    setPartyErrors(validationErrors)
    return Object.keys(validationErrors).length === 0
  }

  const saveParties = () => {
    if (!validateParties()) {
      setInfo('')
      setError('Please correct the highlighted party details before saving.')
      return
    }
    return guard(
      () =>
        put(
          `/api/transactions/${txnRef}/parties`,
          parties.map((p) => ({
            side: p.side,
            role: p.side === 'SIDE_1'
              ? txn.deedType.side1_role ?? undefined
              : txn.deedType.side2_role ?? undefined,
            partyType: p.partyType,
            name: p.name,
            aadhaarNumber: p.aadhaarNumber.length === 0 ? undefined : p.aadhaarNumber,
            pan: p.pan.length === 0 ? undefined : p.pan,
            address: p.address.length === 0 ? undefined : p.address,
            relationshipCode: p.relationshipCode.length === 0 ? undefined : p.relationshipCode,
            existingSharePct: numberOrUndefined(p.existingSharePct),
            shareTransferredPct: numberOrUndefined(p.shareTransferredPct),
            resultingSharePct: numberOrUndefined(p.resultingSharePct),
          })),
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
    if (!AADHAAR_PATTERN.test(witnessOneAadhaar) || !AADHAAR_PATTERN.test(witnessTwoAadhaar)) {
      setInfo('')
      setError('Each witness Aadhaar number must contain exactly 12 digits.')
      return
    }
    return guard(
      () =>
        put(`/api/transactions/${txnRef}/witnesses`, [
          { name: witnessOne, address: 'Recorded at SRO', idProofType: 'AADHAAR', idProofRef: witnessOneAadhaar },
          { name: witnessTwo, address: 'Recorded at SRO', idProofType: 'AADHAAR', idProofRef: witnessTwoAadhaar },
        ]),
      'Witnesses saved.',
    )
  }

  const transition = (actionCode: string) =>
    guard(() => post(`/api/transactions/${txnRef}/transitions`, { actionCode }, true), `${actionCode} applied.`)

  const requestConsent = () =>
    guard(async () => {
      if (txn.status === 'DRAFT') {
        await post(`/api/transactions/${txnRef}/transitions`, { actionCode: 'REQUEST_CONSENT' }, true)
      }
      await post(`/api/transactions/${txnRef}/consent/request`, {})
    }, 'Consent started and Aadhaar OTP requested for all parties.')

  const verifyConsent = (partyId: number) =>
    guard(
      () => post(`/api/transactions/${txnRef}/consent/verify`, { partyId, otp: otpByParty[String(partyId)] ?? '' }),
      'Consent captured.',
    )

  const runRules = () =>
    guard(async () => {
      const results = await post<Row[]>(`/api/transactions/${encodeURIComponent(txnRef)}/rule-checks`, {})
      if (results.length === 0) {
        throw new Error('No rule engines ran for this transaction.')
      }
      await post(`/api/transactions/${txnRef}/transitions`, { actionCode: 'RULE_CHECKS_CLEAR' }, true)
    }, 'Rule checks executed. Transaction is ready for fee calculation.')

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
      () => post(`/api/transactions/${encodeURIComponent(txnRef)}/registration`, {}, true),
      'Transaction registered.',
    )

  const witnessRows = (txn.witnesses ?? []).map((w) => ({
    ...w,
    id_proof_ref: w.id_proof_ref ?? w.idProofRef ?? '',
  }))

  const validationMessages = txn.validation.map((validation) => formatCell(validation.message))

  const readinessDefinitions = [
    { label: 'Transaction details', target: 'txn-details', matches: /relationship category|guideline value|category/i },
    { label: 'Parties', target: 'txn-parties', matches: /each side.*at least one party|at least one party/i },
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

  const sideOneTitle = formatCell(txn.deedType.side1_role || 'Seller').replaceAll('_', ' ')
  const sideTwoTitle = formatCell(txn.deedType.side2_role || 'Buyer').replaceAll('_', ' ')

  const latestRuleResults = Array.from(
    txn.ruleCheckResults.reduce((latest, result) => {
      const engine = formatCell(result.engine)
      const current = latest.get(engine)
      const currentDate = current === undefined ? '' : formatCell(current.checked_at)
      const resultDate = formatCell(result.checked_at)
      if (current === undefined || resultDate > currentDate) {
        latest.set(engine, result)
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
        <div className="section-heading">
          <h3>{title}</h3>
          <button className="party-add-button" onClick={() => setParties([...parties, emptyParty(side)])}>
            <span aria-hidden="true">+</span> Add {title.toLowerCase()}
          </button>
        </div>
        {group.map(({ party, index }) => (
          <div className="row party-row" key={`${side}-${index}`}>
            <div>
              <Field
                label="Name"
                value={party.name}
                required
                onChange={(v) => updateParty(index, 'name', v)}
              />
              {partyErrors[index]?.name ? <span className="field-error">{partyErrors[index].name}</span> : null}
            </div>
            <div>
              <Field
                label="Aadhaar (12 digits)"
                value={party.aadhaarNumber}
                required
                onChange={(v) => updateParty(index, 'aadhaarNumber', v.replace(/\D/g, '').slice(0, 12))}
              />
              {partyErrors[index]?.aadhaarNumber ? (
                <span className="field-error">{partyErrors[index].aadhaarNumber}</span>
              ) : null}
            </div>
            <div>
              <Field
                label="PAN"
                value={party.pan}
                onChange={(v) => updateParty(index, 'pan', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
              />
              {partyErrors[index]?.pan ? <span className="field-error">{partyErrors[index].pan}</span> : null}
            </div>
            <div>
              <Field
                label="Address"
                value={party.address}
                required
                onChange={(v) => updateParty(index, 'address', v)}
              />
              {partyErrors[index]?.address ? (
                <span className="field-error">{partyErrors[index].address}</span>
              ) : null}
            </div>
            <div>
              <Field
                label="Existing share %"
                value={party.existingSharePct}
                type="number"
                onChange={(v) => updateParty(index, 'existingSharePct', v)}
              />
              {partyErrors[index]?.existingSharePct ? (
                <span className="field-error">{partyErrors[index].existingSharePct}</span>
              ) : null}
            </div>
            <div>
              <Field
                label="Share transferred %"
                value={party.shareTransferredPct}
                type="number"
                required
                onChange={(v) => updateParty(index, 'shareTransferredPct', v)}
              />
              {partyErrors[index]?.shareTransferredPct ? (
                <span className="field-error">{partyErrors[index].shareTransferredPct}</span>
              ) : null}
            </div>
            <div>
              <Field
                label="Resulting share %"
                value={party.resultingSharePct}
                type="number"
                onChange={(v) => updateParty(index, 'resultingSharePct', v)}
              />
              {partyErrors[index]?.resultingSharePct ? (
                <span className="field-error">{partyErrors[index].resultingSharePct}</span>
              ) : null}
            </div>
          </div>
        ))}
      </section>
    )
  }

  return (
    <>
      <Panel
        title={`Transaction ${txn.txn_ref}`}
        actions={
          <>
            <StatusPill status={txn.status} />
            <button onClick={() => void load()}>Refresh</button>
          </>
        }
      >
        <Banner kind="error" message={error} />
        <Banner kind="success" message={info} />
        <dl className="kv">
          <dt>Property</dt>
          <dd>
            <Link to={`/properties/${formatCell(txn.property.property_ref)}`}>
              {formatCell(txn.property.property_ref)}
            </Link>
          </dd>
          <dt>Deed type</dt>
          <dd>{txn.deed_type_code}</dd>
          <dt>Transfer scope</dt>
          <dd>{formatCell(txn.transfer_scope)}</dd>
          <dt>Survey required</dt>
          <dd>{formatCell(txn.survey_required)}</dd>
          <dt>Stage</dt>
          <dd>{formatCell(txn.current_stage_code)}</dd>
        </dl>
        <section className="readiness-flow" aria-label="Transaction readiness workflow">
          <div className="readiness-flow-head">
            <div>
              <span className="eyebrow">Registration workflow</span>
              <h3>Readiness checks</h3>
            </div>
            <div className="readiness-current">
              <span>Current status</span>
              <strong>{currentStage}</strong>
            </div>
          </div>
          <div className="readiness-track" role="list">
            {readinessSteps.map((step, index) => (
              <div className="readiness-step-item" role="listitem" key={step.label}>
                <button
                  type="button"
                  className={`readiness-step-button${step.issues.length > 0 ? ' has-issues' : ' is-clear'}${selectedReadinessStep === step.label ? ' selected' : ''}`}
                  aria-label={`${step.label}, ${step.issues.length > 0 ? `${step.issues.length} requirements to resolve` : 'no open requirements'}. Go to task.`}
                  aria-current={selectedReadinessStep === step.label ? 'step' : undefined}
                  onClick={() => {
                    setSelectedReadinessStep(step.label)
                    document.getElementById(step.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <span className="readiness-marker-row">
                    <span className="readiness-marker" aria-hidden="true">
                      {index + 1}
                    </span>
                    {index < readinessSteps.length - 1 ? <span className="readiness-line" aria-hidden="true" /> : null}
                  </span>
                  <strong className="readiness-label">{step.label}</strong>
                  <span className="readiness-state">
                    {step.issues.length > 0 ? `${step.issues.length} to resolve` : 'No open issues'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </section>
        <div className="actions">
          {txn.availableActions.map((a, i) => (
            <button key={i} onClick={() => void transition(formatCell(a.actionCode))}>
              {formatCell(a.actionCode)}
            </button>
          ))}
        </div>
      </Panel>

      <div id="txn-details" className="transaction-task-anchor" tabIndex={-1}>
      <Panel title="1. Transaction details" actions={<button onClick={() => void saveDetails()}>Save</button>}>
        {renderReadinessDetails('Transaction details')}
        <div className="row">
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
      </Panel>
      </div>

      <div id="txn-parties" className="transaction-task-anchor" tabIndex={-1}>
      <Panel
        title="2. Parties"
        actions={
          partyFormVisible ? (
            <button className="primary" onClick={() => void saveParties()}>
              Save parties
            </button>
          ) : (
            <button className="outline" onClick={() => setPartyFormVisible(true)}>
              Edit parties
            </button>
          )
        }
      >
        {renderReadinessDetails('Parties')}
        {partyFormVisible ? (
          <>
            {renderPartyGroup('SIDE_1', sideOneTitle)}
            {renderPartyGroup('SIDE_2', sideTwoTitle)}
          </>
        ) : null}
        <DataTable
          rows={txn.parties}
          columns={[
            { key: 'role', label: 'Role' },
            { key: 'name', label: 'Name' },
            { key: 'aadhaar_last4', label: 'Aadhaar ••••' },
            { key: 'existing_share_pct', label: 'Existing %' },
            { key: 'resulting_share_pct', label: 'Resulting %' },
          ]}
          empty="No parties saved yet."
        />
      </Panel>
      </div>

      <div id="txn-witnesses" className="transaction-task-anchor" tabIndex={-1}>
      <Panel title="3. Witnesses" actions={<button onClick={() => void saveWitnesses()}>Save witnesses</button>}>
        {renderReadinessDetails('Witnesses')}
        <div className="row">
          <Field label="Witness 1" value={witnessOne} onChange={setWitnessOne} required />
          <Field label="Witness 1 Aadhaar (12 digits)" value={witnessOneAadhaar} onChange={(v) => setWitnessOneAadhaar(v.replace(/\D/g, '').slice(0, 12))} required />
          <Field label="Witness 2" value={witnessTwo} onChange={setWitnessTwo} required />
          <Field label="Witness 2 Aadhaar (12 digits)" value={witnessTwoAadhaar} onChange={(v) => setWitnessTwoAadhaar(v.replace(/\D/g, '').slice(0, 12))} required />
        </div>
        <DataTable
          rows={witnessRows}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'id_proof_type', label: 'Id proof' },
            { key: 'id_proof_ref', label: 'ID proof ref' },
          ]}
        />
      </Panel>
      </div>

      <div id="txn-consent" className="transaction-task-anchor" tabIndex={-1}>
      <Panel
        title="4. Aadhaar consent"
        actions={<button
          disabled={!['DRAFT', 'CONSENT_PENDING'].includes(txn.status)}
          onClick={() => void requestConsent()}
        >
          {txn.status === 'DRAFT' ? 'Start consent and request OTP' : 'Request OTP for all parties'}
        </button>}
      >
        {renderReadinessDetails('Aadhaar consent')}
        <p className="muted">Demo Aadhaar OTP: <code>123456</code>. Raw Aadhaar is never stored.</p>
        {txn.consents.map((c, i) => (
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

      <div id="txn-rules" className="transaction-task-anchor" tabIndex={-1}>
      <Panel title="5. Rule checks" actions={<button disabled={txn.status !== 'RULE_CHECK_PENDING'} onClick={() => void runRules()}>Run rule checks</button>}>
        {renderReadinessDetails('Rule checks')}
        <p className="muted">Rule outcomes are advisory during the pilot; an officer may acknowledge and proceed.</p>
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
      </Panel>
      </div>

      <div id="txn-fees" className="transaction-task-anchor" tabIndex={-1}>
      <Panel title="6. Fees and payment" actions={<button disabled={txn.status !== 'FEE_PAYMENT_PENDING'} onClick={() => void calculateFees()}>Calculate fee</button>}>
        {renderReadinessDetails('Fees & payment')}
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

      <div id="txn-registration" className="transaction-task-anchor" tabIndex={-1}>
      <Panel title="7. Registration" actions={<button className="primary" disabled={txn.status !== 'SUBMITTED'} onClick={() => void register()}>Register</button>}>
        {renderReadinessDetails('Registration')}
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
      </Panel>
      </div>
    </>
  )
}

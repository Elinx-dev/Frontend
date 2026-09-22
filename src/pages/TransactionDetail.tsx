import { useCallback, useEffect, useState } from 'react'
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
  const [partyErrors, setPartyErrors] = useState<PartyErrors>({})
  const [witnessOne, setWitnessOne] = useState('')
  const [witnessTwo, setWitnessTwo] = useState('')
  const [otpByParty, setOtpByParty] = useState<Record<string, string>>({})
  const [paymentMode, setPaymentMode] = useState('E_CHALLAN')
  const [paymentRef, setPaymentRef] = useState('')

  const load = useCallback(async () => {
    try {
      let result: Txn
      try {
        result = await get<Txn>(`/api/transactions/ref/${encodeURIComponent(txnRef)}`)
      } catch {
        result = await get<Txn>(`/api/transactions/${encodeURIComponent(txnRef)}`)
      }
      const registeredOwners = Array.isArray(result.registeredOwners) ? result.registeredOwners : []
      const sellerParties = registeredOwners.map((owner) => ({
        ...emptyParty('SIDE_1'),
        name: String(owner.owner_name ?? owner.ownerName ?? ''),
        aadhaarNumber: String(owner.aadhaar_number ?? owner.aadhaarNumber ?? ''),
        pan: String(owner.pan ?? ''),
        address: String(owner.address ?? ''),
        existingSharePct: String(owner.share_pct ?? owner.sharePct ?? ''),
        resultingSharePct: String(owner.share_pct ?? owner.sharePct ?? ''),
      }))
      if (sellerParties.length > 0) {
        setParties((current) => current.some((party) => party.name || party.aadhaarNumber || party.address) ? current : [...sellerParties, emptyParty('SIDE_2')])
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
        validation: result.validation ?? {},
        feeCalculation: result.feeCalculation ?? null,
      })
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

  if (txn === null) {
    return <Banner kind="error" message={error.length === 0 ? 'Loading…' : error} />
  }

  const saveDetails = () =>
    guard(
      () =>
        put(`/api/transactions/${txnRef}/details`, {
          declaredConsideration: numberOrUndefined(consideration),
          modeOfConsideration: consideration.length === 0 ? undefined : 'BANK_TRANSFER',
          extentOrShareTransferred: numberOrUndefined(extent),
          extentUnit: extent.length === 0 ? undefined : extentUnit,
          relationshipCategory: relationshipCategory.length === 0 ? undefined : relationshipCategory,
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
            role: p.side === 'SIDE_1' ? 'SELLER' : 'BUYER',
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
    )
  }

  const saveWitnesses = () =>
    guard(
      () =>
        put(`/api/transactions/${txnRef}/witnesses`, [
          { name: witnessOne, address: 'Recorded at SRO', idProofType: 'AADHAAR', idProofRef: 'XXXX-1' },
          { name: witnessTwo, address: 'Recorded at SRO', idProofType: 'AADHAAR', idProofRef: 'XXXX-2' },
        ]),
      'Witnesses saved.',
    )

  const transition = (actionCode: string) =>
    guard(() => post(`/api/transactions/${txnRef}/transitions`, { actionCode }, true), `${actionCode} applied.`)

  const requestConsent = () =>
    guard(() => post(`/api/transactions/${txnRef}/consent/request`, {}), 'Aadhaar OTP requested for all parties.')

  const verifyConsent = (partyId: number) =>
    guard(
      () => post(`/api/transactions/${txnRef}/consent/verify`, { partyId, otp: otpByParty[String(partyId)] ?? '' }),
      'Consent captured.',
    )

  const runRules = () =>
    guard(
      () => post(`/api/transactions/${encodeURIComponent(txnRef)}/rule-checks`, {}),
      'Rule checks executed.',
    )

  const calculateFees = () =>
    guard(
      () => post(`/api/transactions/${encodeURIComponent(txnRef)}/fees`, {}),
      'Fees calculated.',
    )

  const recordPayment = () => {
    const payable = txn.feeCalculation?.total_payable
    return guard(
      () =>
        post(
          `/api/transactions/${txnRef}/payments`,
          { mode: paymentMode, referenceNo: paymentRef, amount: Number(payable) },
          true,
        ),
      'Payment recorded.',
    )
  }

  const register = () =>
    guard(
      () => post(`/api/transactions/${encodeURIComponent(txnRef)}/registration`, {}, true),
      'Transaction registered.',
    )

  const validationMessages = ((txn.validation?.messages as Row[] | undefined) ?? []).map((m) => formatCell(m.message))

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
        {validationMessages.length > 0 ? (
          <ul className="validation">
            {validationMessages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        ) : null}
        <div className="actions">
          {txn.availableActions.map((a, i) => (
            <button key={i} onClick={() => void transition(formatCell(a.actionCode))}>
              {formatCell(a.actionCode)}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="1. Transaction details" actions={<button onClick={() => void saveDetails()}>Save</button>}>
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

      <Panel
        title="2. Parties"
        actions={
          <button className="primary" onClick={() => void saveParties()}>
            Save parties
          </button>
        }
      >
        {renderPartyGroup('SIDE_1', 'Seller')}
        {renderPartyGroup('SIDE_2', 'Buyer')}
        <DataTable
          rows={txn.parties}
          columns={[
            { key: 'id', label: 'Id' },
            { key: 'side', label: 'Side' },
            { key: 'role', label: 'Role' },
            { key: 'name', label: 'Name' },
            { key: 'aadhaar_last4', label: 'Aadhaar ••••' },
            { key: 'existing_share_pct', label: 'Existing %' },
            { key: 'resulting_share_pct', label: 'Resulting %' },
          ]}
          empty="No parties saved yet."
        />
      </Panel>

      <Panel title="3. Witnesses" actions={<button onClick={() => void saveWitnesses()}>Save witnesses</button>}>
        <div className="row">
          <Field label="Witness 1" value={witnessOne} onChange={setWitnessOne} required />
          <Field label="Witness 2" value={witnessTwo} onChange={setWitnessTwo} required />
        </div>
        <DataTable
          rows={txn.witnesses}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'id_proof_type', label: 'Id proof' },
          ]}
        />
      </Panel>

      <Panel
        title="4. Aadhaar consent"
        actions={<button onClick={() => void requestConsent()}>Request OTP for all parties</button>}
      >
        <p className="muted">Demo Aadhaar OTP: <code>654321</code>. Raw Aadhaar is never stored.</p>
        {txn.consents.map((c, i) => (
          <div className="row" key={i}>
            <span className="grow">
              Party #{formatCell(c.party_id)} — {formatCell(c.status)}
            </span>
            <Field
              label="OTP"
              value={otpByParty[formatCell(c.party_id)] ?? ''}
              onChange={(v) => setOtpByParty({ ...otpByParty, [formatCell(c.party_id)]: v })}
            />
            <button onClick={() => void verifyConsent(Number(c.party_id))}>Verify</button>
          </div>
        ))}
      </Panel>

      <Panel title="5. Rule checks" actions={<button onClick={() => void runRules()}>Run rule checks</button>}>
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

      <Panel title="6. Fees and payment" actions={<button onClick={() => void calculateFees()}>Calculate fee</button>}>
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
            disabled={txn.feeCalculation === null || paymentRef.length === 0}
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

      <Panel title="7. Registration" actions={<button className="primary" onClick={() => void register()}>Register</button>}>
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
    </>
  )
}

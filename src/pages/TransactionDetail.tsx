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
        registeredOwners: Array.isArray(result.registeredOwners) ? result.registeredOwners : [],
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

  const saveParties = () =>
    guard(
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
            <Field
              label="Name"
              value={party.name}
              required
              onChange={(v) => setParties(parties.map((p, i) => (i === index ? { ...p, name: v } : p)))}
            />
            <Field
              label="Aadhaar (12 digits)"
              value={party.aadhaarNumber}
              onChange={(v) => setParties(parties.map((p, i) => (i === index ? { ...p, aadhaarNumber: v } : p)))}
            />
            <Field
              label="PAN"
              value={party.pan}
              onChange={(v) => setParties(parties.map((p, i) => (i === index ? { ...p, pan: v } : p)))}
            />
            <Field
              label="Existing share %"
              value={party.existingSharePct}
              onChange={(v) => setParties(parties.map((p, i) => (i === index ? { ...p, existingSharePct: v } : p)))}
            />
            <Field
              label="Share transferred %"
              value={party.shareTransferredPct}
              onChange={(v) => setParties(parties.map((p, i) => (i === index ? { ...p, shareTransferredPct: v } : p)))}
            />
            <Field
              label="Resulting share %"
              value={party.resultingSharePct}
              onChange={(v) => setParties(parties.map((p, i) => (i === index ? { ...p, resultingSharePct: v } : p)))}
            />
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

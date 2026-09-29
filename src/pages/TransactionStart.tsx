import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { ApiError, get, post } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner, Field, Panel } from '../ui'
import TransactionDetail from './TransactionDetail'

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
  const [propertyId, setPropertyId] = useState('')
  const [property, setProperty] = useState<Row | null>(null)
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
  const [busy, setBusy] = useState(false)
  const [activeStage, setActiveStage] = useState(0)
  const [createdTransactionRef, setCreatedTransactionRef] = useState(() => searchParams.get('txnRef') ?? '')
  const selectedDeed = (bootstrap?.deedTypes ?? []).find((deed) => deed.code === deedTypeCode)
  const relationshipRequired = selectedDeed?.requires_relationship_category === true
  const stageComplete = (index: number) => {
    if (index === 0) return property !== null
    if (index === 1) return Boolean(deedTypeCode && transferScope)
    return false
  }

  const stageStatus = (index: number) => {
    if (index === 0) return property ? 'Complete' : activeStage === 0 ? 'In progress' : 'Required'
    if (index === 1) return stageComplete(index) ? 'Complete' : property ? activeStage === index ? 'In progress' : 'Required' : 'Waiting'
    return 'Available after draft'
  }

  const findProperty = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await get<Row>(`/api/properties/ref/${encodeURIComponent(propertyRef)}`)
      const id = result.id ?? result.property_id
      if (id === undefined) throw new Error('The property response did not include a property ID.')
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
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    setError('')
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
      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.set('txnRef', transactionRef)
      setSearchParams(nextSearchParams, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (createdTransactionRef.length > 0) {
    return (
      <TransactionDetail
        transactionRef={createdTransactionRef}
        initialWorkflowTab="txn-parties"
        pageTitle="Initiate Transaction"
      />
    )
  }

  return (
    <div className="intake-page">
      <div className="page-heading"><div><span className="eyebrow">Registration workspace</span><h1>Initiate Transaction</h1><p className="muted">Select a registered property and capture the transaction instruction. To add a property, use Mint Property.</p></div><span className="stage-label">Draft · Step {activeStage + 1} of {stages.length}</span></div>
      <Banner kind="error" message={error} />
      <div className="property-stage-layout">
        <aside className="property-stage-sidebar" aria-label="Transaction stages">
          <h2>Transaction stages</h2>
          <ol>
            {stages.map((stage, index) => (
              <li key={stage}>
                <button type="button" className={`property-stage-item${activeStage === index ? ' active' : ''}${stageComplete(index) ? ' completed' : ''}`} onClick={() => setActiveStage(index)} disabled={index > 1} aria-current={activeStage === index ? 'step' : undefined}>
                  <span className="property-stage-marker">{stageComplete(index) ? '✓' : index + 1}</span>
                  <span className="property-stage-copy"><strong>{stage}</strong><small>{stageStatus(index)}</small></span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <div className="property-stage-content">
          <div className="property-stage-tabs" role="tablist" aria-label="Transaction sections">
            {stages.map((stage, index) => (
              <button type="button" role="tab" id={`transaction-stage-tab-${index}`} aria-selected={activeStage === index} aria-controls={`transaction-stage-panel-${index}`} className={activeStage === index ? 'active' : ''} onClick={() => setActiveStage(index)} disabled={index > 1} key={stage}>{stage}</button>
            ))}
          </div>
          <div role="tabpanel" id={`transaction-stage-panel-${activeStage}`} aria-labelledby={`transaction-stage-tab-${activeStage}`}>
            {activeStage === 0 ? <Panel title="Select existing property" actions={<button className="outline" onClick={() => navigate('/properties/new')}>+ Mint Property</button>}>
              <div className="row"><Field label="Property reference" value={propertyRef} onChange={setPropertyRef} placeholder="PR-TN-CHN-000123" required /><button className="primary" disabled={busy || !propertyRef} onClick={() => void findProperty()}>{busy ? 'Checking…' : 'Find property'}</button></div>
              {property ? <div className="summary-strip"><span><strong>{String(property.property_ref ?? property.propertyRef ?? propertyRef)}</strong></span><span>{String(property.survey_no ?? property.surveyNo ?? 'Survey pending')}</span><span>{String(property.village_code ?? property.villageCode ?? '')}</span><button className="link" onClick={() => { setProperty(null); setPropertyId('') }}>Change</button></div> : <p className="helper">Property registration must be completed before a transaction can be initiated.</p>}
            </Panel> : null}
            {activeStage === 1 ? <Panel title="Transaction details" actions={<span className="stage-label">Required</span>}>
              <div className="form-grid three">
                <Field label="Deed type" value={deedTypeCode} onChange={(value) => {
                  setDeedTypeCode(value)
                  if (value === 'GIFT' || value === 'SETTLEMENT') {
                    setDeclaredConsideration('0')
                    setModeOfConsideration('')
                  }
                }} options={(bootstrap?.deedTypes ?? []).map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))} required />
                <Field label="Subtype" value={subtype} onChange={setSubtype} placeholder="Optional" />
                <Field label="Transfer scope" value={transferScope} onChange={setTransferScope} options={[{ value: 'FULL_PROPERTY', label: 'Full property' }, { value: 'UNDIVIDED_SHARE', label: 'Undivided share' }, { value: 'PHYSICAL_PARTIAL_EXTENT_SUBDIVISION', label: 'Partial extent / subdivision' }]} required />
                <Field label="Declared consideration" value={declaredConsideration} onChange={setDeclaredConsideration} type="number" />
                <Field label="Mode of consideration" value={modeOfConsideration} onChange={setModeOfConsideration} options={[{ value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'CASH', label: 'Cash' }, { value: 'MIXED', label: 'Mixed' }]} />
                <Field label="Relationship category" value={relationshipCategory} onChange={setRelationshipCategory} options={[{ value: 'FAMILY', label: 'Family' }, { value: 'NON_FAMILY', label: 'Non-family' }]} required={relationshipRequired} />
                <Field label="Basis of settlement" value={basisOfSettlement} onChange={setBasisOfSettlement} placeholder="Gift, family settlement, etc." />
                <Field label="Extent / share transferred" value={extentOrShareTransferred} onChange={setExtentOrShareTransferred} type="number" />
                <Field label="Extent unit" value={extentUnit} onChange={setExtentUnit} options={['SQ_FT', 'SQ_M', 'CENT', 'ACRE', 'PERCENT'].map((u) => ({ value: u, label: u }))} />
                <Field label="Guideline value" value={guidelineValue} onChange={setGuidelineValue} type="number" />
                <Field label="Guideline reference" value={guidelineValueReference} onChange={setGuidelineValueReference} />
                <Field label="Share being released" value={shareBeingReleased} onChange={setShareBeingReleased} type="number" />
                <Field label="Resulting subparcel count" value={resultingSubparcelCount} onChange={setResultingSubparcelCount} type="number" />
              </div>
            </Panel> : null}
          </div>
          <div className="property-stage-actions">
            <button type="button" onClick={() => setActiveStage((current) => Math.max(0, current - 1))} disabled={activeStage === 0}>Previous section</button>
            {activeStage === 0 ? <button type="button" className="primary" onClick={() => setActiveStage(1)}>Next section</button> : <button type="button" className="primary" disabled={busy || !propertyId || !deedTypeCode || !transferScope || (relationshipRequired && !relationshipCategory)} onClick={() => void create()}>{busy ? 'Creating…' : 'Create transaction'}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

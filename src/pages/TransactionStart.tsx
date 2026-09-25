import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, get, post } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner, Field, Panel } from '../ui'

export default function TransactionStart() {
  const navigate = useNavigate()
  const { bootstrap, user } = useAuth()
  const [propertyRef, setPropertyRef] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [property, setProperty] = useState<Row | null>(null)
  const [deedTypeCode, setDeedTypeCode] = useState('')
  const [subtype, setSubtype] = useState('')
  const [transferScope, setTransferScope] = useState('FULL_PROPERTY')
  const [declaredConsideration, setDeclaredConsideration] = useState('')
  const [modeOfConsideration, setModeOfConsideration] = useState('BANK_TRANSFER')
  const [extentOrShareTransferred, setExtentOrShareTransferred] = useState('')
  const [extentUnit, setExtentUnit] = useState('SQ_FT')
  const [guidelineValue, setGuidelineValue] = useState('')
  const [guidelineValueReference, setGuidelineValueReference] = useState('')
  const [basisOfSettlement, setBasisOfSettlement] = useState('')
  const [shareBeingReleased, setShareBeingReleased] = useState('')
  const [resultingSubparcelCount, setResultingSubparcelCount] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const findProperty = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await get<Row>(`/api/properties/ref/${encodeURIComponent(propertyRef)}`)
      const id = result.id ?? result.property_id
      if (id === undefined) throw new Error('The property response did not include a property ID.')
      setPropertyId(String(id))
      setProperty(result)
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
        stateCode: String(property?.stateCode ?? property?.state_code ?? 'TN'),
        propertyId: Number(propertyId), deedTypeCode, subtype: subtype || undefined,
        transferScope,
        sroCode: String(property?.sroCode ?? property?.sro_code ?? ''),
        declaredConsideration: declaredConsideration ? Number(declaredConsideration) : undefined,
        modeOfConsideration: declaredConsideration ? modeOfConsideration : undefined,
        extentOrShareTransferred: extentOrShareTransferred ? Number(extentOrShareTransferred) : undefined,
        extentUnit: extentOrShareTransferred ? extentUnit : undefined,
        guidelineValue: guidelineValue ? Number(guidelineValue) : undefined,
        guidelineValueReference: guidelineValueReference || undefined,
        basisOfSettlement: basisOfSettlement || undefined,
        shareBeingReleased: shareBeingReleased ? Number(shareBeingReleased) : undefined,
        resultingSubparcelCount: resultingSubparcelCount ? Number(resultingSubparcelCount) : undefined,
        initiatedBy: user?.id,
      }, true)
      navigate(`/transactions/${encodeURIComponent(String(created.txn_ref ?? created.id))}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="intake-page">
      <div className="page-heading"><div><span className="eyebrow">Registration workspace</span><h1>Initiate Transaction</h1><p className="muted">Select a registered property and capture the transaction instruction. To add a property, use Property Entry.</p></div></div>
      <Banner kind="error" message={error} />
      <Panel title="1. Select existing property" actions={<button className="outline" onClick={() => navigate('/properties/new')}>+ Property Entry</button>}>
        <div className="row"><Field label="Property reference" value={propertyRef} onChange={setPropertyRef} placeholder="PR-TN-CHN-000123" required /><button className="primary" disabled={busy || !propertyRef} onClick={() => void findProperty()}>{busy ? 'Checking…' : 'Find property'}</button></div>
        {property ? <div className="summary-strip"><span><strong>{String(property.property_ref ?? property.propertyRef ?? propertyRef)}</strong></span><span>{String(property.survey_no ?? property.surveyNo ?? 'Survey pending')}</span><span>{String(property.village_code ?? property.villageCode ?? '')}</span><button className="link" onClick={() => { setProperty(null); setPropertyId('') }}>Change</button></div> : <p className="helper">Property registration must be completed before a transaction can be initiated.</p>}
      </Panel>
      <Panel title="2. Transaction instruction" actions={<span className="stage-label">TransactionDTO</span>}>
        <div className="form-grid three">
          <Field label="Deed type" value={deedTypeCode} onChange={setDeedTypeCode} options={(bootstrap?.deedTypes ?? []).map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))} required />
          <Field label="Subtype" value={subtype} onChange={setSubtype} placeholder="Optional" />
          <Field label="Transfer scope" value={transferScope} onChange={setTransferScope} options={[{ value: 'FULL_PROPERTY', label: 'Full property' }, { value: 'UNDIVIDED_SHARE', label: 'Undivided share' }, { value: 'PHYSICAL_PARTIAL_EXTENT_SUBDIVISION', label: 'Partial extent / subdivision' }]} required />
          <Field label="Declared consideration" value={declaredConsideration} onChange={setDeclaredConsideration} type="number" />
          <Field label="Mode of consideration" value={modeOfConsideration} onChange={setModeOfConsideration} options={[{ value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'CASH', label: 'Cash' }, { value: 'MIXED', label: 'Mixed' }]} />
          <Field label="Extent / share transferred" value={extentOrShareTransferred} onChange={setExtentOrShareTransferred} type="number" />
          <Field label="Extent unit" value={extentUnit} onChange={setExtentUnit} options={['SQ_FT', 'SQ_M', 'CENT', 'ACRE', 'PERCENT'].map((u) => ({ value: u, label: u }))} />
          <Field label="Guideline value" value={guidelineValue} onChange={setGuidelineValue} type="number" />
          <Field label="Guideline reference" value={guidelineValueReference} onChange={setGuidelineValueReference} />
          <Field label="Basis of settlement" value={basisOfSettlement} onChange={setBasisOfSettlement} placeholder="Gift, family settlement, etc." />
          <Field label="Share being released" value={shareBeingReleased} onChange={setShareBeingReleased} type="number" />
          <Field label="Resulting subparcel count" value={resultingSubparcelCount} onChange={setResultingSubparcelCount} type="number" />
        </div>
        <div className="next-step"><span><strong>Next:</strong> parties, witnesses, consent, rule checks, fees and registration.</span><button className="primary" disabled={busy || !propertyId || !deedTypeCode || !transferScope} onClick={() => void create()}>{busy ? 'Creating…' : 'Create transaction'}</button></div>
      </Panel>
    </div>
  )
}

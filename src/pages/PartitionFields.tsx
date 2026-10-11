import { useCallback, useEffect, useState } from 'react'
import { api, get, put } from '../api'
import type { Row } from '../types'
import { Banner, DataTable, Field } from '../ui'

/** Partition-only: owner status, deceased owners' legal-heir branches, participating parties and schedules. */

interface HeirForm {
  name: string
  relationship: string
  status: string
  maritalStatus: string
  dateOfDeath: string
  certificateNo: string
  certificateDate: string
  certificateDocumentId: string
  certificateFileName: string
  successorsAvailable: string
  successors: HeirForm[]
  aadhaarNumber: string
  mobile: string
  address: string
  pan: string
}

interface OwnerForm {
  propertyOwnerId: number
  name: string
  status: string
  dateOfDeath: string
  certificateNo: string
  certificateDate: string
  certificateDocumentId: string
  certificateFileName: string
  lhcAvailable: string
  lhcNo: string
  lhcDate: string
  lhcDocumentId: string
  lhcFileName: string
  heirs: HeirForm[]
}

interface ScheduleLine {
  parcelKey: string
  extent: string
  extentUnit: string
  value: string
}

interface PartitionScheduleForm {
  label: string
  allottedRefs: string[]
  value: string
  northBoundary: string
  southBoundary: string
  eastBoundary: string
  westBoundary: string
  remarks: string
  surveys: ScheduleLine[]
}

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))
const money = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
const statusOptions = [
  { value: 'LIVING', label: 'Living' },
  { value: 'DECEASED', label: 'Deceased' },
]
const yesNo = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
]
const maritalOptions = ['Married', 'Unmarried', 'Widowed', 'Divorced'].map((v) => ({ value: v.toUpperCase(), label: v }))
const unitOptions = ['SQ_FT', 'SQ_M', 'CENT', 'ACRE', 'HECTARE'].map((v) => ({ value: v, label: v.replace('_', '.') }))

const emptyHeir = (): HeirForm => ({
  name: '', relationship: '', status: '', maritalStatus: '', dateOfDeath: '', certificateNo: '', certificateDate: '',
  certificateDocumentId: '', certificateFileName: '', successorsAvailable: '', successors: [], aadhaarNumber: '',
  mobile: '', address: '', pan: '',
})

const emptySchedule = (index: number): PartitionScheduleForm => ({
  label: `Schedule ${String.fromCharCode(65 + (index % 26))}`,
  allottedRefs: [],
  value: '',
  northBoundary: '', southBoundary: '', eastBoundary: '', westBoundary: '', remarks: '',
  surveys: [],
})

const parcelKey = (row: Row) => `${text(row.survey_no)}|${text(row.subdivision_no)}`

const heirsFrom = (members: Row[], parentId: unknown): HeirForm[] =>
  members.filter((m) => m.parent_member_id === parentId).map((m) => ({
    name: text(m.name),
    relationship: text(m.relationship),
    status: text(m.living_status),
    maritalStatus: text(m.marital_status),
    dateOfDeath: text(m.date_of_death),
    certificateNo: text(m.death_cert_no),
    certificateDate: text(m.death_cert_date),
    certificateDocumentId: text(m.death_cert_document_id),
    certificateFileName: text(m.death_cert_file_name),
    successorsAvailable: m.successors_available === true ? 'YES' : m.successors_available === false ? 'NO' : '',
    successors: heirsFrom(members, m.id),
    aadhaarNumber: '',
    mobile: text(m.mobile),
    address: text(m.address),
    pan: text(m.pan),
  }))

const ownersFrom = (data: Row): OwnerForm[] => {
  const members = (data.members as Row[] | undefined) ?? []
  return ((data.owners as Row[] | undefined) ?? []).map((owner) => {
    const m = members.find((item) => item.member_type === 'OWNER' && item.property_owner_id === owner.id)
    return {
      propertyOwnerId: Number(owner.id),
      name: text(owner.owner_name),
      status: text(m?.living_status),
      dateOfDeath: text(m?.date_of_death),
      certificateNo: text(m?.death_cert_no),
      certificateDate: text(m?.death_cert_date),
      certificateDocumentId: text(m?.death_cert_document_id),
      certificateFileName: text(m?.death_cert_file_name),
      lhcAvailable: m?.legal_heir_cert_available === true ? 'YES' : m?.legal_heir_cert_available === false ? 'NO' : '',
      lhcNo: text(m?.legal_heir_cert_no),
      lhcDate: text(m?.legal_heir_cert_date),
      lhcDocumentId: text(m?.legal_heir_document_id),
      lhcFileName: text(m?.legal_heir_file_name),
      heirs: m === undefined ? [] : heirsFrom(members, m.id),
    }
  })
}

const schedulesFrom = (data: Row): PartitionScheduleForm[] =>
  ((data.schedules as Row[] | undefined) ?? []).map((s) => ({
    label: text(s.label),
    allottedRefs: ((s.allotted_member_refs as unknown[] | undefined) ?? []).map(String),
    value: text(s.manual_value),
    northBoundary: text(s.north_boundary),
    southBoundary: text(s.south_boundary),
    eastBoundary: text(s.east_boundary),
    westBoundary: text(s.west_boundary),
    remarks: text(s.remarks),
    surveys: ((s.surveys as Row[] | undefined) ?? []).map((line) => ({
      parcelKey: parcelKey(line),
      extent: text(line.extent_allotted),
      extentUnit: text(line.extent_unit),
      value: text(line.value),
    })),
  }))

const death = (form: { dateOfDeath: string; certificateNo: string; certificateDate: string; certificateDocumentId: string }) => ({
  dateOfDeath: form.dateOfDeath || undefined,
  certificateNo: form.certificateNo || undefined,
  certificateDate: form.certificateDate || undefined,
  certificateDocumentId: form.certificateDocumentId ? Number(form.certificateDocumentId) : undefined,
})

const heirPayload = (heir: HeirForm): Row => ({
  name: heir.name,
  relationship: heir.relationship,
  status: heir.status,
  maritalStatus: heir.maritalStatus || undefined,
  death: heir.status === 'DECEASED' ? death(heir) : undefined,
  successorsAvailable: heir.status === 'DECEASED' && heir.successorsAvailable ? heir.successorsAvailable === 'YES' : undefined,
  successors: heir.status === 'DECEASED' && heir.successorsAvailable === 'YES' ? heir.successors.map(heirPayload) : [],
  aadhaarNumber: heir.status === 'LIVING' ? heir.aadhaarNumber.replace(/\s/g, '') : undefined,
  mobile: heir.mobile || undefined,
  address: heir.address || undefined,
  pan: heir.status === 'LIVING' ? heir.pan.trim().toUpperCase() || undefined : undefined,
})

const lineTotal = (schedule: PartitionScheduleForm) => {
  const entered = schedule.surveys.filter((line) => line.value.trim().length > 0)
  if (entered.length > 0) return entered.reduce((sum, line) => sum + Number(line.value), 0)
  return schedule.value.trim().length > 0 ? Number(schedule.value) : 0
}

function CertificateUpload({
  txnRef,
  documentType,
  fileName,
  readOnly,
  onUploaded,
}: {
  txnRef: string
  documentType: string
  fileName: string
  readOnly: boolean
  onUploaded: (documentId: string, fileName: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const upload = async (file: File | undefined) => {
    if (file === undefined) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('documentType', documentType)
      const saved = await api<Row>('POST', `/api/transactions/${encodeURIComponent(txnRef)}/partition/documents`, form)
      onUploaded(text(saved.documentId), text(saved.fileName))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <label className="field">
      <span>Certificate upload</span>
      {readOnly ? null : (
        <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
      )}
      <small className="helper">{busy ? 'Uploading…' : fileName ? `Uploaded: ${fileName}` : 'PDF / JPG / PNG, max 5 MB'}</small>
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  )
}

function DeathFields<T extends { dateOfDeath: string; certificateNo: string; certificateDate: string; certificateFileName: string }>({
  txnRef,
  form,
  onChange,
  readOnly,
}: {
  txnRef: string
  form: T
  onChange: (patch: Partial<T> & { certificateDocumentId?: string }) => void
  readOnly: boolean
}) {
  return (
    <div className="form-grid three">
      <Field label="Date of death" type="date" value={form.dateOfDeath} onChange={(v) => onChange({ dateOfDeath: v } as Partial<T>)} readOnly={readOnly} required />
      <Field label="Death certificate no." value={form.certificateNo} onChange={(v) => onChange({ certificateNo: v } as Partial<T>)} readOnly={readOnly} required />
      <Field label="Death certificate date" type="date" value={form.certificateDate} onChange={(v) => onChange({ certificateDate: v } as Partial<T>)} readOnly={readOnly} required />
      <CertificateUpload
        txnRef={txnRef}
        documentType="DEATH_CERTIFICATE"
        fileName={form.certificateFileName}
        readOnly={readOnly}
        onUploaded={(id, name) => onChange({ certificateDocumentId: id, certificateFileName: name } as Partial<T> & { certificateDocumentId: string })}
      />
    </div>
  )
}

function HeirTable({
  txnRef,
  heirs,
  onChange,
  readOnly,
  title,
  depth,
}: {
  txnRef: string
  heirs: HeirForm[]
  onChange: (change: (heirs: HeirForm[]) => HeirForm[]) => void
  readOnly: boolean
  title: string
  depth: number
}) {
  const update = (index: number, patch: Partial<HeirForm>) =>
    onChange((current) => current.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  return (
    <div className={depth > 0 ? 'partition-heirs nested' : 'partition-heirs'}>
      <div className="section-heading">
        <h4>{title}</h4>
        {readOnly ? null : (
          <button type="button" className="outline" onClick={() => onChange((current) => [...current, emptyHeir()])}>
            <span aria-hidden="true">+</span> Add {depth === 0 ? 'legal heir' : 'successor'}
          </button>
        )}
      </div>
      {heirs.length === 0 ? <p className="helper">No {title.toLowerCase()} added yet.</p> : null}
      {heirs.map((heir, index) => (
        <div className="partition-card" key={index}>
          <div className="section-heading">
            <h5>{depth === 0 ? 'Legal heir' : 'Successor'} {index + 1}{heir.name ? ` · ${heir.name}` : ''}</h5>
            {readOnly ? null : (
              <button type="button" className="outline" onClick={() => onChange((current) => current.filter((_, i) => i !== index))}>
                Remove
              </button>
            )}
          </div>
          <div className="form-grid three">
            <Field label="Name" value={heir.name} onChange={(v) => update(index, { name: v })} readOnly={readOnly} required />
            <Field label="Relationship" value={heir.relationship} onChange={(v) => update(index, { relationship: v })} readOnly={readOnly} required />
            <Field label="Living / Deceased" value={heir.status} options={statusOptions} onChange={(v) => update(index, { status: v })} readOnly={readOnly} required />
            {depth === 0 ? (
              <Field label="Marital status" value={heir.maritalStatus} options={maritalOptions} onChange={(v) => update(index, { maritalStatus: v })} readOnly={readOnly} />
            ) : null}
            {heir.status === 'LIVING' ? (
              <>
                <Field
                  label="Aadhaar number"
                  value={heir.aadhaarNumber}
                  placeholder={readOnly ? 'Recorded' : '12 digits (re-enter to save changes)'}
                  onChange={(v) => update(index, { aadhaarNumber: v })}
                  readOnly={readOnly}
                  required
                />
                <Field label="Mobile" value={heir.mobile} onChange={(v) => update(index, { mobile: v })} readOnly={readOnly} required />
                <Field label="PAN" value={heir.pan} onChange={(v) => update(index, { pan: v })} readOnly={readOnly} required />
                <Field label="Address" value={heir.address} onChange={(v) => update(index, { address: v })} readOnly={readOnly} required />
              </>
            ) : null}
          </div>
          {heir.status === 'DECEASED' ? (
            <>
              <DeathFields txnRef={txnRef} form={heir} onChange={(patch) => update(index, patch)} readOnly={readOnly} />
              <div className="form-grid three">
                <Field
                  label="Successor / legal heirs available?"
                  value={heir.successorsAvailable}
                  options={yesNo}
                  onChange={(v) => update(index, v === 'YES' && heir.successors.length === 0 ? { successorsAvailable: v, successors: [emptyHeir()] } : { successorsAvailable: v })}
                  readOnly={readOnly}
                  required
                />
              </div>
              {heir.successorsAvailable === 'YES' ? (
                <HeirTable
                  txnRef={txnRef}
                  heirs={heir.successors}
                  onChange={(change) => onChange((current) => current.map((h, i) => (i === index ? { ...h, successors: change(h.successors) } : h)))}
                  readOnly={readOnly}
                  title={`Successor heirs of ${heir.name || 'this heir'}`}
                  depth={depth + 1}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function PartitionWorkspace({
  txnRef,
  partiesReadOnly,
  schedulesReadOnly,
  onSaved,
  schedulesOnly = false,
}: {
  txnRef: string
  partiesReadOnly: boolean
  schedulesReadOnly: boolean
  onSaved?: () => void
  schedulesOnly?: boolean
}) {
  const [data, setData] = useState<Row | null>(null)
  const [owners, setOwners] = useState<OwnerForm[]>([])
  const [schedules, setSchedules] = useState<PartitionScheduleForm[]>([])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const apply = useCallback((next: Row) => {
    setData(next)
    setOwners(ownersFrom(next))
    const saved = schedulesFrom(next)
    setSchedules(saved.length > 0 ? saved : [emptySchedule(0), emptySchedule(1)])
  }, [])

  useEffect(() => {
    get<Row>(`/api/transactions/${encodeURIComponent(txnRef)}/partition`)
      .then(apply)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [txnRef, apply])

  if (data === null) return error ? <Banner kind="error" message={error} /> : <p className="helper">Loading partition details…</p>

  const parcels = (data.parcels as Row[] | undefined) ?? []
  const participants = (data.participants as Row[] | undefined) ?? []
  const singleLivingOwner = owners.length === 1 && owners[0].status === 'LIVING'
  const blockedByCertificate = owners.some((o) => o.status === 'DECEASED' && o.lhcAvailable === 'NO')
  const updateOwner = (index: number, patch: Partial<OwnerForm>) =>
    setOwners((current) => current.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  const missingHeirs = (heirs: HeirForm[]): string[] => heirs.flatMap((h) => {
    if (h.status !== 'DECEASED' || h.successorsAvailable !== 'YES') return []
    return h.successors.length === 0 ? [`successors of ${h.name || 'a deceased heir'}`] : missingHeirs(h.successors)
  })
  const heirsMissing = owners.flatMap((o) => {
    if (o.status !== 'DECEASED' || o.lhcAvailable !== 'YES') return []
    return o.heirs.length === 0 ? [`legal heirs of ${o.name}`] : missingHeirs(o.heirs)
  })

  const saveMembers = async () => {
    if (heirsMissing.length > 0) {
      setInfo('')
      setError(`Add the ${heirsMissing.join(', ')} before saving.`)
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const next = await put<Row>(`/api/transactions/${encodeURIComponent(txnRef)}/partition/members`, {
        owners: owners.map((o) => ({
          propertyOwnerId: o.propertyOwnerId,
          status: o.status,
          death: o.status === 'DECEASED' ? death(o) : undefined,
          legalHeirCertificate: o.status === 'DECEASED' ? {
            available: o.lhcAvailable === 'YES',
            certificateNo: o.lhcNo || undefined,
            issueDate: o.lhcDate || undefined,
            documentId: o.lhcDocumentId ? Number(o.lhcDocumentId) : undefined,
          } : undefined,
          heirs: o.status === 'DECEASED' ? o.heirs.map(heirPayload) : [],
        })),
      })
      apply(next)
      setInfo('Partition parties saved.')
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const saveSchedules = async () => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const byKey = new Map(parcels.map((p) => [parcelKey(p), p]))
      const next = await put<Row>(`/api/transactions/${encodeURIComponent(txnRef)}/partition/schedules`, schedules.map((s) => ({
        label: s.label.trim(),
        allottedRefs: s.allottedRefs,
        value: s.value.trim() ? Number(s.value) : undefined,
        northBoundary: s.northBoundary, southBoundary: s.southBoundary, eastBoundary: s.eastBoundary, westBoundary: s.westBoundary,
        remarks: s.remarks,
        surveys: s.surveys.map((line) => {
          const parcel = byKey.get(line.parcelKey)
          return {
            surveyNo: text(parcel?.survey_no ?? line.parcelKey.split('|')[0]),
            subdivisionNo: text(parcel?.subdivision_no) || undefined,
            extent: line.extent.trim() ? Number(line.extent) : undefined,
            extentUnit: line.extentUnit || text(parcel?.extent_unit),
            value: line.value.trim() ? Number(line.value) : undefined,
          }
        }),
      })))
      apply(next)
      setInfo('Partition schedules saved. Fees are calculated from the total of the schedule values.')
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const updateSchedule = (index: number, patch: Partial<PartitionScheduleForm>) =>
    setSchedules(schedules.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  const updateLine = (index: number, lineIndex: number, patch: Partial<ScheduleLine>) =>
    updateSchedule(index, { surveys: schedules[index].surveys.map((l, i) => (i === lineIndex ? { ...l, ...patch } : l)) })
  const grandTotal = schedules.reduce((sum, s) => sum + lineTotal(s), 0)
  const allottedBySurvey = new Map<string, number>()
  schedules.forEach((s) => s.surveys.forEach((l) => {
    if (l.extent.trim()) allottedBySurvey.set(l.parcelKey, (allottedBySurvey.get(l.parcelKey) ?? 0) + Number(l.extent))
  }))

  return (
    <div className="partition-workspace">
      {error ? <Banner kind="error" message={error} /> : null}
      {info ? <Banner kind="success" message={info} /> : null}

      <section className="form-section">
        <h3>Land parcels</h3>
        <p className="helper">ULPINs are shown as already issued; SLATE does not generate them. New subdivision numbers are created only after Survey.</p>
        <div className="ad-table-scroll">
          <DataTable
            rows={parcels.map((p) => ({ ...p, allotted: allottedBySurvey.get(parcelKey(p)) ?? 0 }))}
            columns={[
              { key: 'survey_no', label: 'Survey No.' },
              { key: 'subdivision_no', label: 'Existing Subdivision No.' },
              { key: 'ulpin', label: 'ULPIN' },
              { key: 'extent_value', label: 'Extent' },
              { key: 'extent_unit', label: 'Unit' },
              { key: 'allotted', label: 'Allotted in schedules', render: (row) => text(row.allotted) },
            ]}
            empty="The property has no survey numbers."
          />
        </div>
      </section>

      {schedulesOnly ? null : (<>
      <section className="form-section">
        <h3>Current owners</h3>
        <p className="helper">
          {owners.length === 1 ? 'Single owner: Partition applies only if the owner is deceased.' : 'Multiple co-owners: Partition among the existing co-owners.'}
          {' '}Ownership shares are never calculated; allocation is captured only through the schedules.
        </p>
        {owners.map((owner, index) => (
          <div className="partition-card" key={owner.propertyOwnerId}>
            <div className="section-heading">
              <h4>Owner {index + 1} · {owner.name}</h4>
              {owner.status ? <span className={owner.status === 'DECEASED' ? 'partition-tag deceased' : 'partition-tag'}>{owner.status === 'DECEASED' ? 'Deceased' : 'Living'}</span> : null}
            </div>
            <div className="form-grid three">
              <Field label="Owner name" value={owner.name} onChange={() => undefined} readOnly />
              <Field
                label={owners.length === 1 ? 'Is the current owner deceased?' : 'Living / Deceased'}
                value={owners.length === 1 ? (owner.status === 'DECEASED' ? 'YES' : owner.status === 'LIVING' ? 'NO' : '') : owner.status}
                options={owners.length === 1 ? yesNo : statusOptions}
                onChange={(v) => updateOwner(index, { status: owners.length === 1 ? (v === 'YES' ? 'DECEASED' : v === 'NO' ? 'LIVING' : '') : v })}
                readOnly={partiesReadOnly}
                required
              />
            </div>
            {owner.status === 'DECEASED' ? (
              <>
                <h5>Deceased owner details</h5>
                <DeathFields txnRef={txnRef} form={owner} onChange={(patch) => updateOwner(index, patch)} readOnly={partiesReadOnly} />
                <div className="form-grid three">
                  <Field label="Legal heir certificate available?" value={owner.lhcAvailable} options={yesNo} onChange={(v) => updateOwner(index, v === 'YES' && owner.heirs.length === 0 ? { lhcAvailable: v, heirs: [emptyHeir()] } : { lhcAvailable: v })} readOnly={partiesReadOnly} required />
                  {owner.lhcAvailable === 'YES' ? (
                    <>
                      <Field label="Legal heir certificate no." value={owner.lhcNo} onChange={(v) => updateOwner(index, { lhcNo: v })} readOnly={partiesReadOnly} required />
                      <Field label="Issue date" type="date" value={owner.lhcDate} onChange={(v) => updateOwner(index, { lhcDate: v })} readOnly={partiesReadOnly} required />
                      <CertificateUpload
                        txnRef={txnRef}
                        documentType="LEGAL_HEIR_CERTIFICATE"
                        fileName={owner.lhcFileName}
                        readOnly={partiesReadOnly}
                        onUploaded={(id, name) => updateOwner(index, { lhcDocumentId: id, lhcFileName: name })}
                      />
                    </>
                  ) : null}
                </div>
                {owner.lhcAvailable === 'NO' ? <Banner kind="error" message="Without a legal heir certificate the transaction cannot proceed further." /> : null}
                {owner.lhcAvailable === 'YES' ? (
                  <HeirTable
                    txnRef={txnRef}
                    heirs={owner.heirs}
                    onChange={(change) => setOwners((current) => current.map((o, i) => (i === index ? { ...o, heirs: change(o.heirs) } : o)))}
                    readOnly={partiesReadOnly}
                    title={`Legal heirs of ${owner.name}`}
                    depth={0}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ))}
        {singleLivingOwner ? <Banner kind="error" message="Partition not applicable: the only current owner is living." /> : null}
        {partiesReadOnly ? null : (
          <div className="form-submit-row">
            <button type="button" className="primary" disabled={busy || singleLivingOwner || blockedByCertificate} onClick={() => void saveMembers()}>
              {busy ? 'Saving…' : 'Save partition parties'}
            </button>
          </div>
        )}
      </section>

      <section className="form-section">
        <h3>Participating parties</h3>
        <p className="helper">Living co-owners and living legal heirs. Only these parties give Aadhaar OTP consent.</p>
        <DataTable
          rows={participants}
          columns={[
            { key: 'memberRef', label: 'Party ref' },
            { key: 'name', label: 'Name' },
            { key: 'relationship', label: 'Relationship' },
            { key: 'sourceBranch', label: 'Source owner / branch' },
            { key: 'lineage', label: 'Lineage' },
          ]}
          empty="Save the partition parties to see who participates."
        />
      </section>
      </>)}

      <section className="form-section">
        <div className="section-heading">
          <h3>Partition schedules</h3>
          {schedulesReadOnly ? null : (
            <button type="button" className="outline" onClick={() => setSchedules([...schedules, emptySchedule(schedules.length)])}>
              <span aria-hidden="true">+</span> Add schedule
            </button>
          )}
        </div>
        <p className="helper">
          Allot each schedule to one or more participating parties. Values are entered from the registered partition details; SLATE totals them and does not calculate ownership percentages.
        </p>
        {schedules.map((schedule, index) => (
          <div className="partition-card" key={index}>
            <div className="section-heading">
              <h4>{schedule.label || `Schedule ${index + 1}`}</h4>
              {schedulesReadOnly ? null : (
                <button type="button" className="outline" onClick={() => setSchedules(schedules.filter((_, i) => i !== index))}>
                  Remove schedule
                </button>
              )}
            </div>
            <div className="form-grid three">
              <Field label="Schedule name" value={schedule.label} onChange={(v) => updateSchedule(index, { label: v })} readOnly={schedulesReadOnly} required />
              <Field
                label="Schedule value (₹)"
                type="number"
                value={schedule.surveys.some((l) => l.value.trim()) ? String(lineTotal(schedule)) : schedule.value}
                onChange={(v) => updateSchedule(index, { value: v })}
                readOnly={schedulesReadOnly || schedule.surveys.some((l) => l.value.trim().length > 0)}
                required
              />
              <label className="field">
                <span>Allotted person(s)<b className="req"> *</b></span>
                <div className="partition-allottees">
                  {participants.map((p) => {
                    const ref = text(p.memberRef)
                    return (
                      <label key={ref} className={schedule.allottedRefs.includes(ref) ? 'selected' : undefined}>
                        <input
                          type="checkbox"
                          disabled={schedulesReadOnly}
                          checked={schedule.allottedRefs.includes(ref)}
                          onChange={(e) => updateSchedule(index, {
                            allottedRefs: e.target.checked ? [...schedule.allottedRefs, ref] : schedule.allottedRefs.filter((r) => r !== ref),
                          })}
                        />
                        <span>{text(p.name)}<small>{text(p.sourceBranch)}</small></span>
                      </label>
                    )
                  })}
                  {participants.length === 0 ? <small className="helper">Save the partition parties first.</small> : null}
                </div>
              </label>
            </div>
            <div className="section-heading">
              <h5>Survey numbers</h5>
              {schedulesReadOnly ? null : (
                <button type="button" className="outline" onClick={() => updateSchedule(index, { surveys: [...schedule.surveys, { parcelKey: '', extent: '', extentUnit: '', value: '' }] })}>
                  <span aria-hidden="true">+</span> Add survey number
                </button>
              )}
            </div>
            {schedule.surveys.length === 0 ? <p className="helper">No survey numbers added yet.</p> : null}
            {schedule.surveys.map((line, lineIndex) => {
              const parcel = parcels.find((p) => parcelKey(p) === line.parcelKey)
              return (
                <div className="partition-survey-line" key={lineIndex}>
                  <Field
                    label="Survey no. / existing subdivision"
                    value={line.parcelKey}
                    options={parcels.map((p) => ({ value: parcelKey(p), label: `${text(p.survey_no)}${p.subdivision_no ? `/${text(p.subdivision_no)}` : ''}` }))}
                    onChange={(v) => updateLine(index, lineIndex, { parcelKey: v, extentUnit: line.extentUnit || text(parcels.find((p) => parcelKey(p) === v)?.extent_unit) })}
                    readOnly={schedulesReadOnly}
                    required
                  />
                  <Field label="ULPIN" value={text(parcel?.ulpin) || '—'} onChange={() => undefined} readOnly />
                  <Field label="Extent allotted" type="number" value={line.extent} onChange={(v) => updateLine(index, lineIndex, { extent: v })} readOnly={schedulesReadOnly} required />
                  <Field label="Unit" value={line.extentUnit} options={unitOptions} onChange={(v) => updateLine(index, lineIndex, { extentUnit: v })} readOnly={schedulesReadOnly} required />
                  <Field label="Value (₹)" type="number" value={line.value} onChange={(v) => updateLine(index, lineIndex, { value: v })} readOnly={schedulesReadOnly} />
                  {schedulesReadOnly ? null : (
                    <button type="button" className="outline" onClick={() => updateSchedule(index, { surveys: schedule.surveys.filter((_, i) => i !== lineIndex) })}>
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
            <h5>Boundaries</h5>
            <div className="form-grid four">
              <Field label="North boundary" value={schedule.northBoundary} onChange={(v) => updateSchedule(index, { northBoundary: v })} readOnly={schedulesReadOnly} />
              <Field label="South boundary" value={schedule.southBoundary} onChange={(v) => updateSchedule(index, { southBoundary: v })} readOnly={schedulesReadOnly} />
              <Field label="East boundary" value={schedule.eastBoundary} onChange={(v) => updateSchedule(index, { eastBoundary: v })} readOnly={schedulesReadOnly} />
              <Field label="West boundary" value={schedule.westBoundary} onChange={(v) => updateSchedule(index, { westBoundary: v })} readOnly={schedulesReadOnly} />
            </div>
            <div className="form-grid two">
              <Field label="Remarks" value={schedule.remarks} onChange={(v) => updateSchedule(index, { remarks: v })} readOnly={schedulesReadOnly} />
            </div>
            <div className="partition-total">
              Total value of {schedule.label || 'this schedule'} <b>₹{money(lineTotal(schedule))}</b>
            </div>
          </div>
        ))}
        {schedules.length > 0 ? (
          <div className="ad-table-scroll">
            <DataTable
              rows={[
                ...schedules.map((s, i) => ({ schedule: s.label || `Schedule ${i + 1}`, value: `₹${money(lineTotal(s))}` })),
                { schedule: 'Total Partition Value', value: `₹${money(grandTotal)}` },
              ]}
              columns={[
                { key: 'schedule', label: 'Schedule' },
                { key: 'value', label: 'Schedule value' },
              ]}
            />
          </div>
        ) : null}
        {schedulesReadOnly ? null : (
          <div className="form-submit-row">
            <button type="button" className="primary" disabled={busy || participants.length === 0} onClick={() => void saveSchedules()}>
              {busy ? 'Saving…' : 'Save schedules'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

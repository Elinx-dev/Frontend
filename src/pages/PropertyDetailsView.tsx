import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth'
import { str, type Row } from '../types'
import { DataTable, StatusPill, formatCell } from '../ui'
import PropertyMap from './PropertyMap'
import RecordTimeline from './RecordTimeline'
import { RevealPii } from './RevealPii'
import TokenLedgerPanel from './TokenLedgerPanel'
import { jurisdictionOptions, labelFor, maskAadhaar, optionsFrom, ownerTypes, usePropertyMap } from './propertyShared'

type Tab = 'property' | 'owners' | 'location' | 'survey' | 'title' | 'transactions' | 'timeline' | 'blockchain'

const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const text = (value: unknown) => formatCell(value == null || value === '' ? null : value)

function Fact({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="vao-fact">
      <span>{label}</span>
      <strong className={mono ? 'mono' : undefined}>{text(value)}</strong>
    </div>
  )
}

/**
 * One Property Details layout for every portal (Registration, VAO, Surveyor, Tahsildar and the public
 * Citizen view). The public view gets no personal data and no internal tabs.
 */
export default function PropertyDetailsView({ property, lineage = null, publicView = false, backTo, backLabel = '← Back', actions, history = [] }: {
  property: Row
  lineage?: Row | null
  publicView?: boolean
  backTo?: string
  backLabel?: string
  actions?: ReactNode
  history?: Row[]
}) {
  const navigate = useNavigate()
  const { bootstrap } = useAuth()
  const [tab, setTab] = useState<Tab>('property')
  const option = (set: string, code: unknown) => (code == null || code === '' ? null : labelFor(optionsFrom(bootstrap, set), String(code)))

  const jurisdictions = bootstrap?.jurisdictions ?? []
  const name = (key: string, label: string, code: unknown) =>
    code == null || code === '' ? null : labelFor(jurisdictionOptions(jurisdictions, key, label, []), String(code))
  const districtName = name('district_code', 'district_name', property.district_code)
  const talukName = name('taluk_code', 'taluk_name', property.taluk_code)
  const villageName = name('village_code', 'village_name', property.village_code)
  const { mapLocation, mapLocationName, mapStatus } = usePropertyMap({
    doorNo: str(property, 'door_no'), street: str(property, 'street'), village: villageName ?? '', taluk: talukName ?? '', district: districtName ?? '',
  })

  const owners = rowsOf(property.registeredOwners)
  const surveys = rowsOf(property.surveyRecords)
  const measurements = rowsOf(property.boundaryMeasurements)
  const chain = rowsOf(property.chainOfTitle)
  const transactions = rowsOf(property.transactions)
  const lineageNodes = rowsOf(lineage?.nodes).filter((node) => node.relation !== 'SELF')
  const extent = (value: unknown, unit: unknown) => (value == null ? null : `${formatCell(value)} ${option('EXTENT_UNIT', unit) ?? formatCell(unit ?? null)}`)
  const rupees = (value: unknown) => (value == null || value === '' ? null : `₹ ${Number(value).toLocaleString('en-IN')}`)
  const status = String(property.status ?? '')
  const ownerType = ownerTypes.find((type) => type.value === (str(property, 'owner_type_code') || str(owners[0], 'owner_type_code')))?.label

  const tabs: [Tab, string][] = publicView
    ? [['property', 'Property Details'], ['owners', 'Owners'], ['location', 'Location'], ['blockchain', 'Blockchain']]
    : [['property', 'Property Details'], ['owners', 'Owners'], ['location', 'Location'], ['survey', 'Survey & Boundaries'],
        ['title', 'Chain of Title'], ['transactions', 'Transactions'], ['timeline', 'Timeline'], ['blockchain', 'Blockchain']]

  return (
    <div className="vao-page property-details-view">
      <div className="vao-detail-card">
        <div className="vao-detail-head">
          {backTo ? <Link className="vao-back" to={backTo}>{backLabel}</Link> : <button type="button" className="vao-back" onClick={() => navigate(-1)}>{backLabel}</button>}
          <strong className="mono">{text(property.property_ref)}</strong>
          <span className="vao-detail-parties">{owners.map((owner) => String(owner.owner_name ?? '')).filter(Boolean).join(', ') || '—'}</span>
          <span className="vao-detail-spacer" />
          {status ? <StatusPill status={status} /> : null}
          {actions}
        </div>
        <div className="vao-detail-meta">
          <span>Type: <b>{text(option('PROPERTY_TYPE', property.property_type_code))}</b></span>
          <span>Land type: <b>{text(option('LAND_TYPE', property.land_type_code))}</b></span>
          <span>Extent: <b>{text(extent(property.extent_value, property.extent_unit))}</b></span>
          <span>Survey: <b>{text([property.survey_no, property.subdivision_no].filter((v) => v != null && v !== '').join(' / '))}</b></span>
          <span>Village: <b>{text(villageName ?? property.village_code)}</b></span>
          <span>ULPIN: <b className="mono">{text(property.ulpin)}</b></span>
          <span>Token: <b className="mono">{text(property.token_ref)}</b></span>
        </div>
      </div>

      <section className="vao-card property-details-card">
        <p className="vao-card-eyebrow">Property record</p>
        <div className="vao-tabs inline" role="tablist">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {tab === 'property' ? (
          <>
            <div className="vao-facts">
              <Fact label="Property ref" value={property.property_ref} mono />
              <Fact label="ULPIN" value={property.ulpin} mono />
              <Fact label="Property type" value={option('PROPERTY_TYPE', property.property_type_code)} />
              <Fact label="Nature of title" value={option('NATURE_OF_TITLE', property.nature_of_title_code)} />
              <Fact label="Land type" value={option('LAND_TYPE', property.land_type_code)} />
              <Fact label="Classification" value={option('CLASSIFICATION', property.classification_code)} />
              <Fact label="Extent" value={extent(property.extent_value, property.extent_unit)} />
              <Fact label="Status" value={status === 'ACTIVE' ? 'Active' : status ? 'Inactive' : null} />
              {publicView ? <Fact label="Last registration" value={property.last_registration_date} /> : <Fact label="Guideline value (per unit)" value={rupees(property.guideline_value)} />}
              {publicView ? null : <Fact label="Parent property" value={property.parent_property_ref} mono />}
              <Fact label="Token" value={property.token_ref} mono />
              {publicView ? null : <Fact label="Created" value={property.created_at} />}
            </div>
            {lineageNodes.length > 0 ? (
              <>
                <p className="vao-card-eyebrow">Property lineage</p>
                <div className="table-scroll">
                  <DataTable
                    rows={lineageNodes}
                    onRowClick={(row) => navigate(`/properties/${String(row.property_ref)}`)}
                    columns={[
                      { key: 'relation', label: 'Relation' },
                      { key: 'property_ref', label: 'Property' },
                      { key: 'property_status', label: 'Status' },
                      { key: 'current_owners', label: 'Owners' },
                      { key: 'token_ref', label: 'Token' },
                      { key: 'token_status', label: 'Token status' },
                    ]}
                  />
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {tab === 'owners' ? (
          <>
            {publicView ? null : <div className="vao-facts"><Fact label="Owner type" value={ownerType} /><Fact label="Owners" value={owners.length} /></div>}
            <DataTable
              rows={owners}
              empty="No owners recorded."
              columns={publicView
                ? [{ key: 'owner_name', label: 'Owner' }]
                : [
                    { key: 'owner_name', label: 'Owner' },
                    { key: 'aadhaar_number', label: 'Aadhaar', render: (row) => maskAadhaar(row.aadhaar_number) },
                    { key: 'pan', label: 'PAN' },
                    { key: 'mobile', label: 'Mobile' },
                    { key: 'address', label: 'Address' },
                    { key: 'effective_from', label: 'Owner since' },
                    { key: 'reveal', label: '', render: (row) => <RevealPii source="PROPERTY_OWNER" id={row.id} /> },
                  ]}
            />
          </>
        ) : null}

        {tab === 'location' ? (
          <div className="property-details-location">
            <div className="vao-facts">
              <Fact label="District" value={districtName ?? property.district_code} />
              <Fact label="Taluk" value={talukName ?? property.taluk_code} />
              <Fact label="Revenue village" value={villageName ?? property.village_code} />
              {publicView ? null : <Fact label="SRO" value={property.sro_code} />}
              {publicView ? null : <Fact label="Panchayat / Ward" value={[property.panchayat, property.ward_no].filter((v) => v != null && v !== '').join(' / ')} />}
              {publicView ? null : <Fact label="Door no. / Street" value={[property.door_no, property.street].filter((v) => v != null && v !== '').join(', ')} />}
              {publicView ? null : <Fact label="Boundaries (N / S / E / W)" value={[property.boundary_north, property.boundary_south, property.boundary_east, property.boundary_west].map((v) => formatCell(v ?? null)).join(' / ')} />}
            </div>
            <PropertyMap location={mapLocation} name={mapLocationName} status={mapStatus} />
          </div>
        ) : null}

        {tab === 'survey' ? (
          <>
            <p className="vao-card-eyebrow">Survey numbers</p>
            <DataTable
              rows={surveys}
              empty="No survey numbers recorded."
              columns={[
                { key: 'survey_no', label: 'Survey no.' },
                { key: 'subdivision_no', label: 'Sub-division' },
                { key: 'ulpin', label: 'ULPIN' },
                { key: 'extent_value', label: 'Extent', render: (row) => text(extent(row.extent_value, row.extent_unit)) },
              ]}
            />
            <p className="vao-card-eyebrow">Boundary measurements</p>
            <DataTable
              rows={measurements}
              empty="No boundary measurements recorded."
              columns={[
                { key: 'from_point', label: 'From' },
                { key: 'to_point', label: 'To' },
                { key: 'value', label: 'Length', render: (row) => `${formatCell(row.value ?? null)} ${String(row.unit ?? '').toLowerCase()}` },
              ]}
            />
          </>
        ) : null}

        {tab === 'title' ? (
          <DataTable
            rows={chain}
            empty="No prior title history recorded."
            columns={[
              { key: 'executor_name', label: 'Executor / Seller' },
              { key: 'claimant_name', label: 'Claimant / Purchaser' },
              { key: 'transaction_date', label: 'Date' },
              { key: 'nature_of_transaction', label: 'Nature' },
              { key: 'reference_no', label: 'Reference no.' },
              { key: 'survey_no', label: 'Survey no.' },
            ]}
          />
        ) : null}

        {tab === 'transactions' ? (
          <DataTable
            rows={transactions}
            empty="No transactions on this property."
            onRowClick={(row) => navigate(`/transactions/${String(row.txn_ref)}`)}
            columns={[
              { key: 'txn_ref', label: 'Transaction' },
              { key: 'deed_type_code', label: 'Deed type' },
              { key: 'status', label: 'Status', render: (row) => <StatusPill status={String(row.status ?? '')} /> },
              { key: 'current_stage_code', label: 'Stage' },
              { key: 'initiated_at', label: 'Initiated' },
            ]}
          />
        ) : null}

        {tab === 'timeline' ? <RecordTimeline path={`/api/audit/properties/${encodeURIComponent(String(property.property_ref ?? ''))}`} /> : null}

        {tab === 'blockchain' ? (
          publicView ? (
            <DataTable
              rows={history}
              empty="This property has no token on the ledger yet."
              columns={[
                { key: 'state_version', label: 'Version' },
                { key: 'operation', label: 'Operation' },
                { key: 'state_hash_hex', label: 'State hash' },
                { key: 'onchain_tx_hash', label: 'Ledger tx' },
                { key: 'recorded_at', label: 'Recorded' },
              ]}
            />
          ) : <TokenLedgerPanel tokenRef={str(property, 'token_ref')} />
        ) : null}
      </section>
    </div>
  )
}

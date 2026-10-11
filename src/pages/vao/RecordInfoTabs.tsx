import { formatCell } from '../../ui'
import type { Row } from '../../types'
import { labelFor, useOptionSet } from '../propertyShared'
import type { InfoTab } from './recordInfo'
import { deedLabel, formatTimestamp, rupees } from './vaoShared'

type Column = [string, string, ((row: Row) => unknown)?]

function Fact({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="vao-fact">
      <span>{label}</span>
      <strong className={mono ? 'mono' : undefined}>{formatCell(value == null || value === '' ? null : value)}</strong>
    </div>
  )
}

function Table({ rows, columns, empty }: { rows: Row[]; columns: Column[]; empty: string }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>
  return (
    <table className="vao-table compact">
      <thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={String(row.id ?? row.seq ?? i)}>
            {columns.map(([key, , render]) => <td key={key}>{formatCell((render == null ? row[key] : render(row)) ?? null)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])
const money = (value: unknown) => (value == null ? null : rupees(Number(value)))
const names = (rows: Row[]) => rows.map((p) => String(p.name ?? '')).filter(Boolean).join(', ')

/** Read-only transaction, property, buyer and survey details for the VAO and Tahsildar record pages. */
export function RecordInfoTabs({ record, tab }: { record: object; tab: InfoTab }) {
  const transferScopes = useOptionSet('TRANSFER_SCOPE')
  const modes = useOptionSet('MODE_OF_CONSIDERATION')
  const txnUnits = useOptionSet('TRANSACTION_EXTENT_UNIT')
  const units = useOptionSet('EXTENT_UNIT')
  const propertyTypes = useOptionSet('PROPERTY_TYPE')
  const titles = useOptionSet('NATURE_OF_TITLE')
  const landTypes = useOptionSet('LAND_TYPE')
  const classifications = useOptionSet('CLASSIFICATION')
  const ownerTypes = useOptionSet('OWNER_TYPE')

  const r = record as Row
  const txn = (r.transaction ?? {}) as Row
  const property = (r.property ?? {}) as Row
  const survey = (r.survey ?? rowsOf(r.submissions)[0] ?? null) as Row | null
  const parties = rowsOf(r.parties)
  const buyers = parties.filter((p) => p.side === 'SIDE_2')
  const label = (options: { value: string; label: string }[], code: unknown) => (code == null || code === '' ? null : labelFor(options, String(code)))
  const extent = (value: unknown, unit: unknown, options = units) => (value == null ? null : `${formatCell(value)} ${label(options, unit) ?? ''}`.trim())
  const yesNo = (value: unknown) => (value == null ? null : value === true ? 'Yes' : 'No')

  if (tab === 'transaction') {
    return (
      <div className="vao-facts">
        <Fact label="Transaction ID" value={r.txn_ref} mono />
        <Fact label="Deed type" value={deedLabel(String(txn.deed_type_code ?? r.deed_type_code ?? ''))} />
        <Fact label="Sub-type" value={txn.subtype} />
        <Fact label="Transfer scope" value={label(transferScopes, txn.transfer_scope)} />
        <Fact label="SRO" value={txn.sro_code ?? r.sro_code} />
        <Fact label="Seller / transferor" value={names(parties.filter((p) => p.side === 'SIDE_1')) || r.first_parties || r.sellers} />
        <Fact label="Declared consideration" value={money(txn.declared_consideration ?? r.declared_consideration)} />
        <Fact label="Mode of consideration" value={label(modes, txn.mode_of_consideration)} />
        <Fact label="Extent / share transferred" value={extent(txn.extent_or_share_transferred, txn.extent_unit, txnUnits)} />
        <Fact label="Guideline value" value={money(txn.guideline_value)} />
        <Fact label="Relationship category" value={txn.relationship_category} />
        <Fact label="Basis of settlement" value={txn.basis_of_settlement} />
        <Fact label="Share released" value={txn.share_being_released} />
        <Fact label="Survey required" value={yesNo(txn.survey_required ?? r.survey_required)} />
        <Fact label="Resulting sub-parcels" value={txn.resulting_subparcel_count} />
        <Fact label="Initiated" value={formatTimestamp(txn.initiated_at)} />
        <Fact label="Registered" value={formatTimestamp(txn.registered_at ?? r.registered_at)} />
        <Fact label="Document no." value={r.registered_document_no} mono />
        <Fact label="Remarks" value={txn.remarks} />
      </div>
    )
  }

  if (tab === 'property') {
    return (
      <>
        <div className="vao-facts">
          <Fact label="Property ref" value={property.property_ref ?? r.property_ref} mono />
          <Fact label="ULPIN" value={property.ulpin} mono />
          <Fact label="Property type" value={label(propertyTypes, property.property_type_code)} />
          <Fact label="Nature of title" value={label(titles, property.nature_of_title_code)} />
          <Fact label="Land type" value={label(landTypes, property.land_type_code)} />
          <Fact label="Classification" value={label(classifications, property.classification_code)} />
          <Fact label="District / Taluk" value={`${formatCell(property.district_code ?? null)} / ${formatCell(property.taluk_code ?? null)}`} />
          <Fact label="Village" value={r.village_name ?? property.village_code} />
          <Fact label="Door no. / Street" value={[property.door_no, property.street].filter((v) => v != null && v !== '').join(', ')} />
          <Fact label="Extent" value={extent(property.extent_value, property.extent_unit)} />
          <Fact label="Guideline value" value={money(property.guideline_value)} />
          <Fact label="Boundaries (N / S / E / W)" value={[property.boundary_north, property.boundary_south, property.boundary_east, property.boundary_west].map((v) => formatCell(v ?? null)).join(' / ')} />
        </div>
        <p className="vao-card-eyebrow">Survey numbers</p>
        <Table
          rows={rowsOf(r.surveyRecords)}
          empty="No survey numbers recorded."
          columns={[['survey_no', 'Survey no.'], ['subdivision_no', 'Sub-division'], ['ulpin', 'ULPIN'], ['extent_value', 'Extent', (row) => extent(row.extent_value, row.extent_unit)]]}
        />
        <p className="vao-card-eyebrow">Boundary measurements</p>
        <Table
          rows={rowsOf(r.boundaryMeasurements)}
          empty="No boundary measurements recorded."
          columns={[['from_point', 'From'], ['to_point', 'To'], ['value', 'Length', (row) => `${formatCell(row.value ?? null)} ${String(row.unit ?? '').toLowerCase()}`]]}
        />
      </>
    )
  }

  if (tab === 'buyer') {
    const rows = buyers.length === 0 ? parties : buyers
    return (
      <Table
        rows={rows}
        empty="No buyer recorded."
        columns={[
          ...(buyers.length === 0 ? [['side', 'Side', (row: Row) => (row.side === 'SIDE_1' ? 'Transferor' : 'Transferee')] as Column] : []),
          ['name', 'Name'],
          ['role', 'Role'],
          ['owner_type_code', 'Buyer type', (row) => label(ownerTypes, row.owner_type_code ?? row.party_type)],
          ['relationship_code', 'Relationship'],
          ['extent_transferred', 'Extent transferred'],
          ['address', 'Address'],
        ]}
      />
    )
  }

  const segments = rowsOf(r.segments)
  const points = rowsOf(r.boundary_points)
  const parcels = rowsOf(r.parcels)
  const children = rowsOf(r.childProperties)
  return (
    <>
      <div className="vao-facts">
        <Fact label="Survey no. / Sub-division" value={`${formatCell(r.survey_no ?? property.survey_no ?? null)}${r.subdivision_no ?? property.subdivision_no ? ` / ${String(r.subdivision_no ?? property.subdivision_no)}` : ''}`} />
        <Fact label="Survey required" value={yesNo(txn.survey_required ?? r.survey_required)} />
        {survey == null ? null : (
          <>
            <Fact label="Surveyor" value={survey.submitted_by_name ?? r.assigned_surveyor_name ?? r.surveyor_name} />
            <Fact label="Submitted" value={formatTimestamp(survey.submitted_at)} />
            <Fact label="Survey date" value={survey.survey_date} />
            <Fact label="Recorded extent" value={extent(survey.authoritative_recorded_extent, property.extent_unit)} />
            <Fact label="Measured extent" value={extent(survey.measured_extent, survey.extent_unit)} />
            <Fact label="Variance / tolerance" value={survey.variance_pct == null ? null : `${Number(survey.variance_pct).toFixed(2)}% / ${formatCell(survey.tolerance_pct ?? null)}%`} />
            <Fact label="Within tolerance" value={survey.within_tolerance == null ? null : survey.within_tolerance === true ? 'Yes' : 'No — conflict flagged'} />
            <Fact label="GPS centroid" value={survey.centroid_lat == null ? null : `${formatCell(survey.centroid_lat)}, ${formatCell(survey.centroid_lon ?? null)}`} mono />
            <Fact label="Boundaries (N / S / E / W)" value={[survey.boundary_north, survey.boundary_south, survey.boundary_east, survey.boundary_west].map((v) => formatCell(v ?? null)).join(' / ')} />
            <Fact label="Site notes" value={survey.site_notes} />
          </>
        )}
      </div>
      {survey == null ? <p className="muted">{txn.survey_required === false || r.survey_required === false ? 'No survey was required for this transaction.' : 'The Surveyor has not submitted a survey yet.'}</p> : (
        <>
          <p className="vao-card-eyebrow">Measurements</p>
          <Table
            rows={segments}
            empty="No measurements recorded."
            columns={[['seq', '#'], ['from_point', 'From'], ['to_point', 'To'], ['length_value', 'Length', (row) => `${formatCell(row.length_value ?? null)} ${String(row.length_unit ?? '').toLowerCase()}`]]}
          />
          <p className="vao-card-eyebrow">Boundary points (GPS)</p>
          <Table rows={points} empty="No boundary points recorded." columns={[['point_label', 'Point'], ['marker_status', 'Marker'], ['latitude', 'Latitude'], ['longitude', 'Longitude']]} />
        </>
      )}
      {parcels.length > 0 ? (
        <>
          <p className="vao-card-eyebrow">Resulting sub-parcels</p>
          <Table
            rows={parcels}
            empty=""
            columns={[['seq', '#'], ['survey_no', 'Survey no.'], ['official_subdivision_no', 'Sub-division'], ['extent_value', 'Extent', (row) => extent(row.extent_value, row.extent_unit)], ['boundary_north', 'Boundaries (N / S / E / W)', (row) => [row.boundary_north, row.boundary_south, row.boundary_east, row.boundary_west].map((v) => formatCell(v ?? null)).join(' / ')], ['child_property_ref', 'Child property']]}
          />
        </>
      ) : children.length > 0 ? (
        <>
          <p className="vao-card-eyebrow">Child properties</p>
          <Table
            rows={children}
            empty=""
            columns={[['property_ref', 'Property ref'], ['survey_no', 'Survey no.'], ['subdivision_no', 'Sub-division'], ['extent_value', 'Extent', (row) => extent(row.extent_value, row.extent_unit)], ['owners', 'Owners'], ['status', 'Status']]}
          />
        </>
      ) : null}
    </>
  )
}

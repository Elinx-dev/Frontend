import type { Row } from '../types'
import { DataTable, formatCell } from '../ui'
import { type Payload, rulePayload, ruleSummary } from './ruleCheckResults'

const asRows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.filter((v): v is Row => v !== null && typeof v === 'object') : []

const joinList = (value: unknown): string =>
  Array.isArray(value) ? value.map((v) => String(v)).join(', ') : formatCell(value)

const parcel = (survey: unknown, sub: unknown): string =>
  typeof sub === 'string' && sub.length > 0 ? `${formatCell(survey)}/${sub}` : formatCell(survey)

const MATCH_LABELS: Record<string, string> = {
  MATCH: 'Same property',
  HISTORICAL_MATCH: 'Same property (official link)',
  LINK_UNCONFIRMED: 'Review: no official link',
  AMBIGUOUS: 'Review: no schedule',
  NOT_MATCHED: 'Other property (ignored)',
}

export default function RuleCheckDetails({ results }: { results: Row[] }) {
  const ec = results.find((r) => String(r.engine) === 'EC')
  const revenue = results.find((r) => String(r.engine) === 'REVENUE_OWNERSHIP')
  return (
    <>
      {ec !== undefined ? <EcDetails ec={ec} /> : null}
      {revenue !== undefined ? <RevenueDetails revenue={revenue} /> : null}
    </>
  )
}

const RESULT_LABELS: Record<string, string> = {
  PROPERTY_MATCH: 'Match',
  PROPERTY_MISMATCH: 'Mismatch',
  OWNER_SET_MATCH: 'Match',
  OWNER_MISMATCH: 'Mismatch',
  EXTENT_SET_MATCH: 'Match',
  EXTENT_MISMATCH: 'Mismatch',
  REVIEW_REQUIRED: 'Review required',
  NOT_COMPARED: 'Not compared',
}

const PARCEL_LABELS: Record<string, string> = {
  MATCH: 'Same survey',
  HISTORICAL_MATCH: 'Same survey (official link)',
  LINK_UNCONFIRMED: 'Review: no official link',
  NOT_IN_REVENUE: 'Missing on Revenue',
  NOT_IN_SLATE: 'Not in SLATE',
  UNRESOLVED: 'Review: multiple records',
}

const EXTENT_LABELS: Record<string, string> = {
  EXTENT_MATCH: 'Match',
  EXTENT_MISMATCH: 'Mismatch',
  MISSING: 'Review: missing',
  UNCONVERTIBLE: 'Review: unit not convertible',
}

const OWNER_LABELS: Record<string, string> = {
  MATCH: 'Match',
  NOT_IN_REVENUE: 'Not on Revenue record',
  NOT_IN_SLATE: 'Not an owner-side party',
}

const IDENTITY_LABELS: Record<string, string> = { MATCH: 'Match', MISMATCH: 'Mismatch', MISSING: 'Review: not stated' }

const extentText = (value: unknown, unit: unknown): string =>
  value === null || value === undefined ? '—' : `${formatCell(value)} ${formatCell(unit)}`

const label = (labels: Record<string, string>, value: unknown): string => labels[String(value)] ?? formatCell(value)

function RevenueDetails({ revenue }: { revenue: Row }) {
  const payload = rulePayload(revenue)
  const searched = (payload.searchedWith ?? {}) as Payload
  const surveys = asRows(searched.surveys)
    .map((s) => parcel(s.surveyNo, s.subdivisionNo))
    .join(', ')
  const records = asRows(payload.revenueRecords)
    .map((r) => formatCell(r.recordNumberDisplayOnly))
    .join(', ')
  const identity = asRows(payload.identity).map((r) => ({ ...r, result: label(IDENTITY_LABELS, r.status) }))
  const parcels = asRows(payload.parcels).map((p) => ({
    ...p,
    slateText: extentText(p.slateExtent, p.slateUnit),
    revenueText: extentText(p.revenueExtent, p.revenueUnit),
    slateStd: extentText(p.slateStandard, p.standardUnit),
    revenueStd: extentText(p.revenueStandard, p.standardUnit),
    match: label(PARCEL_LABELS, p.matchStatus),
    extent: p.extentStatus === undefined ? '—' : label(EXTENT_LABELS, p.extentStatus),
  }))
  const owners = asRows(payload.owners).map((o) => ({ ...o, result: label(OWNER_LABELS, o.status) }))
  const findings = asRows(payload.findings)
  const outcome = String(revenue.overall_outcome ?? '')

  return (
    <div className="rule-check-details">
      <h3>Revenue ownership / Patta check</h3>
      {payload.blocking === true ? (
        <div className="banner banner-error">
          Pre-registration stopped: {formatCell(revenue.reason_code)}. {ruleSummary(revenue)}
        </div>
      ) : outcome === 'REVIEW_REQUIRED' || outcome === 'DISCREPANCY_DETECTED' ? (
        <div className="banner banner-info">
          Warning, manual review required ({formatCell(revenue.reason_code)}). {ruleSummary(revenue)}
        </div>
      ) : outcome === 'NOT_CHECKED' ? (
        <div className="banner banner-info">Not checked ({formatCell(revenue.reason_code)}). {ruleSummary(revenue)}</div>
      ) : null}
      <dl className="kv">
        <dt>District</dt>
        <dd>{formatCell(searched.district)}</dd>
        <dt>Taluk</dt>
        <dd>{formatCell(searched.taluk)}</dd>
        <dt>Revenue village</dt>
        <dd>{formatCell(searched.village)}</dd>
        <dt>Land type</dt>
        <dd>{formatCell(searched.landType)}</dd>
        <dt>Survey / sub-division(s)</dt>
        <dd>{surveys.length > 0 ? surveys : '—'}</dd>
        <dt>Patta / record no.</dt>
        <dd>{records.length > 0 ? `${records} (display only)` : '—'}</dd>
        <dt>Property</dt>
        <dd>{label(RESULT_LABELS, payload.propertyResult)}</dd>
        <dt>Owners</dt>
        <dd>{label(RESULT_LABELS, payload.ownerResult)}</dd>
        <dt>Extent</dt>
        <dd>{label(RESULT_LABELS, payload.extentResult)}</dd>
      </dl>
      <h4>Findings</h4>
      <div className="rule-check-table">
        <DataTable
          rows={findings}
          columns={[
            { key: 'severity', label: 'Severity' },
            { key: 'code', label: 'Finding' },
            { key: 'reference', label: 'Survey / record' },
            { key: 'message', label: 'Detail' },
          ]}
          empty="No findings."
        />
      </div>
      <h4>Property identity</h4>
      <div className="rule-check-table">
        <DataTable
          rows={identity}
          columns={[
            { key: 'field', label: 'Field' },
            { key: 'slate', label: 'SLATE' },
            { key: 'revenue', label: 'Revenue' },
            { key: 'result', label: 'Result' },
          ]}
          empty="No Revenue record to compare."
        />
      </div>
      <h4>Survey-wise extent</h4>
      <div className="rule-check-table">
        <DataTable
          rows={parcels}
          columns={[
            { key: 'slateParcel', label: 'SLATE survey' },
            { key: 'revenueParcel', label: 'Revenue survey' },
            { key: 'match', label: 'Survey match' },
            { key: 'slateText', label: 'SLATE extent' },
            { key: 'revenueText', label: 'Revenue extent' },
            { key: 'slateStd', label: 'SLATE (converted)' },
            { key: 'revenueStd', label: 'Revenue (converted)' },
            { key: 'extent', label: 'Extent result' },
          ]}
          empty="No survey rows compared."
        />
      </div>
      <h4>Owners</h4>
      <div className="rule-check-table">
        <DataTable
          rows={owners}
          columns={[
            { key: 'slateOwner', label: 'Aadhaar-verified owner (SLATE)' },
            { key: 'revenueOwner', label: 'Revenue owner' },
            { key: 'recordNumber', label: 'Patta / record' },
            { key: 'result', label: 'Result' },
          ]}
          empty="No owners compared."
        />
      </div>
    </div>
  )
}

function EcDetails({ ec }: { ec: Row }) {
  const payload = rulePayload(ec)
  const searched = (payload.searchedWith ?? {}) as Payload
  const findings = asRows(payload.findings)
  const mortgages = asRows(payload.mortgages)
  const entries = asRows(payload.entries).map((e) => ({
    ...e,
    parcel: parcel(e.surveyNo, e.subdivisionNo),
    extentText: e.extent === null || e.extent === undefined ? '—' : `${formatCell(e.extent)} ${formatCell(e.extentUnit)}`,
    executantText: joinList(e.executants),
    claimantText: joinList(e.claimants),
    match: MATCH_LABELS[String(e.matchStatus)] ?? formatCell(e.matchStatus),
  }))
  const outcome = String(ec.overall_outcome ?? '')

  return (
    <div className="rule-check-details">
      <h3>Encumbrance Certificate check</h3>
      {payload.blocking === true ? (
        <div className="banner banner-error">
          Pre-registration stopped: {formatCell(ec.reason_code)}. {ruleSummary(ec)}
        </div>
      ) : outcome === 'REVIEW_REQUIRED' || outcome === 'DISCREPANCY_DETECTED' ? (
        <div className="banner banner-info">
          Warning, manual review required ({formatCell(ec.reason_code)}). {ruleSummary(ec)}
        </div>
      ) : null}
      <dl className="kv">
        <dt>District</dt>
        <dd>{formatCell(searched.district)}</dd>
        <dt>Taluk</dt>
        <dd>{formatCell(searched.taluk)}</dd>
        <dt>Revenue village</dt>
        <dd>{formatCell(searched.village)}</dd>
        <dt>Survey / sub-division</dt>
        <dd>{parcel(searched.surveyNo, searched.subdivisionNo)}</dd>
        <dt>Search period</dt>
        <dd>
          {formatCell(searched.searchFrom)} to {formatCell(searched.searchTo)}
          {searched.lookbackYears !== undefined && searched.lookbackYears !== null
            ? ` (${formatCell(searched.lookbackYears)} years, configured)`
            : ''}
        </dd>
        <dt>Certificate</dt>
        <dd>{formatCell(payload.certificateNo)}</dd>
      </dl>
      <h4>Findings</h4>
      <div className="rule-check-table">
        <DataTable
          rows={findings}
          columns={[
            { key: 'code', label: 'Finding' },
            { key: 'reference', label: 'Document' },
            { key: 'message', label: 'Detail' },
          ]}
          empty="No findings."
        />
      </div>
      <h4>Mortgages</h4>
      <div className="rule-check-table">
        <DataTable
          rows={mortgages}
          columns={[
            { key: 'documentId', label: 'Mortgage doc' },
            { key: 'registrationDate', label: 'Registered' },
            { key: 'mortgagee', label: 'Mortgagee' },
            { key: 'status', label: 'Status' },
            { key: 'releaseDocumentId', label: 'Receipt doc' },
          ]}
          empty="No mortgage on this property."
        />
      </div>
      <h4>EC entries</h4>
      <div className="rule-check-table">
        <DataTable
          rows={entries}
          columns={[
            { key: 'documentNo', label: 'Doc no./year' },
            { key: 'registrationDate', label: 'Registered' },
            { key: 'nature', label: 'Nature' },
            { key: 'executantText', label: 'Executant' },
            { key: 'claimantText', label: 'Claimant' },
            { key: 'previousDocumentReference', label: 'Previous doc' },
            { key: 'remarks', label: 'Remarks' },
            { key: 'parcel', label: 'Survey/sub-div' },
            { key: 'extentText', label: 'Extent' },
            { key: 'boundaries', label: 'Boundaries' },
            { key: 'classifiedType', label: 'Classified as' },
            { key: 'match', label: 'Property match' },
          ]}
          empty="The EC has no entries for the searched period."
        />
      </div>
    </div>
  )
}

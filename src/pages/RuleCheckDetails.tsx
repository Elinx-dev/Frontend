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
  if (ec === undefined) return null
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
      <DataTable
        rows={findings}
        columns={[
          { key: 'code', label: 'Finding' },
          { key: 'reference', label: 'Document' },
          { key: 'message', label: 'Detail' },
        ]}
        empty="No findings."
      />
      <h4>Mortgages</h4>
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
      <h4>EC entries</h4>
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
  )
}

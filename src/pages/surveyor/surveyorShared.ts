import type { Row } from '../../types'
import type { VaoRecord } from '../vao/vaoShared'

export interface SurveyorRecord extends VaoRecord {
  subdivision_required?: boolean
  submission_id?: number | null
  submitted_at?: string | null
  measured_extent?: number | null
  measured_unit?: string | null
  measured_extent_in_record_unit?: number | null
  variance_pct?: number | null
  within_tolerance?: boolean | null
  routed_to?: string | null
  can_survey: boolean
  tolerance_pct: number
}

export interface SurveyorDetail extends SurveyorRecord {
  property: Row
  parties: Row[]
  visits: Row[]
  submissions: Row[]
  segments?: Row[]
  boundary_points?: Row[]
  parcels?: Row[]
  childProperties?: Row[]
  mutation?: Row
  objections?: Row[]
}

export interface SurveyorDashboardData {
  officer: { id: number; name: string; username: string; villages: string[] }
  today: string
  tolerancePct: number
  kpis: {
    assigned: number
    actionRequired: number
    scheduled: number
    surveyDue: number
    submitted: number
    verified: number
  }
  byStage: Record<string, number>
  todaysVisits: SurveyorRecord[]
  records: SurveyorRecord[]
}

export interface MeasurementRow {
  from: string
  to: string
  value: string
  unit: string
}

export interface PolygonRow {
  lat: string
  latDir: 'N' | 'S'
  lon: string
  lonDir: 'E' | 'W'
}

/** Square metres per area unit code, for conversions only; dropdown values come from cfg.option_value (EXTENT_UNIT). */
const AREA_M2: Record<string, number> = { SQ_FT: 0.09290304, SQ_M: 1, CENT: 40.468564224, ACRE: 4046.8564224, HECTARE: 10000 }
const LENGTH_M: Record<string, number> = { FT: 0.3048, M: 1 }

const AREA_ALIASES: Record<string, string> = {
  SQFT: 'SQ_FT', 'SQ.FT': 'SQ_FT', SQ_FT: 'SQ_FT', SFT: 'SQ_FT', SQUARE_FEET: 'SQ_FT',
  SQM: 'SQ_M', 'SQ.M': 'SQ_M', SQ_M: 'SQ_M', SQUARE_METRES: 'SQ_M', SQUARE_METERS: 'SQ_M',
  CENT: 'CENT', CENTS: 'CENT',
  ACRE: 'ACRE', ACRES: 'ACRE', AC: 'ACRE',
  HECTARE: 'HECTARE', HECTARES: 'HECTARE', HA: 'HECTARE',
}

/** Mirrors the backend's AreaUnits so the conflict preview matches what the server decides. */
export function areaUnitCode(unit: string | null | undefined): string | null {
  if (unit == null || unit.trim() === '') return null
  const key = unit.trim().toUpperCase().replace(/ /g, '_')
  return AREA_ALIASES[key] ?? key
}

export function areaUnitLabel(unit: string | null | undefined, units: { value: string; label: string }[] = []): string {
  const code = areaUnitCode(unit)
  return units.find((u) => u.value === code)?.label ?? unit ?? ''
}

export function toSquareMetres(value: number, unit: string | null | undefined): number | null {
  const factor = AREA_M2[areaUnitCode(unit) ?? '']
  return factor == null || !Number.isFinite(value) ? null : value * factor
}

export function convertArea(value: number, from: string | null | undefined, to: string | null | undefined): number | null {
  const a = areaUnitCode(from)
  const b = areaUnitCode(to)
  if (a == null || b == null || a === b) return value
  const m2 = toSquareMetres(value, a)
  const factor = AREA_M2[b]
  return m2 == null || factor == null ? null : m2 / factor
}

export function lengthInMetres(value: number, unit: string): number {
  return value * (LENGTH_M[unit] ?? 1)
}

export function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Signed decimal degrees for a polygon row, or null when the row is incomplete. */
export function vertex(row: PolygonRow): [number, number] | null {
  const lat = num(row.lat)
  const lon = num(row.lon)
  if (lat == null || lon == null) return null
  return [row.latDir === 'S' ? -lat : lat, row.lonDir === 'W' ? -lon : lon]
}

export function isPartition(record: Pick<SurveyorRecord, 'subdivision_required' | 'deed_type_code'>): boolean {
  return record.subdivision_required === true || /PARTITION|SUBDIVISION/.test(record.deed_type_code)
}

export function coordLabel(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(4)}° ${lon < 0 ? 'W' : 'E'}`
}

export function surveyorRecordLink(r: SurveyorRecord): string {
  if (r.status !== 'SURVEY_PENDING') return `/surveyor/verification/${encodeURIComponent(r.txn_ref)}`
  if (r.can_survey) return `/surveyor/field-survey?txn=${encodeURIComponent(r.txn_ref)}`
  return '/surveyor/site-visits'
}

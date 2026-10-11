import type { Row } from '../../types'

export interface VaoRecord {
  transaction_id: number
  txn_ref: string
  deed_type_code: string
  status: string
  survey_required: boolean
  declared_consideration: number | null
  registered_at: string | null
  assigned_vao_name: string | null
  surveyor_name: string | null
  property_ref: string
  ulpin: string | null
  survey_no: string | null
  subdivision_no: string | null
  village_code: string | null
  village_name: string | null
  extent_value: number | null
  extent_unit: string | null
  first_parties: string | null
  second_parties: string | null
  mutation_id: number | null
  mutation_status: string | null
  visit_id: number | null
  visit_purpose: string | null
  visit_status: string | null
  proposed_by_role: string | null
  counter_by_role: string | null
  visit_date: string | null
  visit_time: string | null
  counter_visit_date: string | null
  counter_visit_time: string | null
  agreed_date: string | null
  agreed_time: string | null
  vao_checkin_at: string | null
  surveyor_checkin_at: string | null
  stage: string
  stage_label: string
  action_required: boolean
  slot_booked: boolean
  can_verify: boolean
}

export interface VaoDetail extends VaoRecord {
  property: Row
  parties: Row[]
  visits: Row[]
  survey: Row | null
  mutation?: Row
  objections?: Row[]
}

export interface VaoDashboardData {
  officer: { id: number; name: string; username: string; villages: string[] }
  today: string
  kpis: {
    assigned: number
    actionRequired: number
    scheduled: number
    visitDone: number
    readyToVerify: number
    verified: number
  }
  byStage: Record<string, number>
  todaysVisits: VaoRecord[]
  records: VaoRecord[]
}

export interface Slot {
  time: string
  available: boolean
  past: boolean
  txn_ref: string | null
  ulpin: string | null
  visit_status: string | null
}

export type StageTone = 'action' | 'waiting' | 'booked' | 'done' | 'danger'

export const VAO_STAGE_TONES: Record<string, StageTone> = {
  WITH_SURVEYOR: 'waiting',
  AWAITING_PROPOSAL: 'action',
  READY_TO_VERIFY: 'booked',
  OBJECTION_PENDING: 'danger',
  VERIFIED: 'done',
}

export function isCompleted(record: VaoRecord): boolean {
  return record.stage === 'VERIFIED'
}

export function canBook(record: VaoRecord): boolean {
  if (record.status !== 'VAO_PENDING' && record.status !== 'OBJECTION_PENDING') return false
  return !record.slot_booked || record.vao_checkin_at == null
}

export function purposeLabel(purpose: unknown): string {
  return purpose === 'FIELD_VERIFICATION' ? 'Field verification' : purpose === 'FIELD_SURVEY' ? 'Field survey' : '—'
}

export function planLabel(record: VaoRecord): string {
  if (record.visit_status == null) return '—'
  return record.visit_status === 'COMPLETED' ? 'Completed' : 'Booked'
}

export function when(date: string | null, time: string | null): string {
  if (date == null) return '—'
  return time == null ? date : `${date} · ${time}`
}

export function parties(record: VaoRecord): string {
  const first = record.first_parties ?? '—'
  const second = record.second_parties ?? '—'
  return `${first} → ${second}`
}

export function deedLabel(code: string): string {
  return code.toLowerCase().replace(/_/g, ' ')
}

export function rupees(value: number | null): string {
  if (value == null || value === undefined) return '—'
  return `₹${Number(value).toLocaleString('en-IN')}`
}

export function todayIso(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function formatTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

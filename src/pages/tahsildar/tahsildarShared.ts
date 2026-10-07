import type { Row } from '../../types'
import type { StageTone } from '../vao/vaoShared'

export interface ChecklistItem {
  code: string
  label: string
  passed: boolean
  detail?: string
}

export interface TahsildarRecord {
  transaction_id: number
  txn_ref: string
  status: string
  deed_type_code: string
  subtype: string | null
  sro_code: string | null
  declared_consideration: number | null
  guideline_value: number | null
  initiated_at: string | null
  registered_at: string | null
  registration_date: string | null
  assigned_vao_name: string | null
  assigned_surveyor_name: string | null
  property_ref: string
  ulpin: string | null
  survey_no: string | null
  subdivision_no: string | null
  village_code: string | null
  village_name: string | null
  taluk_code: string | null
  extent_value: number | null
  extent_unit: string | null
  sellers: string | null
  buyers: string | null
  registered_document_no: string | null
  survey_required: boolean
  within_tolerance: boolean | null
  variance_pct: number | null
  survey_submitted_at: string | null
  visit_booked: boolean
  open_objections: number
  mutation_id: number | null
  mutation_status: string | null
  mutation_type: string | null
  forwarded_at: string | null
  vao_verified_at: string | null
  vao_verified_by_name: string | null
  vao_remarks: string | null
  tahsildar_remarks: string | null
  approved_at: string | null
  revenue_record_number: string | null
  mutation_register_number: string | null
  stage: string
  stage_label: string
  action_required: boolean
  can_approve: boolean
  checklist: ChecklistItem[]
}

export interface TahsildarDetail extends TahsildarRecord {
  property: Row
  parties: Row[]
  witnesses: Row[]
  registeredOwners: Row[]
  feeCalculation: Row | null
  payments: Row[]
  ruleCheckResults: Row[]
  registration: Row | null
  survey: Row | null
  siteVisits: Row[]
  mutation: (Row & { objections?: Row[]; approvedRecord?: Row[] }) | null
  timeline: Row[]
}

export interface TahsildarDashboardData {
  officer: { name: string; username: string; jurisdiction: { district_code: string; taluk_code: string; taluk_name: string | null }[] }
  today: string
  kpis: {
    total: number
    awaitingApproval: number
    readyForApproval: number
    onHold: number
    inProgress: number
    objections: number
    approved: number
    approvedToday: number
    approvedThisMonth: number
  }
  byStage: { stage: string; label: string; count: number }[]
  byVillage: { village_name: string; total: number; pending: number; approved: number }[]
  approvalQueue: TahsildarRecord[]
  recentApprovals: TahsildarRecord[]
}

export const TAHSILDAR_STAGE_TONES: Record<string, StageTone> = {
  WITH_SURVEYOR: 'waiting',
  WITH_VAO: 'waiting',
  OBJECTION_PENDING: 'danger',
  READY_FOR_APPROVAL: 'action',
  ON_HOLD: 'danger',
  APPROVED: 'done',
}

export function recordPath(txnRef: string): string {
  return `/tahsildar/transactions/${encodeURIComponent(txnRef)}`
}

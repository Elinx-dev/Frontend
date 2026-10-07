import { canBook as vaoCanBook, isCompleted as vaoIsCompleted, VAO_STAGE_TONES } from './vaoShared'
import type { StageTone, VaoRecord } from './vaoShared'

/** What differs between the VAO and Surveyor portals that share the visit pages. */
export interface Portal {
  key: 'VAO' | 'SURVEYOR'
  api: string
  home: string
  name: string
  other: 'Surveyor' | 'VAO'
  tones: Record<string, StageTone>
  selfCheckin: (r: VaoRecord) => string | null
  otherName: (r: VaoRecord) => string | null
  isCompleted: (r: VaoRecord) => boolean
  canBook: (r: VaoRecord) => boolean
}

export const VAO_PORTAL: Portal = {
  key: 'VAO',
  api: '/api/vao',
  home: '/vao',
  name: 'VAO Officer Portal',
  other: 'Surveyor',
  tones: VAO_STAGE_TONES,
  selfCheckin: (r) => r.vao_checkin_at ?? null,
  otherName: (r) => r.surveyor_name ?? null,
  isCompleted: vaoIsCompleted,
  canBook: vaoCanBook,
}

export const SURVEYOR_PORTAL: Portal = {
  key: 'SURVEYOR',
  api: '/api/surveyor',
  home: '/surveyor',
  name: 'Surveyor Portal',
  other: 'VAO',
  tones: {
    AWAITING_PROPOSAL: 'action',
    SLOT_BOOKED: 'booked',
    CHECK_IN_DUE: 'booked',
    SURVEY_DUE: 'action',
    CONFLICT_FLAGGED: 'danger',
    SUBMITTED: 'booked',
    OBJECTION_PENDING: 'danger',
    VERIFIED: 'done',
  },
  selfCheckin: (r) => r.surveyor_checkin_at ?? null,
  otherName: (r) => r.assigned_vao_name ?? null,
  isCompleted: (r) => r.status !== 'SURVEY_PENDING',
  canBook: (r) => r.status === 'SURVEY_PENDING' && (!r.slot_booked || r.surveyor_checkin_at == null),
}

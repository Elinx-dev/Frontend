export interface UserProfile {
  id: number
  username: string
  fullName: string
  email: string | null
  mobile: string | null
  designation: string | null
  department: string | null
  stateCode: string
  roles: string[]
  permissions: string[]
  jurisdictions?: Row[]
  homeRoute?: string
}

export interface LoginResponse {
  mfaRequired?: boolean
  challengeId?: string
  maskedEmail?: string
  demoOtp?: string
  accessToken?: string
  expiresAt?: string
  user?: UserProfile
}

export interface PasswordResetResponse {
  message: string
  demoResetUrl?: string
}

export type Row = Record<string, unknown>

export interface DeedType {
  code: string
  name: string
  survey_rule?: string
  allowed_transfer_scopes?: string[] | string
}

export interface Bootstrap {
  state: Row
  modules: Row
  deedTypes: DeedType[]
  optionSets: Record<string, Row[]>
  relationships: Row[]
  documentTypes: Row[]
  jurisdictions: Row[]
  featureFlags: Row
}

export interface TransactionDetail extends Row {
  txn_ref: string
  status: string
  current_stage_code?: string
  deed_type_code: string
  transfer_scope?: string
  survey_required?: boolean
  property: Row
  deedType: Row
  parties: Row[]
  witnesses: Row[]
  consents: Row[]
  ruleCheckResults: Row[]
  feeCalculation: Row | null
  payments: Row[]
  registeredOwners: Row[]
  surveyParcels: Row[]
  availableActions: Row[]
  validation: Row
  stages: Row[]
  registrationResult: Row[]
  mutation: Row[]
}

export function str(row: Row | null | undefined, key: string): string {
  const value = row?.[key]
  return value === null || value === undefined ? '' : String(value)
}

export function num(row: Row | null | undefined, key: string): number | null {
  const value = row?.[key]
  return typeof value === 'number' ? value : value === null || value === undefined ? null : Number(value)
}

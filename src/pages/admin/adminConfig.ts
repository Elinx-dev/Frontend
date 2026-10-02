import { useCallback, useEffect, useState } from 'react'

import { ApiError, get } from '../../api'

export interface ModuleConfig {
  id: number
  module: string
  enabled: boolean
  mode: string
  owner_department?: string | null
  sla_days?: number | null
  notes?: string | null
  effective_from: string
  effective_to?: string | null
}

export interface FeatureFlag {
  id: number
  flag_code: string
  enabled: boolean
  description?: string | null
}

export interface WorkflowDefinition {
  id: number
  deed_type_code: string
  workflow_code: string
  version: number
  status: string
  effective_from: string
  effective_to?: string | null
  published_at?: string | null
}

export interface AdminSnapshot {
  state: { state_code: string; state_name: string } | null
  modules: ModuleConfig[]
  featureFlags: FeatureFlag[]
  workflows: WorkflowDefinition[]
}

export const DEPARTMENTS = ['REGISTRATION', 'SURVEY', 'REVENUE', 'ADMIN', 'PUBLIC'] as const

export function errorText(e: unknown): string {
  if (e instanceof ApiError || e instanceof Error) return e.message
  return String(e)
}

const ACRONYMS = new Set(['gps', 'vao', 'sla', 'fmb', 'ulpin', 'otp', 'mfa', 'sro'])

export function humanize(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => ACRONYMS.has(part) ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatDate(value?: string | null): string {
  if (value === undefined || value === null || value.length === 0) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function useAdminSnapshot() {
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try {
      setSnapshot(await get<AdminSnapshot>('/api/config/admin'))
      setError('')
    } catch (e) {
      setError(errorText(e))
    }
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { snapshot, error, reload }
}

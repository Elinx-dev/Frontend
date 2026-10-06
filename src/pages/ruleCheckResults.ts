import type { Row } from '../types'

export type Payload = Record<string, unknown>

export function rulePayload(result: Row): Payload {
  const raw = result.result_payload ?? result.payload
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Payload
    } catch {
      return {}
    }
  }
  return raw !== null && typeof raw === 'object' ? (raw as Payload) : {}
}

export function ruleSummary(result: Row): string {
  const summary = rulePayload(result).summary
  return typeof summary === 'string' ? summary : ''
}

export function ruleWarnings(results: Row[]): Row[] {
  return results.filter((r) =>
    ['REVIEW_REQUIRED', 'DISCREPANCY_DETECTED'].includes(String(r.overall_outcome ?? r.overallOutcome ?? '')),
  )
}

export function ruleWarningText(results: Row[]): string {
  const warnings = ruleWarnings(results)
  if (warnings.length === 0) return ''
  const reasons = warnings.map((w) => `${String(w.engine ?? '')}: ${String(w.reason_code ?? w.reasonCode ?? '')}`)
  return `Rule checks completed with warnings for manual review (${reasons.join(', ')}).`
}

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

export function ruleBlocking(result: Row): boolean {
  return result.blocking === true || rulePayload(result).blocking === true
}

export function ruleBlockers(results: Row[]): Row[] {
  return results.filter(ruleBlocking)
}

export function ruleBlockedText(results: Row[]): string {
  const blockers = ruleBlockers(results)
  if (blockers.length === 0) return ''
  const reasons = blockers.map((b) =>
    `${String(b.engine ?? '')} ${String(b.overall_outcome ?? b.overallOutcome ?? '')} (${String(b.reason_code ?? b.reasonCode ?? '')})`)
  return `Stopped at rule checks: ${reasons.join(', ')}. The state's rule check control does not allow this result to `
    + 'proceed, so the next steps are locked. Resolve the finding and run the rule checks again.'
}

export function rulePolicyText(policy: unknown): string {
  const rows = Array.isArray(policy) ? (policy as Row[]) : []
  if (rows.length === 0) return 'Rule check results are checked against the state\'s rule check control before the transaction can continue.'
  const parts = rows.map((p) => {
    const allowed = Array.isArray(p.allowedOutcomes) ? p.allowedOutcomes.map(String) : []
    return `${String(p.engine)}: ${allowed.join(', ')}`
  })
  return `Results allowed to continue in this state (${parts.join('; ')}). Any other result stops the transaction at this step.`
}

export function ruleWarnings(results: Row[]): Row[] {
  return results.filter((r) =>
    !ruleBlocking(r)
      && ['REVIEW_REQUIRED', 'DISCREPANCY_DETECTED'].includes(String(r.overall_outcome ?? r.overallOutcome ?? '')),
  )
}

export function ruleWarningText(results: Row[]): string {
  const warnings = ruleWarnings(results)
  if (warnings.length === 0) return ''
  const reasons = warnings.map((w) => `${String(w.engine ?? '')}: ${String(w.reason_code ?? w.reasonCode ?? '')}`)
  return `Rule checks completed with warnings for manual review (${reasons.join(', ')}).`
}

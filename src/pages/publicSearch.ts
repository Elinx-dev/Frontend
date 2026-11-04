// Same patterns as Backend PublicController: anything else is rejected before a request is sent.
export const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/
export const SURVEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/-]{0,19}$/
export const PLACE_PATTERN = /^(?!.*--)[A-Za-z0-9][A-Za-z0-9 .()-]{0,59}$/
export const LOOKUP_MIN_CHARS = 3

export function fieldError(value: string, pattern: RegExp, label: string, required: boolean): string {
  const v = value.trim()
  if (v.length === 0) return required ? `${label} is required` : ''
  return pattern.test(v) ? '' : `${label} has characters that are not allowed`
}

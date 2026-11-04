import { useEffect, useRef, useState } from 'react'

import { get, qs } from '../api'
import { LOOKUP_MIN_CHARS, PLACE_PATTERN } from './publicSearch'

type Suggestion = { code: string; name: string }

/**
 * Free-text box with suggestions from the public lookups once 3 or more characters
 * are typed. Shorter values are still accepted as typed (the backend validates them).
 */
export default function LookupField({ label, value, onChange, path, params = {}, error = '', maxLength = 60 }: {
  label: string
  value: string
  onChange: (value: string) => void
  path: string
  params?: Record<string, string>
  error?: string
  maxLength?: number
}) {
  const [result, setResult] = useState<{ key: string; rows: Suggestion[] }>({ key: '', rows: [] })
  const [open, setOpen] = useState(false)
  const latest = useRef(0)
  const text = value.trim()
  const paramKey = JSON.stringify(params)
  const queryKey = `${path}${qs({ q: text, ...params })}`
  const searchable = text.length >= LOOKUP_MIN_CHARS && PLACE_PATTERN.test(text)
  const suggestions = open && searchable && result.key === queryKey ? result.rows : []

  useEffect(() => {
    const request = ++latest.current
    if (!open || !searchable) return
    const timer = window.setTimeout(() => {
      get<Suggestion[]>(queryKey)
        .then((rows) => { if (request === latest.current) setResult({ key: queryKey, rows }) })
        .catch(() => { if (request === latest.current) setResult({ key: queryKey, rows: [] }) })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [queryKey, paramKey, open, searchable])

  return (
    <label className="field property-combobox public-field">
      <span>{label} <b className="req">*</b></span>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-invalid={error.length > 0}
        placeholder={`Type ${LOOKUP_MIN_CHARS}+ letters for suggestions`}
        onChange={(e) => { setOpen(true); onChange(e.target.value) }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && suggestions.length > 0 ? (
        <div className="property-combobox-menu" role="listbox" aria-label={`${label} suggestions`}>
          {suggestions.map((s) => (
            <button
              type="button"
              role="option"
              aria-selected={s.name === value}
              className="property-combobox-option"
              key={s.code}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s.name); setOpen(false) }}
            >
              <strong>{s.name}</strong>
              <span>{s.code}</span>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <small className="public-field-error">{error}</small> : null}
    </label>
  )
}

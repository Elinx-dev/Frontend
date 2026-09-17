import { useEffect, useState } from 'react'

import { ApiError, get, qs } from '../api'
import { useAuth } from '../auth'
import type { Row } from '../types'
import { Banner, DataTable, Field, Panel, formatCell } from '../ui'

export default function Admin() {
  const { bootstrap } = useAuth()
  const [deedTypeCode, setDeedTypeCode] = useState('')
  const [fields, setFields] = useState<Row[]>([])
  const [rules, setRules] = useState<Row[]>([])
  const [fixtures, setFixtures] = useState<Row | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get<Row>('/mock/fixtures')
      .then(setFixtures)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : String(e)))
  }, [])

  useEffect(() => {
    if (deedTypeCode.length === 0) return
    Promise.all([
      get<Row[]>(`/api/config/fields${qs({ deedTypeCode })}`),
      get<Row[]>(`/api/config/validation-rules${qs({ deedTypeCode })}`),
    ])
      .then(([f, r]) => {
        setFields(f)
        setRules(r)
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : String(e)))
  }, [deedTypeCode])

  return (
    <>
      <Panel title="Configuration explorer">
        <Banner kind="error" message={error} />
        <Field
          label="Deed type"
          value={deedTypeCode}
          onChange={setDeedTypeCode}
          options={(bootstrap?.deedTypes ?? []).map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
        />
        <h3>Fields</h3>
        <DataTable
          rows={fields}
          columns={[
            { key: 'stage_code', label: 'Stage' },
            { key: 'field_code', label: 'Field' },
            { key: 'label', label: 'Label' },
            { key: 'data_type', label: 'Type' },
            { key: 'required', label: 'Required' },
            { key: 'option_set_code', label: 'Option set' },
          ]}
          empty="Select a deed type."
        />
        <h3>Validation rules</h3>
        <DataTable
          rows={rules}
          columns={[
            { key: 'rule_code', label: 'Rule' },
            { key: 'severity', label: 'Severity' },
            { key: 'message', label: 'Message' },
            { key: 'applies_when', label: 'Applies when' },
          ]}
          empty="Select a deed type."
        />
      </Panel>

      <Panel title="Modules and feature flags">
        <dl className="kv">
          <dt>State</dt>
          <dd>{formatCell(bootstrap?.state.state_name)}</dd>
          <dt>Modules</dt>
          <dd>{formatCell(bootstrap?.modules)}</dd>
          <dt>Feature flags</dt>
          <dd>{formatCell(bootstrap?.featureFlags)}</dd>
        </dl>
      </Panel>

      <Panel title="Mock external API fixtures">
        <p className="muted">
          Deterministic fixtures backing the EC, revenue, Aadhaar and payment connectors in MOCK mode.
        </p>
        <pre className="code">{JSON.stringify(fixtures, null, 2)}</pre>
      </Panel>
    </>
  )
}

import { useState } from 'react'

import { ApiError, get, post, qs } from '../api'
import { storedToken } from '../api'
import type { Row } from '../types'
import { Banner, DataTable, Field, Panel, formatCell } from '../ui'

export default function PublicView() {
  const [surveyNo, setSurveyNo] = useState('')
  const [village, setVillage] = useState('')
  const [ulpin, setUlpin] = useState('')
  const [tokenRef, setTokenRef] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [history, setHistory] = useState<Row[]>([])
  const [verification, setVerification] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : String(e))

  const search = async () => {
    setError('')
    try {
      setRows(await get<Row[]>(`/api/public/properties${qs({ surveyNo, village, ulpin, tokenRef })}`))
    } catch (e) {
      fail(e)
    }
  }

  const loadHistory = async (ref: string) => {
    setError('')
    setTokenRef(ref)
    try {
      setHistory(await get<Row[]>(`/api/public/tokens/${ref}/history`))
    } catch (e) {
      fail(e)
    }
  }

  const verify = async () => {
    setError('')
    try {
      setVerification(await post<Row>(`/api/tokens/${tokenRef}/verify`, {}))
    } catch (e) {
      fail(e)
    }
  }

  return (
    <>
      <Panel title="Public property search" actions={<button onClick={() => void search()}>Search</button>}>
        <p className="muted">
          Public records exclude Aadhaar, consideration, contact details and rule-check findings.
        </p>
        <Banner kind="error" message={error} />
        <div className="row">
          <Field label="Survey no" value={surveyNo} onChange={setSurveyNo} />
          <Field label="Village code" value={village} onChange={setVillage} />
          <Field label="ULPIN" value={ulpin} onChange={setUlpin} />
          <Field label="Token reference" value={tokenRef} onChange={setTokenRef} />
        </div>
        <DataTable
          rows={rows}
          onRowClick={(row) => void loadHistory(String(row.token_ref))}
          columns={[
            { key: 'property_ref', label: 'Property' },
            { key: 'ulpin', label: 'ULPIN' },
            { key: 'survey_no', label: 'Survey no' },
            { key: 'village_code', label: 'Village' },
            { key: 'extent_value', label: 'Extent' },
            { key: 'token_ref', label: 'Token' },
            { key: 'token_status', label: 'Token status' },
          ]}
          empty="No public records match."
        />
      </Panel>

      <Panel
        title="Token history and verification"
        actions={
          storedToken() === null ? null : (
            <button className="primary" disabled={tokenRef.length === 0} onClick={() => void verify()}>
              Verify token integrity
            </button>
          )
        }
      >
        <DataTable
          rows={history}
          columns={[
            { key: 'state_version', label: 'Version' },
            { key: 'operation', label: 'Operation' },
            { key: 'owner_set_hash_hex', label: 'Owner-set hash' },
            { key: 'state_hash_hex', label: 'State hash' },
            { key: 'onchain_tx_hash', label: 'On-chain tx' },
            { key: 'recorded_at', label: 'Recorded' },
          ]}
          empty="Select a property or enter a token reference."
        />
        {verification === null ? null : (
          <dl className="kv">
            <dt>Outcome</dt>
            <dd>
              <b>{formatCell(verification.outcome)}</b>
            </dd>
            <dt>Current ownership matches token</dt>
            <dd>{formatCell(verification.currentOwnershipMatchesToken)}</dd>
            <dt>Token state version</dt>
            <dd>{formatCell(verification.stateVersion)}</dd>
          </dl>
        )}
      </Panel>
    </>
  )
}

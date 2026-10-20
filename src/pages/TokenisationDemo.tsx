import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ApiError, get } from '../api'
import { type Row } from '../types'
import { Banner, DataTable, Field, Panel } from '../ui'
import TokenLedgerPanel from './TokenLedgerPanel'

const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : [])
const tabs = ['Overview & metrics', 'Parcel NFT explorer', 'Title verification (QR)'] as const

/** Tokenisation showcase on the local Hyperledger Fabric network (Registration, Revenue, Survey). */
export default function TokenisationDemo() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState(params.get('token') ? 1 : 0)
  const [metrics, setMetrics] = useState<Row | null>(null)
  const [tokenInput, setTokenInput] = useState(params.get('token') ?? '')
  const [tokenRef, setTokenRef] = useState(params.get('token') ?? '')
  const [documentNo, setDocumentNo] = useState('')
  const [verify, setVerify] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setMetrics(await get<Row>('/api/tokens/metrics/summary'))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tokens = (metrics?.tokens ?? {}) as Row

  return (
    <div className="intake-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Hyperledger Fabric · local permissioned network</span>
          <h1>Land tokenisation</h1>
          <p className="muted">Each parcel is a unique NFT in registry custody, listing its current owners as pseudonymous holder ids, with title, geo-location and encumbrance hashes, managed by the slateland chaincode. Organisations: Registration, Revenue, Survey.</p>
        </div>
      </div>
      <Banner kind="error" message={error} />
      <div className="property-stage-tabs" role="tablist" aria-label="Tokenisation sections">
        {tabs.map((t, i) => (
          <button type="button" role="tab" aria-selected={tab === i} className={tab === i ? 'active' : ''} key={t} onClick={() => setTab(i)}>
            <span className="property-tab-marker" aria-hidden="true">{i + 1}</span>
            <span className="property-tab-copy"><strong>{t}</strong></span>
          </button>
        ))}
      </div>

      {tab === 0 && metrics ? <>
        <div className="stat-grid">
          <div className="stat-card"><span>Ledger</span><strong>{metrics.connected ? 'Connected' : 'Not connected'}</strong><small>block height {String(metrics.blockHeight ?? '—')}</small></div>
          <div className="stat-card"><span>Parcel NFTs</span><strong>{String(tokens.total ?? 0)}</strong><small>{String(tokens.active ?? 0)} active · {String(tokens.child_tokens ?? 0)} from splits</small></div>
          <div className="stat-card"><span>Fractional parcels</span><strong>{String(tokens.fractional ?? 0)}</strong><small>more than one holder</small></div>
          <div className="stat-card"><span>Avg time to ledger</span><strong>{String(metrics.avgAnchorSeconds ?? '—')} s</strong><small>queue to committed block</small></div>
        </div>
        <div className="form-grid two">
          <Panel title="Ledger transactions by status">
            <DataTable rows={rows(metrics.ledgerTransactions)} columns={[{ key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }]} />
          </Panel>
          <Panel title="Committed transactions by organisation">
            <DataTable rows={rows(metrics.byOrg)} columns={[{ key: 'org_msp', label: 'Organisation' }, { key: 'count', label: 'Count' }]} />
          </Panel>
          <Panel title="Fraud and rule violations blocked by chaincode">
            <DataTable rows={rows(metrics.rejectedByRule)} columns={[{ key: 'rule', label: 'Rule' }, { key: 'count', label: 'Blocked' }]} empty="None yet. Try the double-sale demo in the explorer." />
          </Panel>
          <Panel title="Encumbrances">
            <DataTable rows={rows(metrics.encumbrances)} columns={[{ key: 'enc_type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'count', label: 'Count' }]} />
          </Panel>
        </div>
      </> : null}

      {tab === 1 ? <>
        <Panel title="Open a parcel NFT">
          <div className="form-grid three">
            <Field label="Token reference (e.g. SLATE-TN-00000001)" value={tokenInput} onChange={setTokenInput} />
            <div className="panel-actions">
              <button type="button" className="primary" disabled={!tokenInput.trim()} onClick={() => { setTokenRef(tokenInput.trim()); setParams({ token: tokenInput.trim() }) }}>Open</button>
            </div>
          </div>
        </Panel>
        {tokenRef ? <TokenLedgerPanel key={tokenRef} tokenRef={tokenRef} showDemo /> : null}
      </> : null}

      {tab === 2 ? <Panel title="Instant title verification">
        <p className="muted">The certificate QR opens the public verify page, which compares the deed hash in SLATE with the hash on the Fabric ledger.</p>
        <div className="form-grid three">
          <Field label="Document number (e.g. 000005/2026)" value={documentNo} onChange={setDocumentNo} />
          <div className="panel-actions">
            <button type="button" className="primary" disabled={!documentNo.trim()} onClick={() => void get<Row>(`/api/public/verify?documentNo=${encodeURIComponent(documentNo.trim())}`).then(setVerify, (e: unknown) => setError(String(e)))}>Verify</button>
            {documentNo.trim() ? <a className="button" href={`/verify?documentNo=${encodeURIComponent(documentNo.trim())}`} target="_blank" rel="noreferrer">Open public page</a> : null}
          </div>
        </div>
        {verify ? <DataTable rows={Object.entries(verify).filter(([, v]) => typeof v !== 'object' || v === null).map(([k, v]) => ({ field: k, value: v }))} columns={[{ key: 'field', label: 'Field' }, { key: 'value', label: 'Value' }]} /> : null}
      </Panel> : null}
    </div>
  )
}

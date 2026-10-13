import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ApiError, get } from '../api'
import { type Row } from '../types'
import { Banner, DataTable, Field, Panel } from '../ui'
import TokenLedgerPanel from './TokenLedgerPanel'

const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : [])
const tabs = ['Overview & metrics', 'Parcel NFT explorer', 'Fractional ownership', 'Title verification (QR)'] as const

/** Tokenisation showcase on the local Hyperledger Fabric network (Registration, Revenue, Survey). */
export default function TokenisationDemo() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState(params.get('token') ? 1 : 0)
  const [metrics, setMetrics] = useState<Row | null>(null)
  const [tokenInput, setTokenInput] = useState(params.get('token') ?? '')
  const [tokenRef, setTokenRef] = useState(params.get('token') ?? '')
  const [owners, setOwners] = useState('Meena Rajan:50\nKarthik Raja:25\nDivya Menon:25')
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

  const parsed = owners.split('\n').map((l) => l.split(':')).filter((p) => p[0]?.trim())
  const total = parsed.reduce((sum, p) => sum + (Number(p[1]) || 0), 0)
  const equal = total !== 100 || parsed.some((p) => !(Number(p[1]) > 0))
  const units = parsed.map((p) => (equal ? Math.floor(10000 / parsed.length) : Math.round(Number(p[1]) * 100)))
  if (units.length > 0) units[0] += 10000 - units.reduce((a, b) => a + b, 0)
  const tokens = (metrics?.tokens ?? {}) as Row

  return (
    <div className="intake-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Hyperledger Fabric · local permissioned network</span>
          <h1>Land tokenisation</h1>
          <p className="muted">Each parcel is a unique NFT in registry custody, with fractional share units, title, geo-location and encumbrance hashes, managed by the slateland chaincode. Organisations: Registration, Revenue, Survey.</p>
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

      {tab === 2 ? <Panel title="Fractional ownership / inheritance calculator">
        <p className="muted">One owner per line as <code>Name:percent</code>. Shares that don't add up to 100 are split equally (as for legal heirs). Only the pseudonymous holder id and units go on the ledger.</p>
        <label className="field"><span>Owners</span><textarea rows={5} value={owners} onChange={(e) => setOwners(e.target.value)} /></label>
        <DataTable rows={parsed.map((p, i) => ({ owner: p[0].trim(), units: units[i], share: `${(units[i] / 100).toFixed(2)}%` }))} columns={[
          { key: 'owner', label: 'Owner' }, { key: 'units', label: 'Share units' }, { key: 'share', label: 'Share' },
        ]} />
        <p className="muted">{equal ? 'Split equally: shares missing or not totalling 100%.' : 'Units follow the given percentages.'} Total: 10,000 units.</p>
      </Panel> : null}

      {tab === 3 ? <Panel title="Instant title verification">
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

import { useCallback, useEffect, useState } from 'react'

import { ApiError, get, post } from '../api'
import { useAuth } from '../auth'
import { str, type Row } from '../types'
import { Banner, DataTable, Field, Panel, StatusPill } from '../ui'

const ENC_TYPES = ['MORTGAGE', 'LEASE', 'COURT_ATTACHMENT'] as const
const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : [])
const short = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value)
  return text.length > 18 ? `${text.slice(0, 10)}…${text.slice(-6)}` : text || '—'
}

/** The parcel NFT on the Hyperledger Fabric ledger: holders, metadata, encumbrances, rule check and ledger history. */
export default function TokenLedgerPanel({ tokenRef, showDemo = false }: { tokenRef: string; showDemo?: boolean }) {
  const { user } = useAuth()
  const [view, setView] = useState<Row | null>(null)
  const [check, setCheck] = useState<Row | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [enc, setEnc] = useState({ type: 'MORTGAGE', holderName: '', documentRef: '', amount: '' })
  const [release, setRelease] = useState<Record<string, string>>({})
  const [demo, setDemo] = useState<Row | null>(null)
  const roles = user?.roles ?? []
  const isRegistration = roles.includes('REGISTRATION_OFFICER') || roles.includes('SRO')
  const isRevenue = roles.includes('VAO') || roles.includes('TAHSILDAR')
  const canEncumber = isRegistration || isRevenue
  const path = `/api/tokens/${encodeURIComponent(tokenRef)}`

  const load = useCallback(async () => {
    setError('')
    try {
      setView(await get<Row>(`${path}/ledger`))
      setCheck(await get<Row>(`${path}/transfer-check`))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    }
  }, [path])

  useEffect(() => {
    if (tokenRef) void load()
  }, [load, tokenRef])

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(done)
      window.setTimeout(() => void load(), 6000)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!tokenRef) return <p className="muted">This property has no token yet. It is minted on the ledger at registration.</p>
  if (!view) return <><Banner kind="error" message={error} /><p className="muted">Loading ledger…</p></>

  const parcel = (view.parcel ?? null) as Row | null
  const meta = ((view.metadata as Row | undefined)?.metadata ?? null) as Row | null
  const owners = rows(view.owners)
  const holders = (Array.isArray(parcel?.holders) ? parcel.holders : Array.isArray(meta?.holders) ? meta.holders : []) as string[]
  const holderRows: Row[] = holders.map((holder) => {
    const owner = owners.find((o) => o.holder_hash === holder)
    return { holder: owner ? str(owner, 'owner_name') : 'Previous holder', holder_hash: holder }
  })
  const integrity = String(view.integrity ?? '')
  const integrityKind = integrity === 'MATCH' ? 'success' : integrity === 'MISMATCH' ? 'error' : 'info'
  const encTypes = isRegistration ? ENC_TYPES : (['COURT_ATTACHMENT'] as const)

  return (
    <>
      <Banner kind="error" message={error} />
      <Banner kind="success" message={notice} />
      <Panel title="Parcel NFT on Hyperledger Fabric" actions={<button type="button" onClick={() => void load()} disabled={busy}>Refresh</button>}>
        <div className="form-grid three">
          <Field label="Token (NFT id)" value={tokenRef} onChange={() => undefined} readOnly />
          <Field label="Ledger" value={view.connected ? `channel ${str(view, 'channel')} · chaincode ${str(view, 'chaincode')} · block height ${str(view, 'blockHeight')}` : 'Not connected'} onChange={() => undefined} readOnly />
          <Field label="Custody" value={String(parcel?.custodian ?? meta?.custody ?? '—')} onChange={() => undefined} readOnly />
          <Field label="Status on ledger" value={String(parcel?.status ?? 'Not on ledger yet')} onChange={() => undefined} readOnly />
          <Field label="Version (ledger / SLATE)" value={`${String(parcel?.version ?? '—')} / ${str(view, 'dbStateVersion')}`} onChange={() => undefined} readOnly />
          <Field label="Last operation" value={parcel ? `${String(parcel.lastOperation ?? '')} by ${String(parcel.lastOrg ?? '')}` : '—'} onChange={() => undefined} readOnly />
          <Field label="State hash" value={short(parcel?.stateHash ?? view.dbStateHash)} onChange={() => undefined} readOnly />
          <Field label="Metadata hash (title, owners, survey)" value={short(parcel?.metadataHash)} onChange={() => undefined} readOnly />
          <Field label="Geo-location hash" value={short(parcel?.geoHash)} onChange={() => undefined} readOnly />
        </div>
        <Banner kind={integrityKind} message={integrity === 'MATCH' ? 'Integrity: SLATE record matches the ledger.' : integrity === 'MISMATCH' ? 'Integrity: SLATE record does NOT match the ledger. Possible tampering.' : `Integrity: ${integrity.replace(/_/g, ' ').toLowerCase()}.`} />
      </Panel>

      <Panel title="Owners on the ledger">
        <DataTable rows={holderRows} columns={[
          { key: 'holder', label: 'Owner (off-chain)' },
          { key: 'holder_hash', label: 'Pseudonymous holder id on ledger', render: (r) => short(r.holder_hash) },
        ]} empty="No owners recorded on the ledger yet." />
      </Panel>

      <Panel title="Transfer rule check (mock court and revenue rules)">
        {check ? <>
          <Banner kind={check.allowed ? 'success' : 'error'} message={check.allowed ? 'Transfer allowed.' : 'Transfer blocked.'} />
          <DataTable rows={rows(check.checks)} columns={[
            { key: 'code', label: 'Check' },
            { key: 'status', label: 'Result', render: (r) => <StatusPill status={str(r, 'status')} /> },
            { key: 'source', label: 'Source' },
            { key: 'message', label: 'Detail' },
          ]} />
        </> : null}
      </Panel>

      <Panel title="Encumbrances">
        <DataTable rows={rows(view.encumbrances)} columns={[
          { key: 'enc_ref', label: 'Reference' },
          { key: 'enc_type', label: 'Type' },
          { key: 'holder_name', label: 'Holder' },
          { key: 'document_ref', label: 'Document' },
          { key: 'amount', label: 'Amount' },
          { key: 'org_msp', label: 'Recorded by' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={str(r, 'status')} /> },
          { key: 'ledger_status', label: 'Ledger' },
          { key: 'action', label: '', render: (r) => r.status === 'ACTIVE' && canEncumber ? (
            <span className="inline-actions">
              <input aria-label="Release document" placeholder="Release document no" value={release[str(r, 'enc_ref')] ?? ''} onChange={(e) => setRelease({ ...release, [str(r, 'enc_ref')]: e.target.value })} />
              <button type="button" disabled={busy || !(release[str(r, 'enc_ref')] ?? '').trim()} onClick={() => void run(() => post(`${path}/encumbrances/${encodeURIComponent(str(r, 'enc_ref'))}/release`, { releaseDocumentRef: release[str(r, 'enc_ref')] }, true), 'Encumbrance released.')}>Release</button>
            </span>) : null },
        ]} empty="No encumbrances." />
        {canEncumber && parcel?.status !== 'SUPERSEDED' && parcel?.status !== 'INACTIVE' ? (
          <div className="form-grid four">
            <label className="field"><span>Type</span>
              <select value={enc.type} onChange={(e) => setEnc({ ...enc, type: e.target.value })}>
                {encTypes.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </label>
            <Field label="Holder (lender, lessee or court)" value={enc.holderName} onChange={(v) => setEnc({ ...enc, holderName: v })} />
            <Field label="Document no" value={enc.documentRef} onChange={(v) => setEnc({ ...enc, documentRef: v })} />
            <Field label="Amount (optional)" value={enc.amount} onChange={(v) => setEnc({ ...enc, amount: v.replace(/[^0-9.]/g, '') })} />
            <div className="panel-actions">
              <button type="button" className="primary" disabled={busy || !enc.holderName.trim() || !enc.documentRef.trim()}
                onClick={() => void run(() => post(`${path}/encumbrances`, { type: isRegistration ? enc.type : 'COURT_ATTACHMENT', holderName: enc.holderName, documentRef: enc.documentRef, amount: enc.amount ? Number(enc.amount) : null }, true).then(() => setEnc({ type: 'MORTGAGE', holderName: '', documentRef: '', amount: '' })), 'Encumbrance recorded. It is written to the ledger within a few seconds.')}>Add encumbrance</button>
            </div>
          </div>
        ) : null}
      </Panel>

      {showDemo ? (
        <Panel title="Fraud demo: double sale">
          <p className="muted">Sends a second transfer of this parcel at an already-used version, as a duplicate sale would. The chaincode must reject it; nothing changes.</p>
          <button type="button" disabled={busy || !view.connected} onClick={() => void run(async () => setDemo(await post<Row>(`${path}/demo/double-sale`, {}, true)), 'Double-sale attempt sent to the ledger.')}>Try double sale</button>
          {demo ? <Banner kind={demo.rejected ? 'success' : 'error'} message={demo.rejected ? `Rejected by chaincode: ${str(demo, 'reason')}` : `NOT rejected (tx ${str(demo, 'txId')})`} /> : null}
        </Panel>
      ) : null}

      <Panel title="Ledger transactions (SLATE queue)">
        <DataTable rows={rows(view.transactions)} columns={[
          { key: 'chaincode_function', label: 'Chaincode function', render: (r) => str(r, 'chaincode_function') || str(r, 'function_name') },
          { key: 'operation', label: 'Operation' },
          { key: 'org_msp', label: 'Signed by' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={str(r, 'status')} /> },
          { key: 'block_number', label: 'Block' },
          { key: 'tx_id', label: 'Fabric tx id', render: (r) => short(r.tx_id) },
          { key: 'error_message', label: 'Reason' },
        ]} empty="No ledger transactions." />
      </Panel>

      <Panel title="Ownership history on the ledger">
        <DataTable rows={rows(view.ledgerHistory).map((h) => ({ ...(h.value as Row ?? {}), txId: h.txId, timestamp: h.timestamp }))} columns={[
          { key: 'timestamp', label: 'Time' },
          { key: 'version', label: 'Version' },
          { key: 'status', label: 'Status' },
          { key: 'lastOperation', label: 'Operation' },
          { key: 'lastOrg', label: 'Organisation' },
          { key: 'holders', label: 'Holders', render: (r) => String(Array.isArray(r.holders) ? r.holders.length : Object.keys((r.shares ?? {}) as Row).length) },
          { key: 'txId', label: 'Fabric tx id', render: (r) => short(r.txId) },
        ]} empty="No ledger history (ledger not connected or parcel not yet on ledger)." />
      </Panel>
    </>
  )
}

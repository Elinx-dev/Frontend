import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { get } from '../api'
import type { Row } from '../types'
import { Banner, Panel, formatCell } from '../ui'

const LABELS: Record<string, string> = {
  VERIFIED: 'Verified on blockchain',
  MISMATCH: 'Does not match the blockchain',
  NOT_ANCHORED: 'Not yet recorded on blockchain',
  NOT_CONFIGURED: 'Blockchain not connected',
}

function Status({ value }: { value: unknown }) {
  const v = String(value ?? '')
  const tone = v === 'VERIFIED' ? 'ok' : v === 'MISMATCH' ? 'bad' : 'warn'
  return <span className={`verify-badge verify-${tone}`}>{LABELS[v] ?? v}</span>
}

export default function VerifyCertificate() {
  const [search] = useSearchParams()
  const documentNo = search.get('doc') ?? search.get('documentNo') ?? ''
  const [data, setData] = useState<Row | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get<Row>(`/api/public/verify?documentNo=${encodeURIComponent(documentNo)}`).then(setData, (e: unknown) => setError(String(e)))
  }, [documentNo])

  return (
    <div className="verify-page">
      <Panel title="Verify registration certificate">
        {error ? <Banner kind="error" message={error} /> : null}
        {!data && !error ? <p>Checking…</p> : null}
        {data ? (
          <dl className="certificate-fields">
            <dt>Document no</dt><dd>{formatCell(data.registered_document_no)}</dd>
            <dt>Registration date</dt><dd>{formatCell(data.registration_date)}</dd>
            <dt>Registering SRO</dt><dd>{formatCell(data.registering_sro)}</dd>
            <dt>Property</dt><dd>{formatCell(data.property_ref)} ({formatCell(data.property_status)})</dd>
            <dt>Token</dt><dd>{formatCell(data.token_ref)} ({formatCell(data.token_status)})</dd>
            <dt>Deed</dt><dd><Status value={data.deedStatus} /></dd>
            <dt>Property token</dt><dd><Status value={data.tokenStatusOnChain} /></dd>
            <dt>Deed SHA-256</dt><dd className="mono">{formatCell(data.deed_sha256)}</dd>
          </dl>
        ) : null}
      </Panel>
    </div>
  )
}

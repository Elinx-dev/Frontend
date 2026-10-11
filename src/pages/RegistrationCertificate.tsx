import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'

import { get } from '../api'
import type { Row } from '../types'
import { Banner, Panel, formatCell } from '../ui'

function hexHash(value: unknown): string {
  const text = String(value ?? '')
  if (!text || text.startsWith('0x')) return text
  try {
    return '0x' + Array.from(atob(text), (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  } catch {
    return text
  }
}

export default function RegistrationCertificate() {
  const { txnRef = '' } = useParams()
  const [txn, setTxn] = useState<Row | null>(null)
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    get<Row>(`/api/transactions/${encodeURIComponent(txnRef)}`).then(setTxn, (e: unknown) => setError(String(e)))
  }, [txnRef])

  const result = ((txn?.registrationResult as Row[] | undefined) ?? [])[0]
  const documentNo = result ? String(result.registered_document_no) : ''
  const verifyUrl = documentNo ? `${window.location.origin}/verify?doc=${encodeURIComponent(documentNo)}` : ''

  useEffect(() => {
    if (verifyUrl) void QRCode.toDataURL(verifyUrl, { width: 180, margin: 1 }).then(setQr)
  }, [verifyUrl])

  if (error) return <Banner kind="error" message={error} />
  if (!txn) return <p>Loading…</p>
  if (!result) return <Banner kind="error" message="This transaction is not registered yet." />

  return (
    <div className="certificate-page">
      <div className="certificate-actions no-print">
        <Link to={`/transactions/${encodeURIComponent(txnRef)}`}>← Back to transaction</Link>
        <button className="primary" onClick={() => window.print()}>Print</button>
      </div>
      <Panel title="Certificate of Registration">
        <div className="certificate">
          <dl className="certificate-fields">
            <dt>Document no</dt><dd>{documentNo}</dd>
            <dt>Registration date</dt><dd>{formatCell(result.registration_date)}</dd>
            <dt>Registering SRO</dt><dd>{formatCell(result.registering_sro)}</dd>
            <dt>Transaction</dt><dd>{txnRef}</dd>
            <dt>Property</dt><dd>{formatCell((txn.property as Row | undefined)?.property_ref)}</dd>
            <dt>Deed type</dt><dd>{formatCell(txn.deed_type_code)}</dd>
            <dt>Deed SHA-256</dt><dd className="mono">{hexHash(result.deed_sha256)}</dd>
          </dl>
          <figure className="certificate-qr">
            {qr ? <img src={qr} alt={`QR code to verify ${documentNo}`} /> : null}
            <figcaption>Scan to verify on the SLATE blockchain</figcaption>
          </figure>
        </div>
      </Panel>
    </div>
  )
}

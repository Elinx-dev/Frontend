import { useState } from 'react'

import { ApiError } from '../api'
import { Banner } from '../ui'
import { VaoModal } from './vao/VaoUi'

export type ActionDialogRequest = {
  title: string
  message: string
  confirmLabel: string
  /** When set, a comment box is shown and must be filled in. */
  reasonLabel?: string
  danger?: boolean
  onConfirm: (reason: string) => Promise<void>
}

export default function ActionDialog({ request, onClose }: { request: ActionDialogRequest; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reasonLabel = request.reasonLabel

  const confirm = async () => {
    if (reasonLabel !== undefined && reason.trim() === '') {
      setError(`Enter the ${reasonLabel.toLowerCase()}.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      await request.onConfirm(reason.trim())
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <VaoModal title={request.title} onClose={busy ? () => undefined : onClose}>
      <p className="vao-modal-meta">{request.message}</p>
      <Banner kind="error" message={error} />
      {reasonLabel !== undefined ? (
        <label className="field">
          <span>
            {reasonLabel}
            <b className="req"> *</b>
          </span>
          <textarea rows={4} value={reason} autoFocus onChange={(e) => setReason(e.target.value)} />
        </label>
      ) : null}
      <div className="action-dialog-buttons">
        <button type="button" className="outline" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className={request.danger ? 'danger' : 'primary'} disabled={busy} onClick={() => void confirm()}>
          {busy ? 'Please wait…' : request.confirmLabel}
        </button>
      </div>
    </VaoModal>
  )
}

import { useState } from 'react'

import { ApiError, post } from '../api'

export interface AadhaarProfile {
  name: string
  address: string
  mobile: string
  gender?: string
  dateOfBirth?: string
  careOf?: string
  aadhaarLast4?: string
}

/**
 * Aadhaar OTP e-KYC: enter the Aadhaar number, send the OTP, enter the 6-digit OTP and validate it.
 * The verified Aadhaar profile is handed back to fill the form.
 */
export default function AadhaarEkyc({ aadhaarNumber, verified, disabled = false, onAadhaarChange, onVerified }: {
  aadhaarNumber: string
  verified: boolean
  disabled?: boolean
  onAadhaarChange: (value: string) => void
  onVerified: (profile: AadhaarProfile, aadhaarNumber: string) => void
}) {
  const [ekycRef, setEkycRef] = useState('')
  const [otp, setOtp] = useState('')
  const [demoOtp, setDemoOtp] = useState('')
  const [masked, setMasked] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = /^[2-9]\d{11}$/.test(aadhaarNumber)

  const sendOtp = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await post<{ ekycRef: string; demoOtp?: string; maskedTarget?: string }>('/api/aadhaar/ekyc/otp', { aadhaarNumber })
      setEkycRef(result.ekycRef)
      setDemoOtp(result.demoOtp ?? '')
      setMasked(result.maskedTarget ?? '')
      setOtp('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const validateOtp = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await post<{ profile: AadhaarProfile }>('/api/aadhaar/ekyc/verify', { ekycRef, otp })
      onVerified(result.profile, aadhaarNumber)
      setEkycRef('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (verified) {
    return (
      <div className="ekyc-box verified">
        <span className="ekyc-ok">Aadhaar verified · XXXX-XXXX-{aadhaarNumber.slice(-4)}</span>
        {disabled ? null : (
          <button type="button" className="outline" onClick={() => onAadhaarChange('')}>Change Aadhaar</button>
        )}
      </div>
    )
  }

  return (
    <div className="ekyc-box">
      <div className="ekyc-row">
        <label className="field">
          <span>Aadhaar number<b className="req"> *</b></span>
          <input
            type="text"
            inputMode="numeric"
            value={aadhaarNumber}
            disabled={disabled || busy || ekycRef.length > 0}
            placeholder="12-digit Aadhaar"
            onChange={(event) => onAadhaarChange(event.target.value.replace(/\D/g, '').slice(0, 12))}
          />
        </label>
        {ekycRef.length === 0 ? (
          <button type="button" className="primary" disabled={disabled || busy || !valid} onClick={() => void sendOtp()}>
            {busy ? 'Sending…' : 'Validate Aadhaar (send OTP)'}
          </button>
        ) : (
          <>
            <label className="field">
              <span>6-digit OTP<b className="req"> *</b></span>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                disabled={busy}
                placeholder="______"
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button type="button" className="primary" disabled={busy || otp.length !== 6} onClick={() => void validateOtp()}>
              {busy ? 'Validating…' : 'Validate OTP'}
            </button>
            <button type="button" className="outline" disabled={busy} onClick={() => setEkycRef('')}>Cancel</button>
          </>
        )}
      </div>
      {ekycRef.length > 0 ? (
        <p className="helper">
          OTP sent to the mobile linked with {masked || 'this Aadhaar'}.
          {demoOtp ? <> Mock Aadhaar service OTP: <b className="mono">{demoOtp}</b></> : null}
        </p>
      ) : (
        <p className="helper">Name, address and mobile are filled from the Aadhaar record after the OTP is validated.</p>
      )}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}

export function AadhaarProfileFacts({ profile, extra }: { profile: { name: string; address: string; mobile: string }; extra?: React.ReactNode }) {
  return (
    <div className="vao-facts ekyc-facts">
      <div className="vao-fact"><span>Name (from Aadhaar)</span><strong>{profile.name || '—'}</strong></div>
      <div className="vao-fact"><span>Mobile (from Aadhaar)</span><strong>{profile.mobile || '—'}</strong></div>
      <div className="vao-fact"><span>Address (from Aadhaar)</span><strong>{profile.address || '—'}</strong></div>
      {extra}
    </div>
  )
}

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ApiError, post } from '../api'
import { encryptPassword } from '../passwordCrypto'
import { Banner, Field } from '../ui'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/

export default function ResetPassword() {
  const [searchParams, setSearchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (token.length === 0) {
      setError('This password reset link is invalid.')
      return
    }
    if (!PASSWORD_PATTERN.test(password)) {
      setError('Password must be 8-128 characters and include uppercase, lowercase, number and symbol.')
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const encryptedPassword = await encryptPassword(password)
      await post('/api/auth/password-reset/confirm', { token, encryptedPassword })
      setComplete(true)
      setSearchParams({}, { replace: true })
      setPassword('')
      setConfirmation('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Set new password</h1>
        <Banner kind="error" message={error} />
        <Banner kind="success" message={complete ? 'Password updated. Sign in with your new password.' : ''} />
        {complete ? (
          <div className="auth-links">
            <Link to="/login">Continue to sign in</Link>
          </div>
        ) : (
          <>
            <p className="muted">Use 8-128 characters with uppercase, lowercase, number and symbol.</p>
            <Field label="New password" value={password} onChange={setPassword} type="password" required />
            <Field
              label="Confirm new password"
              value={confirmation}
              onChange={setConfirmation}
              type="password"
              required
            />
            <button className="primary" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

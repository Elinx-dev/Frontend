import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, post } from '../api'
import type { PasswordResetResponse } from '../types'
import { Banner, Field } from '../ui'

export default function ForgotPassword() {
  const [loginId, setLoginId] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<PasswordResetResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (loginId.trim().length === 0) {
      setError('Username or email is required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      setResult(await post<PasswordResetResponse>('/api/auth/password-reset/request', { loginId: loginId.trim() }))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Reset password</h1>
        <p className="muted">Enter your username or registered email address.</p>
        <Banner kind="error" message={error} />
        <Banner kind="success" message={result?.message ?? ''} />
        {result === null ? (
          <>
            <Field label="Username or email" value={loginId} onChange={setLoginId} required />
            <button className="primary" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        ) : null}
        {result?.demoResetUrl === undefined ? null : (
          <a className="auth-demo-link" href={result.demoResetUrl}>
            Open local demo reset link
          </a>
        )}
        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}

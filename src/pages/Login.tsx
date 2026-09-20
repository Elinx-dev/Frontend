import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError } from '../api'
import { homeRouteFor, useAuth } from '../auth'
import type { LoginResponse } from '../types'
import { Banner, Field } from '../ui'

const DEMO_USERS = [
  ['ro.adyar', 'Sub-Registrar, Adyar (TN)'],
  ['ro.sholinganallur', 'Sub-Registrar, Sholinganallur (TN)'],
  ['surveyor.sholinganallur', 'Surveyor (TN)'],
  ['vao.perungudi', 'Village Administrative Officer (TN)'],
  ['tahsildar.sholinganallur', 'Tahsildar (TN)'],
  ['admin.state', 'State Administrator (TN)'],
  ['viewer.public', 'Public viewer (TN)'],
  ['ro.begur', 'Sub-Registrar, Begur (KA)'],
]

export default function Login() {
  const { login, verifyMfa } = useAuth()
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('ro.adyar')
  const [password, setPassword] = useState('Slate@123')
  const [challenge, setChallenge] = useState<LoginResponse | null>(null)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : String(e))

  const submitPassword = async () => {
    if (loginId.trim().length === 0 || password.length === 0) {
      setError('Username/email and password are required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await login(loginId.trim(), password)
      if (result.mfaRequired === true) {
        setChallenge(result)
        return
      }
      if (result.user === undefined) {
        throw new Error('Login response did not include a user profile.')
      }
      navigate(homeRouteFor(result.user))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const submitOtp = async () => {
    if (challenge?.challengeId === undefined || !/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit verification code.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const profile = await verifyMfa(challenge.challengeId, otp)
      navigate(homeRouteFor(profile))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>SLATE</h1>
        <p className="muted">Secure Land Administration &amp; Title Exchange — pilot environment</p>
        <Banner kind="error" message={error} />
        {challenge === null ? (
          <>
            <Field label="Username or email" value={loginId} onChange={setLoginId} required />
            <Field label="Password" value={password} onChange={setPassword} type="password" required />
            <button className="primary" disabled={busy} onClick={() => void submitPassword()}>
              {busy ? 'Checking credentials…' : 'Continue'}
            </button>
            <div className="auth-links">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <details className="demo-users">
              <summary>Demo accounts (password <code>Slate@123</code>)</summary>
              <ul>
                {DEMO_USERS.map(([name, role]) => (
                  <li key={name}>
                    <button className="link" onClick={() => setLoginId(name)}>
                      {name}
                    </button>{' '}
                    — {role}
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : (
          <>
            <p className="auth-note">
              A verification code was sent to <strong>{challenge.maskedEmail ?? 'your registered email'}</strong>.
            </p>
            {challenge.demoOtp === undefined ? null : (
              <Banner kind="info" message={`Local demo verification code: ${challenge.demoOtp}`} />
            )}
            <Field
              label="Email verification code"
              value={otp}
              onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              required
            />
            <button className="primary" disabled={busy || otp.length !== 6} onClick={() => void submitOtp()}>
              {busy ? 'Verifying…' : 'Verify and sign in'}
            </button>
            <button
              className="link"
              onClick={() => {
                setChallenge(null)
                setOtp('')
                setError('')
              }}
            >
              Use a different account
            </button>
          </>
        )}
        <p className="muted">
          <Link to="/public">Continue to the public property search without signing in</Link>
        </p>
      </div>
    </div>
  )
}

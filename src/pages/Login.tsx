import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../api'
import { homeRouteFor, useAuth } from '../auth'
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
  const { login, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('ro.adyar')
  const [password, setPassword] = useState('Slate@123')
  const [challengeId, setChallengeId] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : String(e))

  const submitPassword = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await login(username, password)
      if (result.mfaRequired === true && typeof result.challengeId === 'string') {
        setChallengeId(result.challengeId)
      } else if (result.user !== undefined) {
        navigate(homeRouteFor(result.user))
      }
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const submitOtp = async () => {
    setBusy(true)
    setError('')
    try {
      const profile = await verifyOtp(challengeId, otp)
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
        {challengeId.length === 0 ? (
          <>
            <Field label="Username" value={username} onChange={setUsername} required />
            <Field label="Password" value={password} onChange={setPassword} type="password" required />
            <button className="primary" disabled={busy} onClick={submitPassword}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        ) : (
          <>
            <p>An OTP has been sent to the registered mobile number. Demo OTP: <code>123456</code>.</p>
            <Field label="One-time password" value={otp} onChange={setOtp} required />
            <button className="primary" disabled={busy} onClick={submitOtp}>
              {busy ? 'Verifying…' : 'Verify OTP'}
            </button>
            <button className="link" onClick={() => setChallengeId('')}>
              Use a different account
            </button>
          </>
        )}
        <details className="demo-users">
          <summary>Demo accounts (password <code>Slate@123</code>)</summary>
          <ul>
            {DEMO_USERS.map(([name, role]) => (
              <li key={name}>
                <button className="link" onClick={() => setUsername(name)}>
                  {name}
                </button>{' '}
                — {role}
              </li>
            ))}
          </ul>
        </details>
        <p className="muted">
          <a href="/public">Continue to the public property search without signing in</a>
        </p>
      </div>
    </div>
  )
}

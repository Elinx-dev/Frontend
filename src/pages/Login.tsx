import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError } from '../api'
import { homeRouteFor, useAuth } from '../auth'
import type { LoginResponse } from '../types'
import slateMark from '../assets/slate-mark-light.png'
import { AuthShell, Banner, Field } from '../ui'

const DEMO_USERS = [
  ['ro.adyar', 'Sub-Registrar, Adyar (TN)'],
  ['ro.sholinganallur', 'Sub-Registrar, Sholinganallur (TN)'],
  ['surveyor.sholinganallur', 'Surveyor (TN)'],
  ['vao.perungudi', 'Village Administrative Officer (TN)'],
  ['tahsildar.sholinganallur', 'Tahsildar (TN)'],
  ['admin.state', 'State Administrator (TN)'],
  ['central.admin', 'Central Administrator'],
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
    <AuthShell>
      <div className="login-card">
        <h1>Sign in to SLATE</h1>
        <Banner kind="error" message={error} />
        {challenge === null ? (
          <>
            <Field label="Username or email" value={loginId} onChange={setLoginId} icon={<UserIcon />} required />
            <Field label="Password" value={password} onChange={setPassword} type="password" icon={<LockIcon />} required />
            <button className="primary login-continue" disabled={busy} onClick={() => void submitPassword()}>
              {busy ? 'Checking credentials…' : (
                <>
                  <img src={slateMark} alt="" />
                  Continue
                  <ArrowIcon />
                </>
              )}
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
                    ({role})
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : (
          <>
            {challenge.otpChannel === 'SMS' ? (
              <p className="auth-note">
                A verification code was sent by SMS to your mobile <strong>{challenge.maskedMobile ?? 'registered mobile'}</strong>.
              </p>
            ) : challenge.emailOtp === false ? (
              <p className="auth-note">Email verification is switched off for your state (mock mode). Enter the mock verification code.</p>
            ) : (
              <p className="auth-note">
                A verification code was sent to <strong>{challenge.maskedEmail ?? 'your registered email'}</strong>.
              </p>
            )}
            {challenge.demoOtp === undefined ? null : (
              <Banner kind="info" message={`Local demo verification code: ${challenge.demoOtp}`} />
            )}
            <Field
              label={challenge.otpChannel === 'SMS' ? 'SMS verification code' : 'Email verification code'}
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
          <Link className="login-public-link" to="/public">
            Continue to the public property search without signing in <ExternalIcon />
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}

const iconProps = {
  viewBox: '0 0 24 24',
  width: 18,
  height: 18,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function UserIcon() {
  return (
    <svg className="field-icon" {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="field-icon" {...iconProps}>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg {...iconProps} width={14} height={14}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

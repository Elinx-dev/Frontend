import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  get,
  post,
  recordActivity,
  SESSION_EXPIRED_EVENT,
  storeToken,
  storedLastActivity,
  storedToken,
  storedTokenExpiry,
} from './api'
import { encryptPassword } from './passwordCrypto'
import type { Bootstrap, LoginResponse, UserProfile } from './types'

const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const REFRESH_WINDOW_MS = 2 * 60 * 1000
const SESSION_CHECK_MS = 30 * 1000

interface AuthState {
  user: UserProfile | null
  bootstrap: Bootstrap | null
  loading: boolean
  login: (loginId: string, password: string) => Promise<LoginResponse>
  verifyMfa: (challengeId: string, otp: string) => Promise<UserProfile>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function homeRouteFor(user: UserProfile): string {
  if (typeof user.homeRoute === 'string' && user.homeRoute.length > 0) {
    return user.homeRoute
  }
  if (user.roles.includes('SURVEYOR')) return '/surveyor'
  if (user.roles.includes('VAO')) return '/vao'
  if (user.roles.includes('TAHSILDAR')) return '/tahsildar'
  if (user.roles.includes('STATE_ADMIN')) return '/admin'
  if (user.roles.includes('REGISTRATION_OFFICER')) return '/ro'
  return '/public'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshInFlight = useRef(false)

  const clearSession = useCallback(() => {
    storeToken(null)
    setUser(null)
    setBootstrap(null)
  }, [])

  const loadBootstrap = useCallback(async () => {
    setBootstrap(await get<Bootstrap>('/api/config/bootstrap'))
  }, [])

  const acceptLogin = useCallback(async (result: LoginResponse): Promise<UserProfile> => {
    if (typeof result.accessToken !== 'string' || typeof result.expiresAt !== 'string') {
      throw new Error('Authentication response did not include a valid session.')
    }
    storeToken(result.accessToken, result.expiresAt)
    recordActivity()
    const profile = result.user ?? (await get<UserProfile>('/api/auth/me'))
    setUser(profile)
    await loadBootstrap()
    return profile
  }, [loadBootstrap])

  useEffect(() => {
    const token = storedToken()
    const lastActivity = storedLastActivity()
    if (token === null || (lastActivity !== null && Date.now() - lastActivity >= IDLE_TIMEOUT_MS)) {
      clearSession()
      setLoading(false)
      return
    }
    if (lastActivity === null) {
      recordActivity()
    }
    get<UserProfile>('/api/auth/me')
      .then(async (profile) => {
        setUser(profile)
        await loadBootstrap()
      })
      .catch(clearSession)
      .finally(() => setLoading(false))
  }, [clearSession, loadBootstrap])

  useEffect(() => {
    const expired = () => clearSession()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  }, [clearSession])

  useEffect(() => {
    if (user === null) return

    const activityEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']
    let lastRecordedActivity = storedLastActivity() ?? Date.now()
    const handleActivity = () => {
      const lastActivity = storedLastActivity()
      const now = Date.now()
      if (lastActivity !== null && now - lastActivity >= IDLE_TIMEOUT_MS) {
        clearSession()
        return
      }
      if (now - lastRecordedActivity >= 15_000) {
        recordActivity()
        lastRecordedActivity = now
      }
    }
    activityEvents.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }))

    const checkSession = window.setInterval(() => {
      const now = Date.now()
      const lastActivity = storedLastActivity()
      if (lastActivity === null || now - lastActivity >= IDLE_TIMEOUT_MS) {
        clearSession()
        return
      }
      const expiresAt = storedTokenExpiry()
      const recentlyActive = now - lastActivity <= REFRESH_WINDOW_MS
      if (recentlyActive && (expiresAt === null || expiresAt - now <= REFRESH_WINDOW_MS)
          && !refreshInFlight.current) {
        refreshInFlight.current = true
        post<LoginResponse>('/api/auth/refresh')
          .then((result) => {
            if (typeof result.accessToken !== 'string' || typeof result.expiresAt !== 'string') {
              throw new Error('Session refresh returned an invalid response.')
            }
            storeToken(result.accessToken, result.expiresAt)
            if (result.user !== undefined) setUser(result.user)
          })
          .catch(clearSession)
          .finally(() => {
            refreshInFlight.current = false
          })
      }
    }, SESSION_CHECK_MS)

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, handleActivity))
      window.clearInterval(checkSession)
    }
  }, [clearSession, user])

  const login = useCallback(async (loginId: string, password: string) => {
    clearSession()
    const encryptedPassword = await encryptPassword(password)
    const result = await post<LoginResponse>('/api/auth/login', { loginId, encryptedPassword })
    if (result.mfaRequired !== true) {
      await acceptLogin(result)
    }
    return result
  }, [acceptLogin, clearSession])

  const verifyMfa = useCallback(async (challengeId: string, otp: string) => {
    const result = await post<LoginResponse>('/api/auth/mfa/verify', { challengeId, otp })
    return acceptLogin(result)
  }, [acceptLogin])

  const logout = useCallback(async () => {
    try {
      await post('/api/auth/logout')
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo<AuthState>(
    () => ({ user, bootstrap, loading, login, verifyMfa, logout }),
    [user, bootstrap, loading, login, verifyMfa, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}

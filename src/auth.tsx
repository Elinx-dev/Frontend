import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { get, post, storeToken, storedToken } from './api'
import type { Bootstrap, LoginResponse, UserProfile } from './types'

interface AuthState {
  user: UserProfile | null
  bootstrap: Bootstrap | null
  loading: boolean
  login: (username: string, password: string) => Promise<LoginResponse>
  verifyOtp: (challengeId: string, otp: string) => Promise<UserProfile>
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

  const loadBootstrap = useCallback(async () => {
    setBootstrap(await get<Bootstrap>('/api/config/bootstrap'))
  }, [])

  useEffect(() => {
    const token = storedToken()
    if (token === null) {
      setLoading(false)
      return
    }
    get<UserProfile>('/api/auth/me')
      .then(async (profile) => {
        setUser(profile)
        await loadBootstrap()
      })
      .catch(() => storeToken(null))
      .finally(() => setLoading(false))
  }, [loadBootstrap])

  const login = useCallback(async (username: string, password: string) => {
    const result = await post<LoginResponse>('/api/auth/login', { username, password })
    if (typeof result.accessToken === 'string') {
      storeToken(result.accessToken)
      const profile = result.user ?? (await get<UserProfile>('/api/auth/me'))
      setUser(profile)
      await loadBootstrap()
    }
    return result
  }, [loadBootstrap])

  const verifyOtp = useCallback(async (challengeId: string, otp: string) => {
    const result = await post<LoginResponse>('/api/auth/verify-otp', { challengeId, otp })
    storeToken(result.accessToken ?? null)
    const profile = result.user ?? (await get<UserProfile>('/api/auth/me'))
    setUser(profile)
    await loadBootstrap()
    return profile
  }, [loadBootstrap])

  const logout = useCallback(async () => {
    try {
      await post('/api/auth/logout')
    } finally {
      storeToken(null)
      setUser(null)
      setBootstrap(null)
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, bootstrap, loading, login, verifyOtp, logout }),
    [user, bootstrap, loading, login, verifyOtp, logout],
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

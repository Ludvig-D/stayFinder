'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch, type ApiResult } from '@/lib/api'
import type { Credentials, User } from '@/lib/types'

type AuthContextValue = {
  user: User | null
  // true until we know whether someone is logged in
  loading: boolean
  login: (credentials: Credentials) => Promise<ApiResult<User>>
  register: (credentials: Credentials) => Promise<ApiResult<User>>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Knows who is logged in and shares it with every component below it.
// The session itself is in the API's httpOnly cookies; this only remembers what /auth/me said.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // On every page load (also after a reload) ask the API. This is what makes G2 work.
  useEffect(() => {
    async function loadUser() {
      const result = await apiFetch<User>('/auth/me')
      // 401 = not logged in. Any other error: treat as logged out too.
      setUser(result.ok ? result.data : null)
      setLoading(false)
    }
    loadUser()
  }, [])

  async function login(credentials: Credentials) {
    const result = await apiFetch<User>('/auth/login', { method: 'POST', body: credentials })
    if (result.ok) setUser(result.data)
    return result
  }

  async function register(credentials: Credentials) {
    const result = await apiFetch<User>('/auth/register', { method: 'POST', body: credentials })
    if (result.ok) setUser(result.data)
    return result
  }

  async function logout() {
    await apiFetch<null>('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

// Different links for a logged-in user and a visitor (G3)
export function Navbar() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  return (
    <nav className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-6">
      <Link href="/" className="text-xl font-bold tracking-tight">
        StayFinder
      </Link>

      {/* While loading, show no links, so a logged-in user never sees "Log in" flash by */}
      {!loading && (
        <div className="flex items-center gap-5 text-sm">
          {user ? (
            <>
              <Link href="/listings/new" className="text-lake hover:underline">New listing</Link>
              <span className="text-fog">{user.email}</span>
              <button onClick={handleLogout} className="text-lake hover:underline">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-lake hover:underline">Log in</Link>
              <Link href="/register" className="rounded-md border border-moss px-3 py-1.5 hover:border-fog">
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

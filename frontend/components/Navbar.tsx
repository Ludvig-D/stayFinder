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
    <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <Link href="/" className="text-lg font-semibold">
        StayFinder
      </Link>

      {/* While loading, show no links, so a logged-in user never sees "Log in" flash by */}
      {!loading && (
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="text-zinc-500">{user.email}</span>
              <button onClick={handleLogout} className="underline">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="underline">Log in</Link>
              <Link href="/register" className="underline">Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}

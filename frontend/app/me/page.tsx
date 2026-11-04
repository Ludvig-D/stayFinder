'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { ListingRow } from '@/components/ListingRow'
import { MyBookingRow } from '@/components/MyBookingRow'
import { getMyBookings, getMyListings } from '@/lib/me'
import { textButtonClass } from '@/lib/styles'
import type { ApiResult } from '@/lib/api'

// "My page": the listings I own and the bookings I've made. Reached by clicking the email in the navbar.
// A client page, like /listings/new: both calls need the session cookies, and only the browser has them.
export default function MyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Not logged in → to the login page, and back here afterwards (?next=).
  // UX only: the API's requireUser (401) is the real guard.
  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/me')
  }, [loading, user, router])

  if (loading || !user) {
    return <p className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16 text-fog">Loading…</p>
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My page</h1>
      <p className="mt-2 text-fog">{user.email}</p>

      {/* key: if another user logs in, the lists are thrown away and fetched again for them */}
      <div key={user.id} className="mt-10 flex flex-col gap-12">
        <MyListings />
        <MyBookings />
      </div>
    </main>
  )
}

function MyListings() {
  const { data: listings, failed, retry } = useApiData(getMyListings)

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight">My listings</h2>
      {failed ? (
        <LoadError what="your listings" retry={retry} />
      ) : listings === null ? (
        <p className="mt-4 text-fog">Loading listings…</p>
      ) : listings.length === 0 ? (
        <p className="mt-4 text-fog">
          You have no listings yet.{' '}
          <Link href="/listings/new" className="text-lake hover:underline">Create one</Link>
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-moss border-y border-moss">
          {listings.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
    </section>
  )
}

function MyBookings() {
  const { data: bookings, failed, retry } = useApiData(getMyBookings)

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight">My bookings</h2>
      {failed ? (
        <LoadError what="your bookings" retry={retry} />
      ) : bookings === null ? (
        <p className="mt-4 text-fog">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="mt-4 text-fog">You have no bookings yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-moss border-y border-moss">
          {bookings.map((booking) => (
            <MyBookingRow key={booking.id} booking={booking} />
          ))}
        </ul>
      )}
    </section>
  )
}

// The error view for one section, with a way to try again (G13 style)
function LoadError({ what, retry }: { what: string; retry: () => void }) {
  return (
    <p className="mt-4 text-error">
      Could not load {what}.{' '}
      <button type="button" onClick={retry} className={textButtonClass}>
        Try again
      </button>
    </p>
  )
}

// Calls the API once when the section appears, and again on retry().
// data is null until the answer is back. Generic (<T>), so both sections get their own typed data (G16).
function useApiData<T>(load: () => Promise<ApiResult<T>>) {
  const [data, setData] = useState<T | null>(null)
  const [failed, setFailed] = useState(false)
  // Bumped by retry(), which makes the effect run again
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // If the section disappears before the answer is back, the answer is ignored
    let active = true
    // State is set in the .then callback, never directly in the effect (react-hooks/set-state-in-effect)
    load().then((result) => {
      if (!active) return
      if (result.ok) setData(result.data)
      else setFailed(true)
    })
    return () => {
      active = false
    }
  }, [load, attempt])

  function retry() {
    setFailed(false)
    setData(null)
    setAttempt((n) => n + 1)
  }

  return { data, failed, retry }
}

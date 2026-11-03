'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { BookingForm } from './BookingForm'
import { BookingRow } from './BookingRow'
import { getBookings } from '@/lib/bookings'
import { withNext } from '@/lib/redirect'
import { buttonClass, textButtonClass } from '@/lib/styles'
import type { ApiResult } from '@/lib/api'
import type { Booking, Listing, User } from '@/lib/types'

// The booking part of the detail page. A client component: every bookings call needs the
// session cookies, and only the browser has them. The listing comes from the server page as a prop.
export function BookingSection({ listing }: { listing: Listing }) {
  const { user, loading } = useAuth()

  // Wait for /auth/me, so a logged-in user doesn't see the logged-out view flash by on reload
  if (loading) return <p className="text-fog">Loading…</p>

  // G9: a logged-out visitor is asked to log in, and comes back to this listing afterwards.
  // UX only: the API (requireUser → 401) and the DB (no grants for anon) are the real guards.
  if (!user) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Book this stay</h2>
        <Link href={withNext('/login', `/listings/${listing.id}`)} className={`${buttonClass} inline-block`}>
          Log in to book this stay
        </Link>
      </div>
    )
  }

  // key: when another user logs in, the bookings below are thrown away and fetched again,
  // instead of briefly showing the previous user's list
  return <SignedInBookings key={user.id} listing={listing} user={user} />
}

function SignedInBookings({ listing, user }: { listing: Listing; user: User }) {
  // null = not loaded yet
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Only picks which view to show. The real guards: the DB refuses to let the owner book (403)
  // or change a guest's booking (403), and RLS decides which bookings each user gets (VG1).
  const isOwner = user.id === listing.owner_id

  // Puts the API's answer into state
  const showResult = useCallback((result: ApiResult<Booking[]>) => {
    if (result.ok) {
      setBookings(result.data)
      setLoadError(false)
    } else {
      setLoadError(true)
    }
  }, [])

  // First load. The state is set in the .then callback, once the answer is back, never directly
  // in the effect (React's lint rule react-hooks/set-state-in-effect).
  useEffect(() => {
    getBookings(listing.id).then(showResult)
  }, [listing.id, showResult])

  // Fetched again after every create, edit, cancel or delete, so the list always shows what the DB
  // has, including the price the DB computed (VG6) and dates freed by a cancel (VG2).
  async function loadBookings() {
    showResult(await getBookings(listing.id))
  }

  function tryAgain() {
    setLoadError(false)
    setBookings(null)
    loadBookings()
  }

  return (
    <div className="flex flex-col gap-12">
      {isOwner ? (
        <p className="text-fog">This is your listing, so you can&apos;t book it. Guests&apos; bookings are shown below.</p>
      ) : (
        <div>
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Book this stay</h2>
          <BookingForm listing={listing} onDone={loadBookings} />
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {isOwner ? 'Bookings for your listing' : 'Your bookings'}
        </h2>

        {loadError ? (
          <p className="mt-4 text-error">
            Could not load bookings.{' '}
            <button type="button" onClick={tryAgain} className={textButtonClass}>
              Try again
            </button>
          </p>
        ) : bookings === null ? (
          <p className="mt-4 text-fog">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <p className="mt-4 text-fog">No bookings yet.</p>
        ) : (
          // No filter on guest_id: the API returns what RLS lets this user see (VG1)
          <ul className="mt-2 divide-y divide-moss border-y border-moss">
            {bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                listing={listing}
                canChange={!isOwner}
                onChanged={loadBookings}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

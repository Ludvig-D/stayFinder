'use client'

import { useState } from 'react'
import { BookingForm } from './BookingForm'
import { cancelBooking, deleteBooking } from '@/lib/bookings'
import { formatDate, nightsBetween, todayInStockholm } from '@/lib/dates'
import { textButtonClass } from '@/lib/styles'
import type { ApiResult } from '@/lib/api'
import type { Booking, Listing } from '@/lib/types'

type Props = {
  booking: Booking
  listing: Listing
  // The owner only reads (VG1), so their rows get no buttons
  canChange: boolean
  // Called after an edit, cancel or delete, so the list can fetch the bookings again
  onChanged: () => void
}

// One booking in "Your bookings" / "Bookings for your listing" (G12)
export function BookingRow({ booking, listing, canChange, onChanged }: Props) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancelled = booking.status === 'cancelled'
  // VG5, UX only: the DB refuses to edit, cancel or delete a booking whose check-in has passed,
  // so we don't offer it. Same "today" as the DB (Stockholm). If the page stays open past midnight,
  // the buttons are still here and the DB's bookings_time trigger answers 400, shown below.
  const started = booking.check_in < todayInStockholm()
  const nights = nightsBetween(booking.check_in, booking.check_out)

  // Cancel and delete work the same way: one call, then show the error or reload the list
  async function run(action: () => Promise<ApiResult<unknown>>) {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)
    if (result.ok) {
      onChanged()
    } else if (result.status === 401) {
      setError('You\'re no longer logged in. Reload the page and log in again.')
    } else if (result.status === 0 || result.status >= 500) {
      setError('Something went wrong, try again')
    } else {
      // e.g. 400 "This booking has already started and can no longer be changed" (VG5)
      setError(result.error.error)
    }
  }

  function handleDelete() {
    if (window.confirm('Delete this booking?')) run(() => deleteBooking(booking.id))
  }

  if (editing) {
    return (
      <li className="py-5">
        <BookingForm
          listing={listing}
          booking={booking}
          onDone={() => {
            setEditing(false)
            onChanged()
          }}
          onStopEditing={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-5 ${cancelled ? 'opacity-60' : ''}`}>
      <div>
        <p className="font-semibold">
          {formatDate(booking.check_in)} → {formatDate(booking.check_out)}
          {cancelled && <span className="ml-3 text-sm font-normal text-fog">Cancelled</span>}
          {started && <span className="ml-3 text-sm font-normal text-fog">Started</span>}
        </p>
        <p className="text-sm text-fog">
          {nights} {nights === 1 ? 'night' : 'nights'} · {booking.guests}{' '}
          {booking.guests === 1 ? 'guest' : 'guests'} · {booking.email}
        </p>

        {/* Cancelled: only delete (no un-cancel). Started: nothing, the DB would refuse it (VG5). */}
        {canChange && !started && (
          <div className="mt-2 flex gap-4">
            {!cancelled && (
              <>
                <button type="button" disabled={busy} onClick={() => setEditing(true)} className={textButtonClass}>
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => cancelBooking(booking.id))}
                  className={textButtonClass}
                >
                  Cancel booking
                </button>
              </>
            )}
            <button type="button" disabled={busy} onClick={handleDelete} className={textButtonClass}>
              Delete
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-error">{error}</p>}
      </div>

      {/* The price the DB computed and saved (VG6), not anything the browser worked out */}
      <p className="shrink-0 text-xl font-semibold text-cloudberry tabular-nums">{booking.total_price} kr</p>
    </li>
  )
}

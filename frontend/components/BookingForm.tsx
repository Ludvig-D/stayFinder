'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { FieldError } from './FieldError'
import { createBooking, updateBooking } from '@/lib/bookings'
import { addDays, nightsBetween, todayInStockholm } from '@/lib/dates'
import { withNext } from '@/lib/redirect'
import { buttonClass, inputClass, textButtonClass } from '@/lib/styles'
import type { ApiResult } from '@/lib/api'
import type { Booking, BookingChanges, Listing } from '@/lib/types'

type Props = {
  listing: Listing
  // Given → edit this booking (G12). Not given → book a new stay (G9).
  booking?: Booking
  // Called after a successful create or edit, so the list can fetch the bookings again
  onDone: () => void
  // Edit mode only: close the form without saving
  onStopEditing?: () => void
}

// One form for both booking and editing: same fields, same rules, same messages.
export function BookingForm({ listing, booking, onDone, onStopEditing }: Props) {
  const router = useRouter()
  const { user, logout } = useAuth()

  // Every field is kept as the text in the input. Guests is converted to a number when sending.
  // A new booking starts with the logged-in user's email, which they can change.
  const [email, setEmail] = useState(booking?.email ?? user?.email ?? '')
  const [checkIn, setCheckIn] = useState(booking?.check_in ?? '')
  const [checkOut, setCheckOut] = useState(booking?.check_out ?? '')
  const [guests, setGuests] = useState(booking ? String(booking.guests) : '1')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [sessionExpired, setSessionExpired] = useState(false)

  // G11: nights and total, shown before the user books. Only when check-out is after check-in.
  const nights = checkIn && checkOut && checkOut > checkIn ? nightsBetween(checkIn, checkOut) : 0
  // When editing, the DB only recomputes the price if the dates change (bookings_price fires on
  // "update of check_in, check_out"). So until they change, the saved price is the right one to show.
  const datesChanged = !booking || checkIn !== booking.check_in || checkOut !== booking.check_out

  // VG5, UX only: the earliest check-in is today in Stockholm, the same "today" as the DB.
  // The DB's bookings_time trigger is the real guard.
  const today = todayInStockholm()

  // Edit mode: only the fields that differ from the saved booking.
  // If check_in or check_out were sent unchanged, the bookings_price trigger would still recompute
  // the price with the listing's *current* price. An email fix could then change what the guest
  // pays, which VG6 says must not happen to an existing booking.
  function changedFields(saved: Booking): BookingChanges {
    const changes: BookingChanges = {}
    if (email !== saved.email) changes.email = email
    if (checkIn !== saved.check_in) changes.check_in = checkIn
    if (checkOut !== saved.check_out) changes.check_out = checkOut
    if (Number(guests) !== saved.guests) changes.guests = Number(guests)
    return changes
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    let request: Promise<ApiResult<Booking>>
    if (booking) {
      const changes = changedFields(booking)
      // Nothing changed: just close. The API would answer 400 "Send at least one field".
      if (Object.keys(changes).length === 0) {
        onStopEditing?.()
        return
      }
      request = updateBooking(booking.id, changes)
    } else {
      // No total_price: the DB computes it (VG6). No guest_id: the DB sets it to the logged-in user (VG1).
      request = createBooking(listing.id, {
        email,
        check_in: checkIn,
        check_out: checkOut,
        guests: Number(guests)
      })
    }

    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})
    setSessionExpired(false)
    const result = await request
    setSubmitting(false)

    if (result.ok) {
      if (!booking) {
        // Ready for the next booking. The email stays, it's most likely the same.
        setCheckIn('')
        setCheckOut('')
        setGuests('1')
      }
      onDone()
      return
    }

    if (result.status === 400 && result.error.details) {
      // G10: field name → messages, from the API's Zod schema. Shown under each field.
      setFieldErrors(result.error.details)
    } else if (result.status === 401) {
      // The session ended after the page was opened (e.g. logged out in another tab)
      setSessionExpired(true)
    } else if (result.status === 0 || result.status >= 500) {
      setFormError('Something went wrong, try again')
    } else {
      // 400 from a DB trigger (VG3 capacity, VG5 past date), 409 overlap (VG2), 403 own listing.
      // The API sends a message written for people, so it's shown as it is.
      setFormError(result.error.error)
    }
  }

  async function logInAgain() {
    // logout() clears who the app thinks is logged in, then the login page sends the user back here
    await logout()
    router.push(withNext('/login', `/listings/${listing.id}`))
  }

  return (
    // The HTML rules (required, min, max, type) are only quick feedback. The API and the DB check again.
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputClass} text-base font-normal`}
        />
        <FieldError messages={fieldErrors.email} />
      </label>

      <div className="grid grid-cols-2 gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Check-in
          <input
            type="date"
            required
            min={today}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={`${inputClass} text-base font-normal`}
          />
          <FieldError messages={fieldErrors.check_in} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Check-out
          <input
            type="date"
            required
            // At least one night: the day after check-in (or after today, before check-in is picked)
            min={addDays(checkIn || today, 1)}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className={`${inputClass} text-base font-normal`}
          />
          <FieldError messages={fieldErrors.check_out} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Guests
        <input
          type="number"
          required
          min={1}
          // VG3, UX only: the DB's bookings_capacity trigger checks max_guests from the listing in the DB
          max={listing.max_guests}
          step={1}
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          className={`${inputClass} text-base font-normal`}
        />
        <FieldError messages={fieldErrors.guests} />
      </label>

      {/* G11: a preview only. The DB's bookings_price trigger does the same sum and saves it (VG6). */}
      {nights > 0 && (
        <p className="tabular-nums" aria-live="polite">
          {datesChanged ? (
            <>
              {nights} {nights === 1 ? 'night' : 'nights'} × {listing.price_per_night} kr ={' '}
              <strong className="text-cloudberry">{nights * listing.price_per_night} kr</strong>
            </>
          ) : (
            <>
              {nights} {nights === 1 ? 'night' : 'nights'},{' '}
              <strong className="text-cloudberry">{booking?.total_price} kr</strong>{' '}
              <span className="text-fog">(the price you booked at)</span>
            </>
          )}
        </p>
      )}

      {formError && <p className="text-sm text-error">{formError}</p>}

      {sessionExpired && (
        <p className="text-sm text-error">
          You&apos;re no longer logged in.{' '}
          <button type="button" onClick={logInAgain} className="text-lake underline">
            Log in again
          </button>
        </p>
      )}

      <div className="flex items-center gap-5">
        {/* Disabled while sending, so a double click can't book twice */}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? '…' : booking ? 'Save changes' : 'Book'}
        </button>
        {onStopEditing && (
          <button type="button" onClick={onStopEditing} className={textButtonClass}>
            Stop editing
          </button>
        )}
      </div>
    </form>
  )
}

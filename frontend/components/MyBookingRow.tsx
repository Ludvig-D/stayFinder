import Link from 'next/link'
import { formatDate, nightsBetween, todayInStockholm } from '@/lib/dates'
import type { MyBooking } from '@/lib/types'

// One booking under "My bookings" on /me. Read-only: editing, cancelling and deleting happen on
// the listing's own page (BookingRow), so that code and its rules live in one place.
export function MyBookingRow({ booking }: { booking: MyBooking }) {
  const nights = nightsBetween(booking.check_in, booking.check_out)
  // Same "today" as the DB's bookings_time trigger (VG5). Only a label here, there are no buttons.
  const started = booking.check_in < todayInStockholm()
  const status = booking.status === 'cancelled' ? 'Cancelled' : started ? 'Started' : 'Active'

  return (
    <li className={booking.status === 'cancelled' ? 'opacity-60' : ''}>
      <Link
        href={`/listings/${booking.listing.id}`}
        className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-5"
      >
        <div>
          <h3 className="text-lg font-semibold group-hover:text-lake">{booking.listing.title}</h3>
          <p className="text-fog">{booking.listing.location}</p>
          <p className="text-sm text-fog">
            {formatDate(booking.check_in)} → {formatDate(booking.check_out)} · {nights}{' '}
            {nights === 1 ? 'night' : 'nights'} · {booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}
            {' · '}
            {status}
          </p>
        </div>
        {/* The price the DB computed and saved when the booking was made (VG6) */}
        <p className="shrink-0 text-xl font-semibold text-cloudberry tabular-nums">{booking.total_price} kr</p>
      </Link>
    </li>
  )
}

import Link from 'next/link'
import type { Listing } from '@/lib/types'

// One listing in the list on /. A row rather than a card: with no photos, the useful thing is
// comparing places and prices, and a column of rows with the price on the right does that best.
export function ListingRow({ listing }: { listing: Listing }) {
  return (
    <li>
      <Link
        href={`/listings/${listing.id}`}
        className="group flex items-baseline justify-between gap-6 py-5"
      >
        <div>
          <h2 className="text-lg font-semibold group-hover:text-lake">{listing.title}</h2>
          <p className="text-fog">{listing.location}</p>
          <p className="text-sm text-fog">
            Up to {listing.max_guests} {listing.max_guests === 1 ? 'guest' : 'guests'}
          </p>
        </div>
        {/* tabular-nums: every digit is the same width, so the prices line up down the column */}
        <p className="shrink-0 text-right tabular-nums">
          <span className="text-xl font-semibold text-cloudberry">{listing.price_per_night} kr</span>
          <span className="block text-sm text-fog">per night</span>
        </p>
      </Link>
    </li>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getListing } from '@/lib/listings'

// Server component, like the list. loading.tsx and error.tsx from app/ cover this page too.
export default async function ListingPage({ params }: PageProps<'/listings/[id]'>) {
  const { id } = await params
  const result = await getListing(id)

  if (!result.ok) {
    // The API answers 404 both for an id that doesn't exist and for one that isn't a uuid.
    // notFound() stops rendering and shows ./not-found.tsx (G13).
    if (result.status === 404) notFound()
    throw new Error(`Could not load listing: ${result.error.error}`)
  }
  const listing = result.data

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16">
      <Link href="/" className="text-sm text-lake hover:underline">← All listings</Link>

      <h1 className="mt-6 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{listing.title}</h1>
      <p className="mt-2 text-lg text-fog">{listing.location}</p>

      <dl className="mt-8 grid max-w-md grid-cols-2 gap-6 border-y border-moss py-4">
        <div>
          <dt className="text-sm text-fog">Price per night</dt>
          <dd className="text-2xl font-semibold text-cloudberry tabular-nums">{listing.price_per_night} kr</dd>
        </div>
        <div>
          <dt className="text-sm text-fog">Guests</dt>
          <dd className="text-2xl font-semibold">Up to {listing.max_guests}</dd>
        </div>
      </dl>

      {listing.description && (
        <p className="mt-8 max-w-prose text-lg leading-relaxed whitespace-pre-line">{listing.description}</p>
      )}

      {/* Placeholder: the booking form comes in feature 11 */}
      <section className="mt-12 max-w-prose rounded-lg border border-dashed border-moss bg-pine p-6 text-fog">
        Booking coming soon.
      </section>
    </main>
  )
}

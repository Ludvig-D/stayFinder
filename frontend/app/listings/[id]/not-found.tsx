import Link from 'next/link'

// Rendered when the page calls notFound(), i.e. the API said 404 (G13)
export default function ListingNotFound() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16">
      <h1 className="text-3xl font-bold tracking-tight">Listing not found</h1>
      <p className="mt-2 text-fog">It may have been removed, or the link is wrong.</p>
      <Link href="/" className="mt-6 inline-block text-lake hover:underline">Back to all listings</Link>
    </main>
  )
}

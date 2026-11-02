// Shown while the listing is fetched (G13). The one in app/ doesn't cover this nested segment:
// Next asks for a <Suspense> boundary (loading.tsx) in the segment that fetches.
export default function Loading() {
  return <p className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16 text-fog">Loading listing…</p>
}

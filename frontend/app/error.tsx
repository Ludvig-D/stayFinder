'use client' // Error boundaries must be client components: retry() runs in the browser

import { buttonClass } from '@/lib/styles'

// Shown when a page in this segment throws, e.g. the API is down (G13)
export default function ErrorView({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16">
      <h1 className="text-3xl font-bold tracking-tight">Could not load listings</h1>
      <p className="mt-2 text-fog">Something went wrong. Check your connection and try again.</p>
      {/* retry() asks the server for the page again (router.refresh) and re-renders it */}
      <button onClick={() => retry()} className={`${buttonClass} mt-6`}>
        Try again
      </button>
    </main>
  )
}

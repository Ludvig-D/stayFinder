'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { ListingForm } from '@/components/ListingForm'

// A client page: creating a listing needs the session cookies, and only the browser has them.
// The folder name "new" is a fixed segment, so Next picks it before the dynamic [id] folder next to it.
export default function NewListingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Not logged in → to the login page, and back here afterwards (?next=).
  // Wait for `loading`: until /auth/me has answered, user is null even for a logged-in user.
  // replace, not push: the back button shouldn't land on a page that redirects again.
  // This is UX only. The API (requireUser → 401) and the DB (no insert grant for anon) are the real guards.
  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/listings/new')
  }, [loading, user, router])

  if (loading || !user) {
    return <p className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16 text-fog">Loading…</p>
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">New listing</h1>
      <ListingForm />
    </main>
  )
}

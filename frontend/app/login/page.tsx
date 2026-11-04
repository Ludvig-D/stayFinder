import { Suspense } from 'react'
import { AuthForm } from '@/components/AuthForm'
import { safeNext } from '@/lib/redirect'

// /login?next=/listings/new → back to the form after logging in. safeNext only lets our own paths through.
// The page itself doesn't read the URL, so Next can show it instantly on navigation (partialPrefetching).
// Only the part that reads ?next= waits for the URL, inside <Suspense>.
export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <Suspense fallback={null}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  )
}

async function LoginForm({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { next } = await searchParams
  return <AuthForm mode="login" next={safeNext(next)} />
}

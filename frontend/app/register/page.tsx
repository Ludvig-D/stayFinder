import { Suspense } from 'react'
import { AuthForm } from '@/components/AuthForm'
import { safeNext } from '@/lib/redirect'

// Same as the login page: ?next= is passed on from there, so registering also leads back.
// The URL is only read inside <Suspense>, so the page itself can be shown instantly.
export default function RegisterPage({ searchParams }: PageProps<'/register'>) {
  return (
    <Suspense fallback={null}>
      <RegisterForm searchParams={searchParams} />
    </Suspense>
  )
}

async function RegisterForm({ searchParams }: Pick<PageProps<'/register'>, 'searchParams'>) {
  const { next } = await searchParams
  return <AuthForm mode="register" next={safeNext(next)} />
}

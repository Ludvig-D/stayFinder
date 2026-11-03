import { AuthForm } from '@/components/AuthForm'
import { safeNext } from '@/lib/redirect'

// /login?next=/listings/new → back to the form after logging in. safeNext only lets our own paths through.
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams
  return <AuthForm mode="login" next={safeNext(next)} />
}

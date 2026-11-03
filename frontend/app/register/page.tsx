import { AuthForm } from '@/components/AuthForm'
import { safeNext } from '@/lib/redirect'

// Same as the login page: ?next= is passed on from there, so registering also leads back
export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const { next } = await searchParams
  return <AuthForm mode="register" next={safeNext(next)} />
}

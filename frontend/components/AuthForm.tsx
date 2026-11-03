'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { buttonClass, inputClass } from '@/lib/styles'
import { withNext } from '@/lib/redirect'

type Mode = 'login' | 'register'

// One form for both pages: same fields, only the API call and the texts differ.
// `next` is where to go after logging in. The page has already checked it with safeNext().
export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const { user, login, register } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  // Logged in (already, or just now after submitting) → nothing to do here, go on to `next` (home by default).
  // replace, not push: the back button shouldn't lead back to the login page.
  useEffect(() => {
    if (user) router.replace(next)
  }, [user, router, next])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})

    const send = mode === 'login' ? login : register
    const result = await send({ email, password })
    setSubmitting(false)

    // Success: the context now has the user, and the effect above redirects
    if (result.ok) return

    if (result.status === 400 && result.error.details) {
      setFieldErrors(result.error.details)
    } else if (result.status === 0 || result.status >= 500) {
      setFormError('Something went wrong, try again')
    } else {
      // 401 "Wrong email or password", 409 "Email is already registered": the API's message is clear enough
      setFormError(result.error.error)
    }
  }

  const title = mode === 'login' ? 'Log in' : 'Create an account'

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">{title}</h1>

      {/* The HTML rules (type, required, minLength) are only quick feedback. The API checks again. */}
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} text-base font-normal`}
          />
          {fieldErrors.email && <span className="text-sm font-normal text-error">{fieldErrors.email[0]}</span>}
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} text-base font-normal`}
          />
          {fieldErrors.password && <span className="text-sm font-normal text-error">{fieldErrors.password[0]}</span>}
        </label>

        {formError && <p className="text-sm font-normal text-error">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className={`${buttonClass} mt-2`}
        >
          {submitting ? '…' : title}
        </button>
      </form>

      <p className="mt-8 text-sm text-fog">
        {mode === 'login' ? (
          <>No account? <Link href={withNext('/register', next)} className="text-lake hover:underline">Register</Link></>
        ) : (
          <>Already have an account? <Link href={withNext('/login', next)} className="text-lake hover:underline">Log in</Link></>
        )}
      </p>
    </main>
  )
}

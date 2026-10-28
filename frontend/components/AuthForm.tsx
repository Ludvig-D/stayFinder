'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

type Mode = 'login' | 'register'

// One form for both pages: same fields, only the API call and the texts differ
export function AuthForm({ mode }: { mode: Mode }) {
  const { user, login, register } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  // Logged in (already, or just now after submitting) → nothing to do here, go home
  useEffect(() => {
    if (user) router.replace('/')
  }, [user, router])

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
    <main className="mx-auto w-full max-w-sm px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>

      {/* The HTML rules (type, required, minLength) are only quick feedback. The API checks again. */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {fieldErrors.email && <span className="text-sm text-red-600">{fieldErrors.email[0]}</span>}
        </label>

        <label className="flex flex-col gap-1">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {fieldErrors.password && <span className="text-sm text-red-600">{fieldErrors.password[0]}</span>}
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? '…' : title}
        </button>
      </form>

      <p className="mt-6 text-sm">
        {mode === 'login' ? (
          <>No account? <Link href="/register" className="underline">Register</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="underline">Log in</Link></>
        )}
      </p>
    </main>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { FieldError } from './FieldError'
import { createListing } from '@/lib/listings'
import { buttonClass, inputClass } from '@/lib/styles'

// G7: create a listing. Only rendered for a logged-in user (app/listings/new/page.tsx checks that).
export function ListingForm() {
  const router = useRouter()
  const { logout } = useAuth()

  // Every field is kept as the text in the input. The numbers are converted when sending.
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [price, setPrice] = useState('')
  const [maxGuests, setMaxGuests] = useState('')
  const [description, setDescription] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [sessionExpired, setSessionExpired] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})
    setSessionExpired(false)

    const result = await createListing({
      title,
      description,
      location,
      // The API wants numbers (z.int()), but an input's value is always a string
      price_per_night: Number(price),
      max_guests: Number(maxGuests)
      // No owner_id: the DB sets it to the logged-in user (VG1)
    })
    setSubmitting(false)

    if (result.ok) {
      // With cacheComponents, Next keeps this component's state when we navigate away, so the
      // old values would still be here next time the form is opened. Clear them first.
      setTitle('')
      setLocation('')
      setPrice('')
      setMaxGuests('')
      setDescription('')
      router.push(`/listings/${result.data.id}`)
      return
    }

    if (result.status === 400 && result.error.details) {
      // field name → messages, from the API's Zod schema. Shown under each field.
      setFieldErrors(result.error.details)
    } else if (result.status === 401) {
      // The session ended after the page was opened (e.g. logged out in another tab)
      setSessionExpired(true)
    } else if (result.status === 0 || result.status >= 500) {
      setFormError('Something went wrong, try again')
    } else {
      setFormError(result.error.error)
    }
  }

  return (
    // The HTML rules (required, min, maxLength) are only quick feedback. The API and the DB check again.
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-5">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Title
        <input
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} text-base font-normal`}
        />
        <FieldError messages={fieldErrors.title} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Location
        <input
          required
          maxLength={100}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={`${inputClass} text-base font-normal`}
        />
        <FieldError messages={fieldErrors.location} />
      </label>

      <div className="grid grid-cols-2 gap-5">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Price per night (kr)
          <input
            type="number"
            required
            min={1}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`${inputClass} text-base font-normal`}
          />
          <FieldError messages={fieldErrors.price_per_night} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Max guests
          <input
            type="number"
            required
            min={1}
            step={1}
            value={maxGuests}
            onChange={(e) => setMaxGuests(e.target.value)}
            className={`${inputClass} text-base font-normal`}
          />
          <FieldError messages={fieldErrors.max_guests} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span>Description <span className="font-normal text-fog">(optional)</span></span>
        <textarea
          rows={5}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} text-base font-normal`}
        />
        <FieldError messages={fieldErrors.description} />
      </label>

      {formError && <p className="text-sm text-error">{formError}</p>}

      {sessionExpired && (
        <p className="text-sm text-error">
          You&apos;re no longer logged in.{' '}
          {/* logout() clears who the app thinks is logged in. The page then sees no user and
              redirects to /login?next=/listings/new, so the user comes back here afterwards. */}
          <button type="button" onClick={logout} className="text-lake underline">
            Log in again
          </button>
        </p>
      )}

      {/* Disabled while sending, so a double click can't create two listings */}
      <button type="submit" disabled={submitting} className={`${buttonClass} mt-2`}>
        {submitting ? '…' : 'Create listing'}
      </button>
    </form>
  )
}

// The API's message(s) for one field, e.g. "Price must be at least 1 kr". Used by every form.
export function FieldError({ messages }: { messages: string[] | undefined }) {
  if (!messages) return null
  return <span className="text-sm font-normal text-error">{messages[0]}</span>
}

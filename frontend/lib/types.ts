// Same shapes as the API sends (backend/src/routes/auth.ts)

export type User = {
  id: string
  email: string | undefined
}

export type Credentials = {
  email: string
  password: string
}

// Every error response from the API. `details` is only there on 400: field name → messages.
export type ApiError = {
  error: string
  details?: Record<string, string[]>
}

// Where to send the user after they log in or register, e.g. back to /listings/new.
//
// `next` comes from the URL, so anyone can put anything in it. If we followed it blindly, a link like
// /login?next=https://evil.example would send the user to another site right after logging in
// (an "open redirect"). So we only follow a path inside our own app:
// - it must start with "/" (a path, not "https://...")
// - but not "//", which the browser reads as another site ("//evil.example")
// - and no "\", because browsers treat "/\evil.example" the same as "//evil.example"
// Anything else, or no `next` at all, goes to the home page.
export function safeNext(next: string | string[] | undefined): string {
  if (typeof next !== 'string') return '/'
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/'
  return next
}

// Adds ?next=... to a link, so it's passed on (e.g. from the login page to the register page)
export function withNext(path: string, next: string): string {
  return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`
}

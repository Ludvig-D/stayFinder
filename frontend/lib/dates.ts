// Dates are always strings in the YYYY-MM-DD format here: that's what <input type="date"> gives,
// what the API wants, and what the DB's date columns return.
// YYYY-MM-DD strings sort like the dates they stand for, so < and > compare them correctly.

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Swedish dates are written YYYY-MM-DD, so the sv-SE format is exactly the string we need
const stockholmDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' })

// Today's date in Stockholm, the same "today" as the DB's bookings_time trigger (VG5).
// Not the browser's own time zone: someone in New York at 23:00 is already on the next day in Sweden.
export function todayInStockholm(): string {
  return stockholmDate.format(new Date())
}

// new Date('2026-11-10') is midnight UTC on that day, so the difference between two such dates
// is always whole days. Daylight saving time can't add or remove an hour, because UTC has none.
export function nightsBetween(checkIn: string, checkOut: string): number {
  return (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / MS_PER_DAY
}

// The day after (or before) a date, e.g. for the earliest allowed check-out
export function addDays(date: string, days: number): string {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

// "10 Jan 2027". timeZone UTC, since the date was parsed as midnight UTC.
// Without it, a browser west of UTC would show the day before.
const displayDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

export function formatDate(date: string): string {
  return displayDate.format(new Date(date))
}

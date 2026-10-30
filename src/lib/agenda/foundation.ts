import type { AppointmentStatus } from "@prisma/client"

export const finalAppointmentStates = ["COMPLETED", "CANCELED", "NO_SHOW"] as const
const transitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "IN_PROGRESS", "CANCELED", "NO_SHOW"],
  CONFIRMED: ["IN_PROGRESS", "CANCELED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELED"], COMPLETED: [], CANCELED: [], NO_SHOW: [],
}
export function canTransition(from: AppointmentStatus, to: AppointmentStatus) { return transitions[from].includes(to) }
export function assertTransition(from: AppointmentStatus, to: AppointmentStatus, hasFinalizedSale = false) {
  if (!canTransition(from, to) || (to === "COMPLETED" && !hasFinalizedSale)) throw new Error("Invalid appointment transition")
}
export type Interval = { startsAt: Date; endsAt: Date }
export function assertInterval(value: Interval) {
  if (!Number.isFinite(value.startsAt.getTime()) || !Number.isFinite(value.endsAt.getTime()) || value.startsAt >= value.endsAt) throw new Error("Invalid interval")
}
export function overlaps(a: Interval, b: Interval) {
  assertInterval(a); assertInterval(b)
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt
}
export function occupied(request: Interval, entries: readonly (Interval & { releasedAt: Date | null })[]) {
  assertInterval(request)
  return entries.some(entry => entry.releasedAt === null && overlaps(request, entry))
}
export function durationMinutes(items: readonly { quantity: number; durationMinutesSnapshot: number }[]) {
  if (!items.length) throw new Error("Appointment requires items")
  const total = items.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.durationMinutesSnapshot) || item.durationMinutesSnapshot < 1) throw new Error("Invalid duration")
    return sum + item.quantity * item.durationMinutesSnapshot
  }, 0)
  if (!Number.isSafeInteger(total) || total > 2147483647) throw new Error("Invalid duration")
  return total
}
export type MinuteWindow = { startMinute: number; endMinute: number }
type WeeklyWindow = MinuteWindow & { weekday: number; validFrom: string; validUntil: string | null }
type DateException = { date: string; kind: "CLOSED" | "REPLACE_WINDOWS"; windows: readonly MinuteWindow[] }
export type CalendarRevision = { effectiveFrom: Date; effectiveUntil: Date | null; weekly: readonly WeeklyWindow[]; exceptions: readonly DateException[] }
function localDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("Invalid local date")
  return new Date(`${value}T00:00:00Z`)
}
function windows(rows: readonly MinuteWindow[]) {
  const result = rows.map(row => ({ startMinute: row.startMinute, endMinute: row.endMinute })).sort((a, b) => a.startMinute - b.startMinute)
  result.forEach((row, index) => {
    if (!Number.isInteger(row.startMinute) || !Number.isInteger(row.endMinute) || row.startMinute < 0 || row.endMinute > 1440 || row.startMinute >= row.endMinute || (index > 0 && result[index - 1].endMinute > row.startMinute)) throw new Error("Invalid availability windows")
  })
  return result
}
export function revisionAt(rows: readonly CalendarRevision[], at: Date) {
  if (!Number.isFinite(at.getTime())) throw new Error("Invalid instant")
  const matching = rows.filter(row => row.effectiveFrom <= at && (!row.effectiveUntil || at < row.effectiveUntil))
  if (matching.length > 1) throw new Error("Overlapping calendar revisions")
  return matching[0] ?? null
}
export function calendarWindows(calendar: CalendarRevision, date: string) {
  const weekday = localDate(date).getUTCDay(), exceptions = calendar.exceptions.filter(row => row.date === date)
  if (exceptions.length > 1) throw new Error("Duplicate date exception")
  const exception = exceptions[0]
  if (exception) {
    if (exception.kind === "CLOSED") { if (exception.windows.length) throw new Error("Closed date has windows"); return [] }
    if (!exception.windows.length) throw new Error("Replacement requires windows")
    return windows(exception.windows)
  }
  return windows(calendar.weekly.filter(row => row.weekday === weekday && row.validFrom <= date && (!row.validUntil || date < row.validUntil)))
}
export function availableWindows(shop: CalendarRevision | null, professional: CalendarRevision | null, date: string) {
  localDate(date)
  if (!shop) return []
  const shopWindows = calendarWindows(shop, date)
  if (!professional) return shopWindows
  return shopWindows.flatMap(a => calendarWindows(professional, date).flatMap(b => {
    const startMinute = Math.max(a.startMinute, b.startMinute), endMinute = Math.min(a.endMinute, b.endMinute)
    return startMinute < endMinute ? [{ startMinute, endMinute }] : []
  }))
}

// Pure minute-precision conversion. Enumerating offsets avoids assumptions about
// the machine timezone, DST size or the browser's preferred ambiguous instant.
// No I/O, environment lookup, singleton or database client is imported here.
export function localInstant(date: string, time: string, timezone: string, offsetMinutes?: number) {
  localDate(date)
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid local time")
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  const target = `${date}T${time}`, guess = Date.parse(`${target}:00Z`), candidates: { instant: Date; offset: number }[] = []
  const offsets = offsetMinutes === undefined ? Array.from({ length: 2881 }, (_, index) => index - 1440) : [offsetMinutes]
  for (const offset of offsets) {
    if (!Number.isInteger(offset) || Math.abs(offset) > 1440) throw new Error("Invalid offset")
    const instant = new Date(guess - offset * 60000), parts = formatter.formatToParts(instant)
    const part = (name: string) => parts.find(row => row.type === name)!.value
    if (`${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}` === target) candidates.push({ instant, offset })
  }
  if (candidates.length === 0) throw new Error("Nonexistent local time or invalid offset")
  if (candidates.length !== 1) throw new Error("Ambiguous local time requires an explicit offset")
  return candidates[0].instant
}

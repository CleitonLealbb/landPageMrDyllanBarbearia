export const presets = ["today", "yesterday", "week", "month", "previousMonth", "year", "custom"] as const
export type Preset = typeof presets[number]

function dateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}
function shift(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
// Resolve each local midnight independently so DST days may contain 23 or 25 hours.
export function midnight(key: string, timezone: string) {
  const target = Date.parse(`${key}T00:00:00Z`)
  let instant = target
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant))
    const part = (name: string) => parts.find(p => p.type === name)!.value
    const local = Date.parse(`${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}Z`)
    instant += target - local
  }
  return new Date(instant)
}
export function dashboardPeriod(params: URLSearchParams, timezone: string, now = new Date()) {
  const allowed = ["period", "start", "end", "professionalId", "compare"]
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new Error("Parâmetro inválido.")
  const preset = params.get("period") ?? "month"
  if (!presets.includes(preset as Preset)) throw new Error("Período inválido.")
  if (params.has("compare") && !["true", "false"].includes(params.get("compare")!)) throw new Error("Comparação inválida.")
  const today = dateKey(now, timezone)
  let start = today, end = today
  if (preset === "yesterday") start = end = shift(today, -1)
  if (preset === "week") start = shift(today, -6)
  if (preset === "month") start = `${today.slice(0, 7)}-01`
  if (preset === "year") start = `${today.slice(0, 4)}-01-01`
  if (preset === "previousMonth") { end = shift(`${today.slice(0, 7)}-01`, -1); start = `${end.slice(0, 7)}-01` }
  if (preset === "custom") {
    start = params.get("start") ?? ""; end = params.get("end") ?? ""
    for (const key of [start, end]) if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(Date.parse(key)) || new Date(key).toISOString().slice(0, 10) !== key) throw new Error("Datas inválidas.")
  } else if (params.has("start") || params.has("end")) throw new Error("Datas exigem intervalo personalizado.")
  const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1
  if (days < 1 || days > 366) throw new Error("Escolha um intervalo de até 366 dias.")
  const previousStart = shift(start, -days), previousEnd = shift(start, -1)
  return { preset, start, end, timezone, compare: params.get("compare") === "true", current: { gte: midnight(start, timezone), lt: midnight(shift(end, 1), timezone) }, previous: { gte: midnight(previousStart, timezone), lt: midnight(start, timezone) }, previousStart, previousEnd }
}

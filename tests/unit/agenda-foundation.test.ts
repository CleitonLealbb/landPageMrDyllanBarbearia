import { describe, expect, it } from "vitest"
import type { AppointmentStatus } from "@prisma/client"
import { assertInterval, assertTransition, availableWindows, calendarWindows, canTransition, durationMinutes, localInstant, occupied, overlaps, revisionAt, type CalendarRevision } from "@/lib/agenda/foundation"

const states: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELED", "NO_SHOW"]
const edges = new Set(["SCHEDULED:CONFIRMED", "SCHEDULED:IN_PROGRESS", "SCHEDULED:CANCELED", "SCHEDULED:NO_SHOW", "CONFIRMED:IN_PROGRESS", "CONFIRMED:CANCELED", "CONFIRMED:NO_SHOW", "IN_PROGRESS:COMPLETED", "IN_PROGRESS:CANCELED"])
const interval = (start: string, end: string) => ({ startsAt: new Date(`2026-10-29T${start}:00Z`), endsAt: new Date(`2026-10-29T${end}:00Z`) })
const shop = (): CalendarRevision => ({ effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveUntil: null, weekly: [{ weekday: 4, startMinute: 540, endMinute: 720, validFrom: "2026-01-01", validUntil: null }, { weekday: 4, startMinute: 780, endMinute: 1080, validFrom: "2026-01-01", validUntil: null }], exceptions: [] })

describe("Agenda: estados puros", () => {
  it.each(states.flatMap(from => states.map(to => [from, to] as const)))("%s → %s", (from, to) => {
    const permitted = edges.has(`${from}:${to}`)
    expect(canTransition(from, to)).toBe(permitted)
    if (permitted && to !== "COMPLETED") expect(() => assertTransition(from, to)).not.toThrow()
    else expect(() => assertTransition(from, to)).toThrow()
  })
  it("conclusão exige finalização válida; flags não reabrem estados finais", () => {
    expect(() => assertTransition("IN_PROGRESS", "COMPLETED", true)).not.toThrow()
    for (const state of ["COMPLETED", "CANCELED", "NO_SHOW"] as const) for (const next of states) expect(() => assertTransition(state, next, true)).toThrow()
  })
})
describe("Agenda: intervalos e duração", () => {
  it.each([["09:00", "09:25", false], ["09:50", "10:00", false], ["09:24", "09:26", true], ["09:25", "09:50", true], ["09:30", "09:35", true]])("[09:25,09:50) contra [%s,%s)", (start, end, expected) => {
    const a = interval("09:25", "09:50"), b = interval(start, end)
    expect(overlaps(a, b)).toBe(expected); expect(overlaps(b, a)).toBe(expected)
  })
  it("ocupações liberadas não bloqueiam; a natureza do evento não muda a colisão", () => {
    const request = interval("09:00", "09:25")
    expect(occupied(request, [{ ...request, releasedAt: new Date() }])).toBe(false)
    expect(occupied(request, [{ ...request, releasedAt: null }])).toBe(true)
    expect(occupied(request, [{ ...interval("09:25", "09:50"), releasedAt: null }])).toBe(false)
  })
  it.each([interval("10:00", "10:00"), interval("10:00", "09:00"), { startsAt: new Date(NaN), endsAt: new Date() }])("rejeita intervalo inválido", input => {
    expect(() => assertInterval(input)).toThrow(); expect(() => occupied(input, [])).toThrow()
  })
  it("soma unidades e combos em minutos inteiros, sem arredondar 25 para 30", () => {
    expect(durationMinutes([{ quantity: 1, durationMinutesSnapshot: 25 }, { quantity: 2, durationMinutesSnapshot: 40 }])).toBe(105)
  })
  it.each([[], [{ quantity: 0, durationMinutesSnapshot: 25 }], [{ quantity: 1, durationMinutesSnapshot: -1 }], [{ quantity: 1.5, durationMinutesSnapshot: 25 }], [{ quantity: 2147483647, durationMinutesSnapshot: 2 }]].map(items => ({ items })))("rejeita duração inválida ou overflow", ({ items }) => expect(() => durationMinutes(items)).toThrow())
})
describe("Agenda: disponibilidade e vigência", () => {
  it("intersecta funcionamento e jornada, preservando almoço", () => {
    const professional = { ...shop(), weekly: [{ weekday: 4, startMinute: 600, endMinute: 1020, validFrom: "2026-01-01", validUntil: null }] }
    expect(availableWindows(shop(), professional, "2026-10-29")).toEqual([{ startMinute: 600, endMinute: 720 }, { startMinute: 780, endMinute: 1020 }])
  })
  it("sem calendário da barbearia não inventa jornada; profissional opcional herda", () => {
    expect(availableWindows(null, shop(), "2026-10-29")).toEqual([])
    expect(availableWindows(shop(), null, "2026-10-29")).toHaveLength(2)
    expect(availableWindows(shop(), { ...shop(), weekly: [] }, "2026-10-29")).toEqual([])
  })
  it("fechamento e feriado prevalecem sobre as janelas semanais", () => {
    const closed = { ...shop(), exceptions: [{ date: "2026-10-29", kind: "CLOSED" as const, windows: [] }] }
    expect(availableWindows(closed, shop(), "2026-10-29")).toEqual([])
  })
  it("exceção substitui, em vez de adicionar à jornada", () => {
    const special = { ...shop(), exceptions: [{ date: "2026-10-29", kind: "REPLACE_WINDOWS" as const, windows: [{ startMinute: 600, endMinute: 660 }] }] }
    expect(calendarWindows(special, "2026-10-29")).toEqual([{ startMinute: 600, endMinute: 660 }])
    expect(calendarWindows(special, "2026-10-30")).toEqual([])
  })
  it("vigência semanal também é semiaberta", () => {
    const calendar = { ...shop(), weekly: [{ ...shop().weekly[0], validUntil: "2026-10-29" }] }
    expect(calendarWindows(calendar, "2026-10-29")).toEqual([])
  })
  it("seleciona a revisão histórica e não duas revisões no mesmo instante", () => {
    const boundary = new Date("2026-10-29T12:00:00Z"), old = { ...shop(), effectiveUntil: boundary }, next = { ...shop(), effectiveFrom: boundary }
    expect(revisionAt([old, next], boundary)).toBe(next)
    expect(revisionAt([old, next], new Date(boundary.getTime() - 1))).toBe(old)
    expect(revisionAt([], boundary)).toBeNull()
    expect(() => revisionAt([shop(), shop()], boundary)).toThrow()
  })
  it("rejeita sobreposição de janelas e exceções incoerentes", () => {
    expect(() => calendarWindows({ ...shop(), weekly: [shop().weekly[0], shop().weekly[0]] }, "2026-10-29")).toThrow()
    expect(() => calendarWindows({ ...shop(), exceptions: [{ date: "2026-10-29", kind: "CLOSED", windows: [{ startMinute: 1, endMinute: 2 }] }] }, "2026-10-29")).toThrow()
    expect(() => calendarWindows({ ...shop(), exceptions: [{ date: "2026-10-29", kind: "REPLACE_WINDOWS", windows: [] }] }, "2026-10-29")).toThrow()
    expect(() => availableWindows(null, null, "2026-02-30")).toThrow()
  })
})
describe("Agenda: timezone IANA e horários locais", () => {
  it("converte usando o timezone informado pelo contexto do domínio, sem timezone global fixo", () => {
    expect(localInstant("2026-10-29", "12:25", "America/Cuiaba").toISOString()).toBe("2026-10-29T16:25:00.000Z")
    expect(localInstant("2026-10-29", "12:25", "UTC").toISOString()).toBe("2026-10-29T12:25:00.000Z")
  })
  it("horário inexistente na transição DST é recusado", () => expect(() => localInstant("2026-03-08", "02:30", "America/New_York")).toThrow(/Nonexistent/))
  it("horário ambíguo exige offset e valida ambas as ocorrências", () => {
    expect(() => localInstant("2026-11-01", "01:30", "America/New_York")).toThrow(/Ambiguous/)
    expect(localInstant("2026-11-01", "01:30", "America/New_York", -240).toISOString()).toBe("2026-11-01T05:30:00.000Z")
    expect(localInstant("2026-11-01", "01:30", "America/New_York", -300).toISOString()).toBe("2026-11-01T06:30:00.000Z")
    expect(() => localInstant("2026-11-01", "01:30", "America/New_York", 0)).toThrow()
  })
  it("não desloca silenciosamente um dia inexistente", () => expect(() => localInstant("2011-12-30", "12:00", "Pacific/Apia")).toThrow(/Nonexistent/))
  it.each([["2026-02-30", "12:00", "UTC"], ["2026-10-29", "24:00", "UTC"], ["2026-10-29", "12:00", "invalid/zone"]])("rejeita data/hora/zona inválida", (date, time, zone) => expect(() => localInstant(date, time, zone)).toThrow())
})

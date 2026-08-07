import { describe, expect, it } from "vitest"
import { calculateServiceSummary, formatBRL, normalizeServicePayload, reaisToCents } from "@/features/services/helpers"
import type { CatalogService } from "@/features/services/types"

describe("helpers da interface de serviços", () => {
  it.each([["10", 1000], ["10,50", 1050], ["1.234,56", 123456], ["0,01", 1]])("converte %s em centavos", (input, expected) => {
    expect(reaisToCents(input)).toBe(expected)
  })

  it.each(["", "-1", "1,999", "abc", "NaN"])("rejeita preço inválido %s", (input) => {
    expect(reaisToCents(input)).toBeNull()
  })

  it("normaliza somente o payload aceito pela API", () => {
    expect(normalizeServicePayload({ name: " Corte ", description: " ", priceReais: "50,00", durationMinutes: "40", displayOrder: "2", status: "ACTIVE" })).toEqual({
      payload: { name: "Corte", description: null, priceCents: 5000, durationMinutes: 40, displayOrder: 2, status: "ACTIVE" },
    })
  })

  it("valida duração e ordem inteiras", () => {
    const base = { name: "Corte", description: "", priceReais: "10", durationMinutes: "1.5", displayOrder: "0", status: "ACTIVE" as const }
    expect(normalizeServicePayload(base)).toHaveProperty("error")
    expect(normalizeServicePayload({ ...base, durationMinutes: "30", displayOrder: "-1" })).toHaveProperty("error")
  })

  it("formata BRL e calcula indicadores", () => {
    expect(formatBRL(5050)).toContain("50,50")
    const services = [
      { id: "1", status: "ACTIVE", durationMinutes: 30 },
      { id: "2", status: "INACTIVE", durationMinutes: 60 },
    ] as CatalogService[]
    expect(calculateServiceSummary(services)).toEqual({ total: 2, active: 1, inactive: 1, averageDuration: 45 })
  })
})

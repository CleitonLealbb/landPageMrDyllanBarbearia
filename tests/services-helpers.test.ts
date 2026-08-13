import { describe, expect, it } from "vitest"
import { calculateServiceSummary, filterAssignedServices, formatBRL, getAssignedServicesSummary, groupServicesByProfessional, normalizeServicePayload, reaisToCents, serviceTabs, sortServicesForDisplay } from "@/features/services/helpers"
import type { CatalogService, ProfessionalOption } from "@/features/services/types"

describe("helpers da interface de serviços", () => {
  it.each([["10", 1000], ["10,50", 1050], ["1.234,56", 123456], ["0,01", 1]])("converte %s em centavos", (input, expected) => {
    expect(reaisToCents(input)).toBe(expected)
  })

  it.each(["", "-1", "1,999", "abc", "NaN"])("rejeita preço inválido %s", (input) => {
    expect(reaisToCents(input)).toBeNull()
  })

  it("normaliza somente o payload aceito pela API", () => {
    expect(normalizeServicePayload({ name: " Corte ", description: " ", priceReais: "50,00", durationMinutes: "40", displayOrder: "2", status: "ACTIVE", categoryId: "" })).toEqual({
      payload: { name: "Corte", description: null, priceCents: 5000, durationMinutes: 40, displayOrder: 2, status: "ACTIVE", categoryId: null },
    })
  })

  it("valida duração e ordem inteiras", () => {
    const base = { name: "Corte", description: "", priceReais: "10", durationMinutes: "1.5", displayOrder: "0", status: "ACTIVE" as const, categoryId: "" }
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

  it("marca somente serviços individuais como disponíveis", () => {
    expect(serviceTabs.filter((tab) => tab.available).map((tab) => tab.value)).toEqual(["individual", "categories"])
    expect(serviceTabs.filter((tab) => !tab.available).map((tab) => tab.value)).toEqual(["combos"])
  })

  it("agrupa associações reais por profissional", () => {
    const ana = { id: "p1", name: "Ana", role: "Barbeira", photoUrl: null, status: "ACTIVE" } satisfies ProfessionalOption
    const bia = { id: "p2", name: "Bia", role: "Barbeira", photoUrl: null, status: "ACTIVE" } satisfies ProfessionalOption
    const serviceBase = { description: null, category: null, priceCents: 5000, durationMinutes: 30, displayOrder: 0, status: "ACTIVE" as const, categoryId: "" }
    const services: CatalogService[] = [
      { ...serviceBase, id: "s1", name: "Corte", professionals: [{ professional: ana }] },
      { ...serviceBase, id: "s2", name: "Barba", professionals: [{ professional: ana }, { professional: bia }] },
    ]
    expect(groupServicesByProfessional(services, [ana, bia]).map(({ professional, services: assigned }) => ({ id: professional.id, services: assigned.map((service) => service.id) }))).toEqual([
      { id: "p1", services: ["s1", "s2"] },
      { id: "p2", services: ["s2"] },
    ])
  })

  it("limita o resumo a três serviços e calcula os restantes", () => {
    const services = ["Delta", "Beta", "Alfa", "Gama"].map((name, index) => ({ id: String(index), name, displayOrder: index })) as CatalogService[]
    const summary = getAssignedServicesSummary(services)
    expect(summary.visible.map((service) => service.name)).toEqual(["Delta", "Beta", "Alfa"])
    expect(summary.remaining).toBe(1)
    expect(summary.empty).toBe(false)
    expect(getAssignedServicesSummary([])).toEqual({ visible: [], remaining: 0, empty: true })
  })

  it("ordena por ordem de exibição e nome e filtra somente os atribuídos", () => {
    const services = [
      { id: "2", name: "Barba", displayOrder: 2 },
      { id: "1", name: "Corte", displayOrder: 1 },
      { id: "3", name: "Acabamento", displayOrder: 2 },
    ] as CatalogService[]
    expect(sortServicesForDisplay(services).map((service) => service.id)).toEqual(["1", "3", "2"])
    expect(filterAssignedServices(services, "bar").map((service) => service.id)).toEqual(["2"])
    expect(filterAssignedServices(services, "inexistente")).toEqual([])
  })
})

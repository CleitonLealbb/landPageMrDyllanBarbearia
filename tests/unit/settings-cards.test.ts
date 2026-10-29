import { describe, expect, it } from "vitest"
import { filterSettingsCards, settingsCards } from "@/features/settings/settings-cards"
describe("settingsCards", () => {
  it("disponibiliza Serviços e Caixa e PDV, preservando as demais áreas", () => { expect(settingsCards).toHaveLength(10); expect(settingsCards.filter((card) => card.available).map(card => card.href)).toEqual(["/dashboard/configuracoes/caixa-pdv", "/dashboard/configuracoes/servicos"]); expect(settingsCards.filter((card) => !card.available).every((card) => card.href === null)).toBe(true) })
  it("busca em título, descrição e palavras-chave sem acentos", () => { expect(filterSettingsCards(settingsCards, "servicos").map((card) => card.id)).toContain("servicos"); expect(filterSettingsCards(settingsCards, "reservas").map((card) => card.id)).toEqual(["agendamentos"]); expect(filterSettingsCards(settingsCards, "fatura").map((card) => card.id)).toEqual(["assinatura"]); expect(filterSettingsCards(settingsCards, "inexistente")).toEqual([]) })
})

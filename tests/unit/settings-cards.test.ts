import { describe, expect, it } from "vitest"
import { filterSettingsCards, settingsCards } from "@/features/settings/settings-cards"
describe("settingsCards", () => {
  it("mantém nove cards e apenas Serviços disponível", () => { expect(settingsCards).toHaveLength(9); expect(settingsCards.filter((card) => card.available)).toEqual([expect.objectContaining({ id: "servicos", href: "/dashboard/configuracoes/servicos" })]); expect(settingsCards.filter((card) => !card.available).every((card) => card.href === null)).toBe(true) })
  it("busca em título, descrição e palavras-chave sem acentos", () => { expect(filterSettingsCards(settingsCards, "servicos").map((card) => card.id)).toContain("servicos"); expect(filterSettingsCards(settingsCards, "reservas").map((card) => card.id)).toEqual(["agendamentos"]); expect(filterSettingsCards(settingsCards, "fatura").map((card) => card.id)).toEqual(["assinatura"]); expect(filterSettingsCards(settingsCards, "inexistente")).toEqual([]) })
})

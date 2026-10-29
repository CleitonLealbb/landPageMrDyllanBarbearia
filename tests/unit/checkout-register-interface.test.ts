import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CheckoutHttp } from "@/features/checkout/http"
import { RegisterController, registerStatus, type Register } from "@/features/checkout/register-controller"
import { RegisterManager } from "@/features/checkout/components/register-manager"
import { CashPanel } from "@/features/checkout/components/cash-panel"
import { CheckoutController } from "@/features/checkout/controller"
import type { Bootstrap, Role } from "@/features/checkout/types"
import { SettingsView } from "@/features/settings/components/settings-view"
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => createElement("button", {}, "Menu") }))

const row: Register = { id: "register", name: "Recepção", active: true, hasOpenSession: false, openSession: null }
function bootstrap(role: Role = "BARBERSHOP_OWNER"): Bootstrap {
  return { operator: { id: "operator", name: "Operador", role, professionalId: null, permissions: { sell: true, cash: role !== "BARBER", discount: role === "BARBERSHOP_OWNER", cancel: role === "BARBERSHOP_OWNER" } }, services: [], packages: [], professionals: [], customers: [], products: [], cashRegisters: [], openSessions: [] }
}
describe("Configuração de caixas e atualização do Checkout", () => {
  it("configurações têm acesso real a Caixa e PDV", () => {
    const html = renderToStaticMarkup(createElement(SettingsView))
    expect(html).toContain("Caixa e PDV"); expect(html).toContain('href="/dashboard/configuracoes/caixa-pdv"')
  })
  it.each(["BARBERSHOP_OWNER", "ASSISTANT", "BARBER"] as const)("ação Configurar caixas respeita %s", role => {
    const controller = new CheckoutController(new CheckoutHttp(), bootstrap(role))
    const html = renderToStaticMarkup(createElement(CashPanel, { controller, state: controller.getSnapshot() }))
    expect(html).toContain("Nenhum caixa ativo")
    expect(html.includes("Configurar caixas")).toBe(role === "BARBERSHOP_OWNER")
    expect(html).toContain("Solicite a configura")
  })
  it("mostra Aberto/Fechado/Inativo, não oferece exclusão e explica o bloqueio", async () => {
    const rows = [row, { ...row, id: "open", name: "Balcão", hasOpenSession: true, openSession: { id: "session", status: "OPEN" as const } }, { ...row, id: "inactive", name: "Reserva", active: false }]
    const controller = new RegisterController(new CheckoutHttp(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ registers: rows }))))
    await controller.load()
    const html = renderToStaticMarkup(createElement(RegisterManager, { controller }))
    for (const label of ["Aberto", "Fechado", "Inativo", "Renomear", "Inativar", "Ativar", "Cadastrar caixa", "Feche a sessão aberta antes de inativar"]) expect(html).toContain(label)
    expect(html).not.toContain("Excluir"); expect(html).not.toContain('value="register"')
    expect(html).toMatch(/disabled=""[^>]*>Inativar/)
    expect(rows.map(registerStatus)).toEqual(["Fechado", "Aberto", "Inativo"])
  })
  it("não exibe UUID nem prefixo técnico de fixtures", async () => {
    const controller = new RegisterController(new CheckoutHttp(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ registers: [{ ...row, id: "c31862f1-9bce-49c7-9975-bef48efaa517", name: "CHECKOUT_VISUAL_TEST_fixture" }] }))))
    await controller.load()
    const html = renderToStaticMarkup(createElement(RegisterManager, { controller }))
    expect(html).toContain("Caixa 1"); expect(html).not.toMatch(/CHECKOUT_VISUAL_TEST|c31862f1/)
  })
  it("vazio e carregamento possuem estados claros", async () => {
    const controller = new RegisterController(new CheckoutHttp(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ registers: [] }))))
    expect(renderToStaticMarkup(createElement(RegisterManager, { controller }))).toContain("Carregando caixas")
    await controller.load()
    expect(renderToStaticMarkup(createElement(RegisterManager, { controller }))).toContain("Cadastre o primeiro caixa")
  })
  it.each([401, 403, 409, 500])("resposta %i não mostra detalhes internos", async status => {
    const controller = new RegisterController(new CheckoutHttp(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ message: "SECRET SQL constraint" }, { status }))))
    await controller.save({ name: "Nome" })
    const html = renderToStaticMarkup(createElement(RegisterManager, { controller }))
    expect(html).toContain('role="alert"'); expect(html).not.toContain("SECRET")
    expect(controller.getSnapshot().retry).toBe(status >= 500)
  })
  it("repetição incerta preserva chave, método, ID e payload sem aceitar outra intenção", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json(row)).mockResolvedValueOnce(Response.json({ registers: [row] }))
    const controller = new RegisterController(new CheckoutHttp(fetcher))
    await controller.save({ active: true }, "register")
    expect(controller.getSnapshot().retry).toBe(true)
    await controller.save({ name: "NÃO ENVIAR" })
    expect(fetcher.mock.calls[0][0]).toBe("/api/checkout/cash-registers/register")
    expect(fetcher.mock.calls[1][0]).toBe(fetcher.mock.calls[0][0])
    expect(fetcher.mock.calls[0][1]?.method).toBe("PATCH")
    expect(fetcher.mock.calls[1][1]?.body).toBe(fetcher.mock.calls[0][1]?.body)
    expect(fetcher.mock.calls[1][1]?.headers).toEqual(fetcher.mock.calls[0][1]?.headers)
    expect(controller.getSnapshot().retry).toBe(false)
  })
  it("bloqueia duplo envio enquanto a operação está em andamento", async () => {
    let resolve!: (response: Response) => void
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done })).mockResolvedValueOnce(Response.json({ registers: [row] }))
    const controller = new RegisterController(new CheckoutHttp(fetcher))
    const first = controller.save({ name: "Nome" })
    expect(await controller.save({ name: "Outro" })).toBeNull()
    resolve(Response.json(row)); await first
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "POST")).toHaveLength(1)
  })
  it("após cadastro/ativação recarrega a lista e atualiza seletor sem perder comanda", async () => {
    const initial = bootstrap()
    const updated = { ...initial, cashRegisters: [{ id: "new-register", name: "Novo caixa" }] }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(updated))
    const checkout = new CheckoutController(new CheckoutHttp(fetcher), initial)
    checkout.set({ tip: "5,00" })
    const registersFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(row)).mockResolvedValueOnce(Response.json({ registers: [row] }))
    const registers = new RegisterController(new CheckoutHttp(registersFetch))
    expect(await registers.save({ name: "Nome" })).not.toBeNull()
    expect(registers.getSnapshot().registers).toEqual([row])
    await checkout.registerUpdated("new-register")
    expect(checkout.getSnapshot().registerId).toBe("new-register")
    expect(checkout.getSnapshot().tip).toBe("5,00")
    expect(fetcher).toHaveBeenCalledWith("/api/checkout/bootstrap", expect.objectContaining({ method: "GET" }))
  })
  it("inativação externa gera conflito, atualiza seletor e não repete abertura", async () => {
    const initial = bootstrap(); initial.cashRegisters = [{ id: "register", name: "Recepção" }]
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ message: "SECRET" }, { status: 409 })).mockResolvedValueOnce(Response.json(bootstrap()))
    const controller = new CheckoutController(new CheckoutHttp(fetcher), initial)
    await controller.cash("open", "0", "Manhã")
    expect(controller.getSnapshot().status).toBe(409)
    expect(controller.getSnapshot().data?.cashRegisters).toEqual([])
    expect(controller.getSnapshot().registerId).toBe("")
    expect(controller.getSnapshot().error).not.toContain("SECRET")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

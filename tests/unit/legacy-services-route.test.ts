import { describe, expect, it, vi } from "vitest"
const redirect = vi.fn()
vi.mock("next/navigation", () => ({ redirect }))
describe("rota legada de Serviços", () => { it("redireciona para a central", async () => { const { default: page } = await import("@/app/dashboard/servicos/page"); await page(); expect(redirect).toHaveBeenCalledWith("/dashboard/configuracoes/servicos") }) })

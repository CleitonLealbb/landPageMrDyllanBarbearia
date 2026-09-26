import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync("src/features/services/components/packages-panel.tsx", "utf8")

describe("formulario administrativo de combos", () => {
  it("oferece duracao, ordem, status e servicos", () => {
    expect(source).toContain("Duracao (minutos)")
    expect(source).toContain('SelectItem value="ACTIVE"')
    expect(source).toContain('SelectItem value="INACTIVE"')
    expect(source).toContain("selectableServices.map")
  })

  it("usa o normalizador compartilhado e preserva relacoes inalteradas", () => {
    expect(source).toContain("normalizePackagePayload(form)")
    expect(source).toContain("delete body.serviceIds")
    expect(source).toContain('service.status === "INACTIVE" ? " (Inativo)"')
  })
})

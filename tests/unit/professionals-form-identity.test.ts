import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  "src/features/professionals/components/professionals-view.tsx",
  "utf8"
)

describe("distincao visual de identidades profissionais", () => {
  it("exibe cargo, badge e acessos do proprietario", () => {
    expect(source).toContain('"Barbeiro Proprietário"')
    expect(source).toContain(">Proprietário</Badge>")
    expect(source).toContain("Atuação operacional")
    expect(source).toContain("Acesso administrativo")
    expect(source).toContain("Proprietário da barbearia")
  })

  it("nao envia permissionLevel e nao oferece exclusao para perfil vinculado", () => {
    expect(source).toContain("...(!linkedProfile ? { permissionLevel } : {})")
    expect(source).toContain('item.identityType !== "LINKED_USER"')
  })

  it("mantem acesso profissional editavel para identidade independente", () => {
    expect(source).toContain("Acesso profissional")
    expect(source).toContain('<SelectItem value="ASSISTANT">Assistente</SelectItem>')
  })

  it("usa linguagem de inativacao e reativacao sem exclusao", () => {
    expect(source).toContain("Inativar profissional?")
    expect(source).toContain("cadastro e histórico serão preservados")
    expect(source).toContain('item.status === "INACTIVE" ? "Reativar" : "Inativar"')
    expect(source).not.toContain("Excluir profissional")
  })
})

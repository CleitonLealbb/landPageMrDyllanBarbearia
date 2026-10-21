# Documentação do Agendo Barber

Central técnica viva, auditada em **2026-08-14** no commit-base `bfd4872`.

## Navegação

- [Visão do produto](01-visao-geral/produto.md) · [Arquitetura](01-visao-geral/arquitetura.md) · [Roadmap](01-visao-geral/roadmap.md)
- [Autenticação](02-autenticacao/identidades.md) · [Banco de dados](03-banco-de-dados/modelo-dados.md)
- [Módulos](04-modulos/profissionais.md) · [API](05-api/administrativa.md)
- [Operação](06-operacao/ambiente-local.md) · [ADRs](07-decisoes/ADR-001-identidades-separadas.md)
- [Changelog documental](historico/changelog.md)

## Estado dos módulos

O catálogo administrativo e público inclui Combos/Pacotes tenant-safe, documentados em [Serviços](04-modulos/servicos.md) e na [ADR-006](07-decisoes/ADR-006-combos-pacotes.md).

| Módulo | Estado | Referência |
|---|---|---|
| Autenticação administrativa/profissional | IMPLEMENTADO | [Autenticação](02-autenticacao/identidades.md) |
| Profissionais e vínculo do owner | IMPLEMENTADO | [Profissionais](04-modulos/profissionais.md) |
| Serviços individuais | IMPLEMENTADO | [Serviços](04-modulos/servicos.md) |
| Categorias de serviços | IMPLEMENTADO | [Categorias](04-modulos/categorias.md) |
| Combos / Pacotes | IMPLEMENTADO | [Serviços](04-modulos/servicos.md) |
| Configurações da empresa | PARCIAL | [Configurações](04-modulos/configuracoes.md) |
| Catálogo público mobile | IMPLEMENTADO | [Catálogo mobile](04-modulos/catalogo-mobile.md) |
| Conta e vínculo de clientes | PARCIAL | [Modelo de dados](03-banco-de-dados/modelo-dados.md) |
| Aplicativo Expo | PLANEJADO fora deste repositório | [Contrato público](05-api/publica-mobile.md) |
| Agenda, checkout, estoque e demais views | SIMULADO/PARCIAL | [Roadmap](01-visao-geral/roadmap.md) |
| Cadastro público administrativo | DESCONTINUADO | [API administrativa](05-api/administrativa.md) |

## Regra de documentação viva

Toda alteração de schema, migration, endpoint, autenticação, autorização, contrato mobile, regra de negócio, estado de módulo ou configuração de ambiente deve atualizar o documento correspondente.

Checklist para missões e pull requests:

- [ ] Atualizei o status do módulo sem chamar planejamento de implementação.
- [ ] Atualizei API, exemplos, modelo e ADR afetados.
- [ ] Revisei diagramas Mermaid e links relativos.
- [ ] Removi segredos, dados pessoais e identificadores reais.
- [ ] Registrei a mudança no [changelog](historico/changelog.md).
- [ ] Executei as validações de [testes](06-operacao/testes.md).

Fontes principais: `src/app`, `src/lib`, `src/features`, `prisma` e `tests`.

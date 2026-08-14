# Arquitetura

```mermaid
flowchart LR
  Browser[Painel Next.js] --> App[App Router]
  App --> Admin[APIs administrativas]
  App --> Public[API mobile pública]
  Admin --> Auth[Sessão e permissões]
  Admin --> Prisma[Prisma Client]
  Public --> Prisma
  Prisma --> PG[(PostgreSQL)]
  Mobile[Consumidor mobile] --> Public
```

O App Router está em `src/app`; regras compartilhadas em `src/lib`; interfaces em `src/features`; persistência em `prisma/schema.prisma`. O middleware apenas exige cookie nas rotas `/dashboard`; cada API faz a autorização definitiva.

```mermaid
flowchart TD
  Auth[Autenticação] --> Dashboard[Painel]
  Dashboard --> Settings[Configurações]
  Settings --> Services[Serviços e categorias]
  Services --> Team[Profissionais]
  Services --> Catalog[Catálogo público]
  Customers[Clientes: parcial] --> Dashboard
  Planned[Agenda e operação: parcial/simulada] --> Dashboard
```

Fontes: `src/middleware.ts`, `src/app`, `src/lib/auth`, `src/lib/services`.

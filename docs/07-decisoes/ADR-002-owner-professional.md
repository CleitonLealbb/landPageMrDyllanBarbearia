# ADR-002 — Owner com perfil Professional

- **Status:** aceito
- **Data:** 2026-08-14

## Contexto e problema

O proprietário pode atender clientes, mas duplicar login e senha criaria ambiguidade.

## Decisão

Vincular `Professional(barbershopId,userId)` à membership composta e manter autenticação exclusivamente como `User`.

```mermaid
flowchart LR
  Owner[User owner] --> Membership[BarbershopUser]
  Membership --> Profile[Professional vinculado]
  Owner --> Login[Login USER único]
  Profile --> Services[ProfessionalService]
```

Para criação futura:

```mermaid
sequenceDiagram
  participant Admin as Super admin
  participant API as API owner
  participant DB as Transação
  Admin->>API: alsoProvidesServices + dados operacionais
  API->>DB: criar User e membership
  API->>DB: criar Professional vinculado sem credencial
  DB-->>API: confirmar tudo ou rollback
```

## Alternativas

Segundo Professional independente e busca por e-mail foram rejeitados.

## Consequências e riscos

Positivo: uma credencial e tenant garantido pela FK. Risco: APIs devem distinguir perfil vinculado; testes cobrem e-mail, permissão e inativação.

Referências: migration `link_owner_professional_profile`, rotas de owner/profissionais.

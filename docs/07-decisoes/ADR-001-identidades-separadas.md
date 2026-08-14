# ADR-001 — Identidades separadas

- **Status:** aceito
- **Data:** 2026-08-14

## Contexto e problema

Administração, atuação profissional e consumo como cliente têm ciclos e autoridades diferentes. Uma tabela única confundiria papéis e credenciais.

## Decisão

Manter `User`, `Professional` e `CustomerAccount` separados; `BarbershopUser` representa membership.

## Alternativas

Uma identidade universal foi rejeitada por acoplar autenticação, perfil operacional e tenant.

## Consequências e riscos

Positivo: limites claros e sessões discriminadas. Risco: colisão de e-mail entre tabelas e mais validações; fluxos administrativos bloqueiam colisões e perfis vinculados não têm segunda credencial.

Referências: `prisma/schema.prisma`, `src/app/api/login/route.ts`, `src/lib/auth/claims.ts`.

# ADR-003 — Multitenancy derivado da sessão

- **Status:** aceito
- **Data:** 2026-08-14

## Contexto e problema

IDs enviados pelo cliente podem apontar para outro tenant.

## Decisão

Derivar `barbershopId` da sessão/membership, filtrar toda consulta e usar chaves/FKs compostas.

## Alternativas

Confiar no payload ou fazer `findUnique(id)` sem tenant foi rejeitado.

## Consequências e riscos

Positivo: isolamento em aplicação e banco. Risco: uma nova rota omitir filtro; mocks fail-closed e testes por tenant mitigam.

Referências: `src/lib/auth/session.ts`, `src/lib/services/catalog.ts`, `prisma/schema.prisma`.

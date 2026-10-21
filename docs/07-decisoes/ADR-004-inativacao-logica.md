# ADR-004 — Inativação lógica

- **Status:** aceito
- **Data:** 2026-08-14

## Contexto e problema

Exclusão física de profissionais ou itens do catálogo perde histórico e varia conforme FKs.

## Decisão

Usar `ACTIVE/INACTIVE`; DELETE administrativo de Professional, Service e ServiceCategory representa inativação. Professional incrementa `sessionVersion` na primeira inativação.

## Alternativas

Exclusão física e remoção automática de associações foram rejeitadas.

## Consequências e riscos

Positivo: cadastro, associações e histórico preservados. Risco: toda leitura/associação pública deve filtrar ativos; testes cobrem isso.

Referências: rotas `[id]`, catálogo mobile e `tests/routes`.

# ADR-005 — Catálogo mobile separado

- **Status:** aceito
- **Data:** 2026-08-14

## Contexto e problema

Respostas administrativas contêm dados desnecessários para consumidores públicos.

## Decisão

Expor API read-only versionada em `/api/mobile/v1`, com projeções mínimas, filtros `ACTIVE` e erros próprios.

## Alternativas

Reutilizar diretamente APIs administrativas foi rejeitado por segurança e estabilidade contratual.

## Consequências e riscos

Positivo: menor superfície e evolução versionada. Risco: duplicação de projeções; testes garantem ausência de campos internos.

Referências: `src/app/api/mobile/v1`, `src/lib/mobile/public-catalog.ts`.

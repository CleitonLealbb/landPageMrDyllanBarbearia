# Catálogo mobile

**Estado: IMPLEMENTADO como API pública de leitura.** O aplicativo Expo não está neste repositório.

```mermaid
sequenceDiagram
  participant SaaS as Banco/SaaS
  participant API as /api/mobile/v1
  participant App as Consumidor mobile
  App->>API: GET por slug
  API->>SaaS: filtra tenant e ACTIVE
  SaaS-->>API: projeção mínima
  API-->>App: JSON público estável
```

Retorna identidade pública da barbearia, serviços ativos, profissionais ativos associados e combos ativos compostos apenas por serviços ativos. Combos incluem preço promocional, preço original e duração derivados. Não expõe e-mail, comissão, credenciais, membership, tenant, `accessEmail` ou notas internas.

Fontes: `src/app/api/mobile/v1`, `src/lib/mobile/public-catalog.ts`, `tests/routes/mobile-catalog.test.ts` e `tests/routes/mobile-service-packages.test.ts`.

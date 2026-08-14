# Categorias

**Estado: IMPLEMENTADO.** Categorias organizam serviços por tenant, com nome único, descrição, ordem e status.

GET/POST operam em `/api/service-categories`; PUT/DELETE lógico em `/api/service-categories/[id]`. A categoria é opcional no serviço. Categorias inativas não podem ser escolhidas em novas gravações; o catálogo público inclui a projeção da categoria associada.

Fontes: `src/app/api/service-categories`, `src/lib/services/categories.ts`, `src/features/services/components/categories-panel.tsx`.

# API administrativa

Todas as rotas derivam autorização da sessão; corpo e parâmetros não escolhem tenant.

| Rota | Métodos | Estado/autoridade |
|---|---|---|
| `/api/login`, `/api/logout` | POST | IMPLEMENTADO |
| `/api/forgot-password`, `/api/reset-password`, `/api/first-access` | POST | IMPLEMENTADO |
| `/api/register` | POST | DESCONTINUADO: sempre 403 |
| `/api/barbershops` | GET/POST | SUPER_ADMIN |
| `/api/barbershops/[id]` | PUT/DELETE | SUPER_ADMIN |
| `/api/barbershops/[id]/owner` | POST | SUPER_ADMIN |
| `/api/professionals` | GET/POST | Owner |
| `/api/professionals/[id]` | PUT/DELETE lógico | Owner |
| `/api/services` | GET/POST | Owner |
| `/api/services/[id]` | PUT/DELETE lógico | Owner |
| `/api/services/[id]/professionals` | PUT | Owner |
| `/api/service-categories` e `/[id]` | GET/POST/PUT/DELETE lógico | Owner |
| `/api/service-packages` e `/[id]` | GET/POST/PUT/DELETE lógico | Owner |
| `/api/dashboard/summary` | GET | Sessão autorizada por tipo |
| `/api/upload` | POST | Owner; integração Cloudinary |

Fontes: `src/app/api/**/route.ts` e testes de rota.

Combos exigem dois serviços ativos do tenant. O preço promocional não supera a soma atual. `PUT` substitui itens atomicamente apenas com `serviceIds`; `DELETE` inativa de modo idempotente.

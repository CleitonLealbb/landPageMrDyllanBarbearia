# API pública mobile

Base: `/api/mobile/v1/barbershops/[slug]`.

| Endpoint | Resposta |
|---|---|
| `GET /[slug]` | nome, slug, endereço, telefone e timezone públicos |
| `GET /[slug]/services` | serviços `ACTIVE`, ordenados, com categoria opcional |
| `GET /[slug]/professionals` | profissionais `ACTIVE` associados; filtro `serviceIds` |
| `GET /[slug]/packages` | implementação pública principal: combos `ACTIVE` com ao menos dois serviços ativos; preço e duração oficiais persistidos |
| `GET /[slug]/combos` | alias compatível que reexporta o `GET` de `/packages`; ambos retornam o mesmo contrato |

O filtro aceita no máximo 20 IDs deduplicados e rejeita chaves desconhecidas. Slug inexistente/inativo usa `BARBERSHOP_NOT_FOUND`; consultas inválidas usam `INVALID_QUERY`.

O contrato é a única integração comprovada com um futuro app. Não há código Expo local.

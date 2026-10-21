# Migrations

| Migration | Conteúdo |
|---|---|
| `0_init` | Identidades, barbearias e memberships |
| `canonical_roles_and_session_version` | enums de papel e versões de sessão |
| `mobile_customer_catalog_foundation` | clientes, serviços, catálogo e associações |
| `service_categories` | categorias e vínculo opcional em Service |
| `link_owner_professional_profile` | vínculo tenant-safe membership→Professional |
| `20260814010000_service_packages` | combos, itens, checks, índices e FKs compostas tenant-safe |
| `20260814020000_service_package_duration` | duração oficial do combo, com backfill seguro e check positivo |

A migration mobile contém backfill específico e exige exatamente uma barbearia no estado histórico. Nunca use `db push` ou `migrate reset` em ambiente compartilhado. Revise o SQL antes de `migrate deploy`.

Fontes: `prisma/migrations/**/migration.sql`.

A migration de combos é aditiva, usa `ON DELETE RESTRICT` e não contém `DROP`, `DELETE`, `TRUNCATE` ou cascade destrutivo.

A migration de duração preenche pacotes existentes com a soma histórica dos serviços e aborta se não puder obter um valor positivo; depois torna o campo obrigatório.

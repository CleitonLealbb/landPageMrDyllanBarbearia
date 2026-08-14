# Migrations

| Migration | Conteúdo |
|---|---|
| `0_init` | Identidades, barbearias e memberships |
| `canonical_roles_and_session_version` | enums de papel e versões de sessão |
| `mobile_customer_catalog_foundation` | clientes, serviços, catálogo e associações |
| `service_categories` | categorias e vínculo opcional em Service |
| `link_owner_professional_profile` | vínculo tenant-safe membership→Professional |

A migration mobile contém backfill específico e exige exatamente uma barbearia no estado histórico. Nunca use `db push` ou `migrate reset` em ambiente compartilhado. Revise o SQL antes de `migrate deploy`.

Fontes: `prisma/migrations/**/migration.sql`.

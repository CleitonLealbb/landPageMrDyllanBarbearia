# Produto

O Agendo Barber é um SaaS de administração de barbearias. O código atual reúne painel web, gestão de catálogo/equipe e API pública de leitura para consumidores mobile.

## Escopo comprovado

- **IMPLEMENTADO:** login, sessão JWT revalidada, barbearias, profissionais, serviços, categorias e catálogo público.
- **PARCIAL:** clientes e central de configurações.
- **SIMULADO:** algumas views de agenda, checkout, estoque, marketing e cartões.
- **PLANEJADO:** combos, escalas e oito áreas internas da central de configurações.
- **DESCONTINUADO:** cadastro administrativo público em `/api/register`.

Stack: Next.js 16.2.4, React 19.1, TypeScript 5.9, Prisma 6.6, PostgreSQL, Vitest 4.1 e componentes Radix. Versões vêm de `package.json`.

Veja [arquitetura](arquitetura.md) e [roadmap](roadmap.md).

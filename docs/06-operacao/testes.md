# Testes e validação

Vitest cobre claims, sessão, permissões, schema, apresentação administrativa, rotas, isolamento de tenant, catálogo e regras de serviços/categorias.

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npx.cmd next build --webpack
git diff --check
git status --short
git diff --stat
```

Testes não devem acessar rede, Neon ou serviços externos. Mocks Prisma falham por padrão em chamadas inesperadas (`tests/setup/prisma-mock.ts`).

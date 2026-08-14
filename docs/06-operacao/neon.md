# Neon

**Configuração comprovada:** Prisma usa PostgreSQL por `DATABASE_URL`. O repositório não contém metadados capazes de provar o nome de uma branch Neon; confirme branch, host, database e schema no painel antes de qualquer escrita.

Proteções:

1. nunca imprimir a connection string;
2. comparar apenas hostname/database/schema esperados;
3. executar `prisma migrate status` antes de mudanças;
4. revisar SQL integralmente;
5. usar `prisma migrate deploy`, nunca `db push/reset`, em ambiente compartilhado;
6. não acessar production ou previews em missões de development.

Não há segredo Neon versionado.

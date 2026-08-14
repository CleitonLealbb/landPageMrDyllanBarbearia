# Checklist de deploy

```mermaid
sequenceDiagram
  participant Dev
  participant CI
  participant DB as Banco autorizado
  participant Host as Hospedagem
  Dev->>Dev: branch, HEAD e worktree
  Dev->>CI: testes, tipos e build
  Dev->>DB: confirmar ambiente e migrate status
  Dev->>DB: migrate deploy após revisão
  Dev->>CI: repetir validações
  Dev->>Host: publicar com variáveis do ambiente
  Host-->>Dev: smoke test sem dados sensíveis
```

- [ ] Branch/HEAD e revisão aprovados.
- [ ] Documentação e changelog atualizados.
- [ ] SQL sem operação inesperada e ambiente confirmado.
- [ ] Testes, TypeScript, build e `diff --check` aprovados.
- [ ] Variáveis configuradas sem exposição.
- [ ] Contrato mobile comparado com consumidores.
- [ ] Plano de rollback definido; nenhum `reset`, seed ou `db push`.

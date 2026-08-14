# ADR-006 — Combos e pacotes

Combos são entidades tenant-safe (`ServicePackage`) compostas por dois ou mais serviços via `ServicePackageItem`. O preço promocional é persistido; preço original, duração e economia são derivados.

As relações usam chaves compostas com `barbershopId`. A exclusão administrativa é lógica e preserva itens. A API pública retorna apenas combos ativos compostos somente por serviços ativos.

## Consequências

- O tenant vem da sessão ou da barbearia localizada pelo slug.
- Preço original, duração e economia são calculados, não duplicados.
- Checks, unicidades, FKs compostas e `ON DELETE RESTRICT` protegem a integridade.
- Atualizar sem `serviceIds` preserva itens; enviar a lista a substitui em transação.
- A rota mobile é aditiva e não altera contratos anteriores.

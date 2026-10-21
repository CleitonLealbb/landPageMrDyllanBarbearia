# ADR-006 — Combos e pacotes

Combos são entidades tenant-safe (`ServicePackage`) compostas por dois ou mais serviços via `ServicePackageItem`. Preço promocional e duração oficial configurável são persistidos; preço original, totais individuais e economia são derivados. A duração deve ser um inteiro positivo.

As relações usam chaves compostas com `barbershopId`. A exclusão administrativa é lógica e preserva itens. A API pública retorna apenas combos ativos compostos somente por serviços ativos.

## Consequências

- O tenant vem da sessão ou da barbearia localizada pelo slug.
- Preço original e economia são calculados; a duração configurada no pacote é a fonte oficial.
- Checks, unicidades, FKs compostas e `ON DELETE RESTRICT` protegem a integridade.
- Atualizar sem `serviceIds` preserva itens; enviar a lista a substitui em transação.
- A rota mobile é aditiva e não altera contratos anteriores.
- `/packages` é a implementação pública principal; `/combos` é um alias compatível que reexporta seu `GET` (`export { GET } from "../packages/route"`). Ambos retornam o mesmo contrato.

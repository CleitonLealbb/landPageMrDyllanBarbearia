# Isolamento por tenant

```mermaid
flowchart TD
  Request --> Session[Sessão revalidada]
  Session --> Tenant[barbershopId derivado]
  Tenant --> Query[Consulta inclui barbershopId]
  ClientId[barbershopId do cliente] -. ignorado/rejeitado .-> Query
  Query --> Composite[FKs e uniques compostas]
```

O tenant vem da sessão/membership, nunca do payload. Recursos por ID são consultados com `barbershopId`; divergência resulta em 404. FKs compostas protegem `ProfessionalService`, categorias e o vínculo de owner.

Fontes: `src/lib/services/catalog.ts`, rotas administrativas e `prisma/schema.prisma`.

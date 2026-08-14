# Modelo de dados

```mermaid
erDiagram
  Barbershop ||--o{ Service : oferece
  Barbershop ||--o{ ServiceCategory : organiza
  ServiceCategory o|--o{ Service : categoriza
  Barbershop ||--o{ Professional : possui
  Professional ||--o{ ProfessionalService : executa
  Service ||--o{ ProfessionalService : associa
```

Entidades principais: `User`, `BarbershopUser`, `Professional`, `Barbershop`, `CustomerAccount`, `BarbershopCustomer`, `Service`, `ServiceCategory` e `ProfessionalService`.

`ProfessionalService` usa chave composta `(barbershopId, professionalId, serviceId)`. As FKs compostas garantem que serviço e profissional pertençam ao tenant informado. Valores monetários são centavos inteiros.

Fonte canônica: `prisma/schema.prisma`.

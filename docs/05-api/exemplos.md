# Exemplos de API

Exemplos usam dados fictícios e não são credenciais reais.

```http
GET /api/mobile/v1/barbershops/exemplo/services
```

```json
[{"id":"service_example","name":"Corte","description":null,"priceCents":5000,"durationMinutes":45,"displayOrder":0,"category":null}]
```

## Combo público

`/packages` é a implementação pública principal; `/combos` reexporta seu `GET` como alias compatível. Ambos retornam o mesmo contrato abaixo.

```http
GET /api/mobile/v1/barbershops/exemplo/packages
GET /api/mobile/v1/barbershops/exemplo/combos
```

```json
[{"id":"combo_example","name":"Corte + Barba","description":"Atendimento combinado","priceCents":6500,"originalPriceCents":7500,"durationMinutes":60,"displayOrder":1,"services":[{"id":"service_cut","name":"Corte","priceCents":4000,"durationMinutes":30,"category":null},{"id":"service_beard","name":"Barba","priceCents":3500,"durationMinutes":30,"category":null}]}]
```

```http
GET /api/mobile/v1/barbershops/exemplo/professionals?serviceIds=service_example
```

```json
[{"id":"professional_example","name":"Profissional","role":"Barbeiro","photoUrl":null,"serviceIds":["service_example"]}]
```

```http
PUT /api/professionals/professional_example
Content-Type: application/json

{"status":"ACTIVE"}
```

O último exemplo exige sessão owner e serve para reativação lógica.

# Exemplos de API

Exemplos usam dados fictícios e não são credenciais reais.

```http
GET /api/mobile/v1/barbershops/exemplo/services
```

```json
[{"id":"service_example","name":"Corte","description":null,"priceCents":5000,"durationMinutes":45,"displayOrder":0,"category":null}]
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

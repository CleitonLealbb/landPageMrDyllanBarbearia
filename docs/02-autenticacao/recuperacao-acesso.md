# Recuperação de acesso

```mermaid
flowchart LR
  Request[Solicitação genérica] --> User{User existe?}
  User -->|sim| UserToken[Token de User]
  User -->|não| Pro{Professional independente?}
  Pro -->|sim| ProToken[Token de Professional]
  Pro -->|não| Generic[Resposta genérica]
  UserToken --> Reset[Redefinir e incrementar versão]
  ProToken --> Reset
```

`/api/forgot-password` evita revelar existência da conta. `/api/reset-password` limpa o token e incrementa a versão. `/api/first-access` aceita apenas Professional independente, `PENDING`, com convite válido. Perfil vinculado não recebe segunda credencial.

Envio por Resend é condicional às variáveis de ambiente. Fontes: rotas homônimas em `src/app/api`.

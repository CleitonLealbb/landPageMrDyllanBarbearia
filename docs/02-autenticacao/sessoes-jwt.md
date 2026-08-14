# Sessões JWT

```mermaid
flowchart TD
  Credentials[E-mail e senha] --> User{Existe User?}
  User -->|sim| UserPassword[Validar senha de User]
  User -->|não| Independent{Professional independente?}
  Independent -->|sim| ProPassword[Validar senha e status ACTIVE]
  Independent -->|não| Deny[Negar sem revelar identidade]
  UserPassword --> Membership[Validar papel e membership]
  ProPassword --> Shop[Validar barbearia ativa]
  Membership --> JWT[Emitir JWT USER]
  Shop --> ProJWT[Emitir JWT PROFESSIONAL]
```

```mermaid
flowchart TD
  Cookie --> Verify[Verificar assinatura JWT]
  Verify --> Claims[Validar formato discriminado]
  Claims --> Kind{USER ou PROFESSIONAL}
  Kind -->|USER| User[Revalidar User, versão e membership ativa única]
  Kind -->|PROFESSIONAL| Pro[Revalidar perfil independente ACTIVE, versão e tenant]
  User --> Session[Sessão válida]
  Pro --> Session
```

O token contém a identidade mínima e `sessionVersion`. `getSession()` reconsulta o banco em toda validação. Mudança de nível, senha ou inativação incrementa a versão quando aplicável, invalidando tokens anteriores.

Cookies são `httpOnly`, caminho `/` e expiração JWT de sete dias. O código atual não configura explicitamente `secure` ou `sameSite`; isso deve ser avaliado antes de produção.

Fontes: `src/lib/auth/claims.ts`, `src/lib/auth/session.ts`, `src/app/api/login/route.ts`.

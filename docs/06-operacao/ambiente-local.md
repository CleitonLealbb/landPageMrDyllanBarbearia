# Ambiente local

Pré-requisitos: Node.js compatível com Next.js 16, npm e PostgreSQL acessível pela `DATABASE_URL`.

```powershell
npm.cmd install
npx.cmd prisma generate
npm.cmd run dev
```

Variáveis observadas no código: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`. Não versionar valores.

`db:push`, `db:seed` e `db:setup` existem no `package.json`, mas não são procedimentos de deploy seguro para ambientes compartilhados.

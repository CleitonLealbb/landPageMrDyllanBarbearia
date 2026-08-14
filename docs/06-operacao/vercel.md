# Vercel

**Estado: PARCIAL.** O projeto Next.js é compatível com hospedagem Vercel, mas não existe `vercel.json` no repositório. Configurações e valores do painel não são auditáveis pelo código local.

Configure variáveis por ambiente sem copiá-las para documentação ou Git. Garanta que `DATABASE_URL`, `JWT_SECRET` e integrações opcionais apontem para o ambiente correto. O build comprovado é `next build --webpack` (o script `build` também gera Prisma Client).

Fonte: `package.json`, `next.config.ts`.

# Erros

APIs administrativas retornam `{ message }`; a API pública retorna `{ error: { code, message } }`. Erros internos são convertidos em mensagem genérica e status 500.

Padrões observados:

- 400: corpo ou transição inválida;
- 401: sessão ausente;
- 403: identidade sem autoridade;
- 404: recurso ausente no tenant validado;
- 409: unicidade, vínculo ou estado conflitante;
- 500: falha sanitizada.

Nunca inclua erro Prisma bruto, segredo ou confirmação de existência de conta. Fontes: `tests/helpers/route-assertions.ts` e rotas.

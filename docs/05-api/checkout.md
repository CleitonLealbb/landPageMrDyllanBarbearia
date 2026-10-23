# Checkout administrativo — Fase 2B

Requer sessão administrativa e tenant ativo. O cliente não envia `barbershopId`, operador, preços ou snapshots. Respostas usam `Cache-Control: private, no-store`. Dinheiro em centavos inteiros, percentuais em pontos-base inteiros; limite monetário por total: 2.147.483.647 centavos.

Cada POST exige `Idempotency-Key` de 1–200 caracteres: letras ASCII, números, ponto, `_`, `:` ou `-`. Repetir a mesma chave/entrada/operador reproduz status e corpo da resposta original, inclusive após mudança de estado. Outro conteúdo ou operador recebe 409. A chave é independente por tenant e operação; nenhuma chave é consumida quando ocorre rollback. Após conflito transitório, repetir a mesma requisição/chave; após editar o conteúdo, usar outra chave.

| Método e caminho | Corpo ou query | Permissão |
| --- | --- | --- |
| POST `/api/checkout/cash-sessions/open` | `cashRegisterId`, `shift`, `openingBalanceCents` | OWNER, ASSISTANT |
| GET `/api/checkout/cash-sessions/current` | query obrigatória `cashRegisterId` | OWNER, ASSISTANT |
| POST `/api/checkout/cash-sessions/[id]/close` | `countedBalanceCents`, `notes?` | OWNER, ASSISTANT |
| POST `/api/checkout/cash-movements` | `cashSessionId`, `kind: SUPPLY ou WITHDRAWAL`, `amountCents`, `reason` | OWNER, ASSISTANT |
| POST `/api/checkout/sales` | `customerId?`, `items`, `discount?`, `tips?` | OWNER, ASSISTANT, BARBER próprio |
| GET `/api/checkout/sales/[id]` | ID no caminho | OWNER, ASSISTANT, BARBER próprio |
| POST `/api/checkout/sales/[id]/finalize` | `cashSessionId`, `expectedVersion`, `payments` | OWNER, ASSISTANT, BARBER próprio |
| POST `/api/checkout/sales/[id]/cancel` | `reason`, `cashSessionId?` | OWNER |

OWNER significa `BARBERSHOP_OWNER`. BARBER precisa ter ao menos um componente de serviço e ser o profissional de todos os componentes/gorjetas da comanda. Só OWNER aplica desconto manual nesta fase, pois ainda não existe política configurável de desconto comum/especial.

Criação retorna 201 e a venda PENDING; venda anônima omite customerId. Itens aceitos:

```json
{
  "items": [
    { "kind": "SERVICE", "catalogId": "service-id", "professionalId": "professional-id", "quantity": 1 },
    { "kind": "PRODUCT", "catalogId": "product-id", "quantity": 2 },
    {
      "kind": "PACKAGE", "catalogId": "package-id", "quantity": 1,
      "components": [
        { "serviceId": "service-id", "professionalId": "professional-id" },
        { "serviceId": "beard-id", "professionalId": "professional-id" }
      ]
    }
  ],
  "discount": { "kind": "PERCENT", "basisPoints": 1000 },
  "tips": [{ "professionalId": "professional-id", "amountCents": 1000 }]
}
```

Alternativa de desconto: `{ "kind": "FIXED", "amountCents": 500 }`. Catálogo, cliente e profissionais precisam estar ativos e pertencer ao tenant. Cada profissional deve estar habilitado para seu serviço. A composição enviada de um combo deve corresponder exatamente ao catálogo, sem serviços duplicados. Preços, nomes, duração por unidade, profissionais, composição e comissão são congelados na criação. Combo rateia seu preço pelos preços originais dos serviços; centavos restantes seguem a ordem persistida do catálogo. Desconto é rateado entre itens e componentes antes da comissão. Gorjeta fica fora da base. Catálogo sem duração positiva impede nova venda de serviço/combo; produto mantém null.

Finalização retorna 200. Exemplo de total R$ 127,00:

```json
{
  "cashSessionId": "open-cash-session-id",
  "expectedVersion": 0,
  "payments": [
    { "method": "PIX", "appliedCents": 7700, "confirmed": true },
    { "method": "CASH", "appliedCents": 5000, "cashReceivedCents": 6000, "confirmed": true }
  ]
}
```

Métodos: CASH, PIX, CREDIT_CARD e DEBIT_CARD. `confirmed: true` é obrigatório, representando confirmação manual; não há gateway. Valores aplicados precisam ser positivos e somar exatamente o total. CASH exige valor recebido igual ou maior ao aplicado; diferença é troco. Outros métodos não aceitam cashReceivedCents. Venda de total zero aceita payments vazio, mas exige caixa aberto. Ainda não há pagamento parcial pendente. Apenas a finalização baixa estoque e gera comissão. Mudança de catálogo depois da criação não recalcula a venda. Snapshot histórico de serviço sem duração impede finalização até resolução explícita fora desta API; não há backfill automático.

Venda/consulta/finalização/cancelamento retornam DTO com totais, versão, estado, datas, `items` (incluindo `durationMinutesSnapshot` e `components`), `tips` e `payments`. Não retornam credenciais, dados de sessão ou ator interno. O replay devolve o DTO original; GET permite consultar o estado atual. Consulta de caixa retorna `{ "session": ... }` ou `{ "session": null }`. Abertura, movimento e fechamento retornam o recurso diretamente; abertura/movimento têm status 201, demais 200.

Cancelamento exige motivo e reverte o total integral, incluindo gorjeta. Para reembolsar CASH informe sessão aberta com saldo suficiente; pode ser diferente da sessão original fechada. PIX/cartões apenas recebem registro interno de reembolso manual; o sistema não chama adquirente nem devolve PIX automaticamente. O operador precisa realizar a devolução externa correspondente. Não há edição/exclusão de itens, estorno parcial ou reabertura de caixa nesta API.

Erros retornam `{ "message": "..." }`: 400 entrada/pagamento inválido; 401 sem sessão; 403 papel/atendimento não autorizado; 404 recurso do tenant não encontrado; 409 estado, estoque, saldo, versão, chave ou concorrência conflitante; 413 corpo acima de 64 KiB; 422 cadastro/snapshot sem duração válida ou total fora do limite; 503 transação indisponível/timeout; 500 erro inesperado genérico. Não são expostos SQL, nomes de constraints ou detalhes do Prisma. Entradas têm limites de 100 itens, quantidade 100 por item, 1.000 componentes executáveis, 50 gorjetas e 20 pagamentos.

Antes de disponibilizar estas rotas, a migration aditiva de duração precisa ser aplicada por operação autorizada. Nesta entrega nenhuma migration foi aplicada, nenhuma conexão real foi aberta e não houve alteração de interface.

Na tradução de erros, códigos estruturados do Prisma têm prioridade. P2002/P2034 e P2010 com SQLSTATE 23505/40001/40P01 continuam 409 de conflito; P2003/P2004/P2025 e P2010 com 23503/23514 são 409 de integridade. P2010 com 23P01 (exclusion violation) também é 409. Os tratamentos existentes de 22003/55P03 estruturados permanecem; os timeouts conhecidos continuam 503.

O Prisma 6.6 apresentou CHECK violation 23514 como `PrismaClientUnknownRequestError` no ensaio descartável. Apenas nessa classe, a apresentação reconhece o envelope completo de erro PostgreSQL do conector (`ConnectorError` → `QueryError` → `PostgresError`), com o campo code no formato `"23514"` ou `SqlState(E23514)`. É exigido um único envelope com formato reconhecido; números soltos, SQL, JSON e mensagens arbitrárias não são usados para inferir SQLSTATE. Outros formatos falham de forma conservadora com 500.

| SQLSTATE no envelope reconhecido | Tratamento |
| --- | --- |
| 23514 — CHECK violation | 409, conflito com o estado dos dados |
| 23503 — foreign key violation | 409, mesmo tratamento de integridade |
| 23505 — unique violation | 409, conflito; repetir com a mesma chave/conteúdo |
| 23P01 — exclusion violation | 409, conflito de integridade |
| 40001 — serialization failure | 409, atualizar/repetir com a mesma chave/conteúdo |
| 40P01 — deadlock detected | 409, atualizar/repetir com a mesma chave/conteúdo |

Essa classificação adicional existe somente na apresentação HTTP: não altera `isConflict`, transações, retries ou leitura de resultado idempotente. O erro continua sendo propagado até o rollback antes da tradução. Todos os corpos usam somente mensagens estáticas: sem SQLSTATE, query, tabela, coluna, constraint ou stack. Erros desconhecidos fora desses casos continuam 500 com `{"message":"Erro interno do servidor."}`.
